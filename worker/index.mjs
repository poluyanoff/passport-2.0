import rules from '../ai/review-rules.json';
import {FORMAL_REVIEW_WARNING, hasValidAudience, hasValidSituation, reviewWithRules} from '../shared/review-rules.mjs';

const responseSchema = {
    type: 'object', additionalProperties: false, required: ['issues'], properties: {
        issues: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'step', 'title', 'severity', 'description', 'recommendation'], properties: {
            id: {type: 'string'}, step: {type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6, 7]}, title: {type: 'string'},
            severity: {type: 'string', enum: ['recommendation']}, description: {type: 'string'}, recommendation: {type: 'string'},
        }}},
    },
};

function json(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers}});
}

function extractOutput(response) {
    if (typeof response.output_text === 'string') return response.output_text;
    return response.output?.flatMap(item => item.content || []).find(content => content.type === 'output_text')?.text;
}

function normalizeIssues(value) {
    if (!Array.isArray(value?.issues)) throw new Error('Ответ AI имеет неожиданный формат.');
    return value.issues.slice(0, 6).map((item, index) => ({
        id: String(item.id || `ai-issue-${index + 1}`).trim().slice(0, 120),
        step: Number.isInteger(item.step) && item.step >= 0 && item.step <= 7 ? item.step : 0,
        title: String(item.title || '').trim().slice(0, 120),
        severity: 'recommendation',
        description: String(item.description || '').trim().slice(0, 600),
        recommendation: String(item.recommendation || '').trim().slice(0, 600),
    })).filter(item => item.description && item.recommendation);
}

async function reviewWithOpenAI(passport, env) {
    if (!env.OPENAI_API_KEY) throw new Error('Не задан секрет OPENAI_API_KEY.');
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            model: env.OPENAI_MODEL || 'gpt-4.1-mini',
            store: false,
            instructions: 'Ты проверяешь описание продуктовой задачи перед передачей дизайнеру. Не повторяй формальные обязательные проверки формы и не требуй ссылки, примеры или аналоги. Пиши по-русски, давай только конкретные исправимые рекомендации и не выдумывай факты. Если замечаний нет, верни пустой массив issues.',
            input: JSON.stringify({rules, passport}),
            text: {format: {type: 'json_schema', name: 'passport_review', strict: true, schema: responseSchema}},
        }),
    });
    if (!response.ok) throw new Error(`OpenAI вернул ошибку ${response.status}.`);
    return normalizeIssues(JSON.parse(extractOutput(await response.json())));
}

async function limit(request, env) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const id = env.RATE_LIMITER.idFromName(ip);
    const response = await env.RATE_LIMITER.get(id).fetch('https://rate-limit/check', {method: 'POST'});
    return response.json();
}

export class RateLimiter {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
    }

    async fetch() {
        const now = Date.now();
        const max = Number(this.env.REVIEW_RATE_LIMIT_MAX || 20);
        const windowMs = Number(this.env.REVIEW_RATE_LIMIT_WINDOW_MS || 60_000);
        const current = await this.ctx.storage.get('limit');
        const next = !current || now >= current.resetAt ? {count: 1, resetAt: now + windowMs} : {...current, count: current.count + 1};
        await this.ctx.storage.put('limit', next);
        return json({allowed: next.count <= max, remaining: Math.max(0, max - next.count), retryAfter: Math.max(0, Math.ceil((next.resetAt - now) / 1000))});
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/health') return json({status: 'ok', provider: env.AI_PROVIDER || 'mock'});
        if (url.pathname !== '/api/review') return env.ASSETS.fetch(request);
        if (request.method !== 'POST') return json({error: 'Метод не поддерживается.'}, 405);

        const quota = await limit(request, env);
        if (!quota.allowed) return json({error: 'Слишком много проверок. Попробуйте чуть позже.'}, 429, {'Retry-After': String(quota.retryAfter)});

        let payload;
        try {
            const source = await request.text();
            if (source.length > 1_000_000) throw new Error('Слишком большой запрос.');
            payload = JSON.parse(source);
        } catch (error) {
            return json({error: error.message === 'Слишком большой запрос.' ? error.message : 'Некорректный JSON.'}, 400);
        }
        if (!payload?.passport || typeof payload.passport !== 'object') return json({error: 'Передайте данные паспорта.'}, 400);
        if (!hasValidAudience(payload.passport.audience)) return json({error: 'Передайте от одного до десяти сегментов с названием и размером.'}, 400, {'X-RateLimit-Remaining': String(quota.remaining)});
        if (!hasValidSituation(payload.passport.situation)) return json({error: 'Передайте от одной до десяти заполненных проблем или отметьте инициативу бизнеса.'}, 400, {'X-RateLimit-Remaining': String(quota.remaining)});

        const formalIssues = reviewWithRules(payload.passport);
        if (formalIssues.length) {
            return json({status: 'completed', provider: 'rules', rulesVersion: rules.version, issues: formalIssues, warning: FORMAL_REVIEW_WARNING}, 200, {'X-RateLimit-Remaining': String(quota.remaining)});
        }

        if (env.AI_PROVIDER === 'openai') {
            try {
                const issues = await reviewWithOpenAI(payload.passport, env);
                return json({status: 'completed', provider: 'openai', rulesVersion: rules.version, issues}, 200, {'X-RateLimit-Remaining': String(quota.remaining)});
            } catch {
                return json({status: 'fallback', provider: 'rules', rulesVersion: rules.version, issues: formalIssues, warning: 'AI-проверка временно недоступна. Формальные признаки полей пройдены; содержательная проверка не выполнена.'}, 200, {'X-RateLimit-Remaining': String(quota.remaining)});
            }
        }
        return json({status: 'completed', provider: 'mock', rulesVersion: rules.version, issues: formalIssues}, 200, {'X-RateLimit-Remaining': String(quota.remaining)});
    },
};
