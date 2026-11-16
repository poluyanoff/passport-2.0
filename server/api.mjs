import {reviewPassport} from './review.mjs';
import {loadEnv} from './env.mjs';
import {allowReview, clientIp} from './rate-limit.mjs';

loadEnv();

function reply(res, status, body, headers = {}) {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
    res.end(JSON.stringify(body));
}

async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 1_000_000) throw new Error('Слишком большой запрос.');
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw new Error('Некорректный JSON.');
    }
}

export async function handleApi(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;

    if (path === '/health') {
        if (req.method !== 'GET') return reply(res, 405, {error: 'Метод не поддерживается.'});
        return reply(res, 200, {status: 'ok', provider: process.env.AI_PROVIDER || 'mock'});
    }

    if (path !== '/api/review') return false;
    if (req.method !== 'POST') return reply(res, 405, {error: 'Метод не поддерживается.'});

    const limit = allowReview(clientIp(req));
    if (!limit.allowed) return reply(res, 429, {error: 'Слишком много проверок. Попробуйте чуть позже.'}, {'Retry-After': String(limit.retryAfter)});

    try {
        const payload = await readJson(req);
        const result = await reviewPassport(payload);
        return reply(res, result.status, result.body, {'X-RateLimit-Remaining': String(limit.remaining)});
    } catch (error) {
        return reply(res, 400, {error: error.message || 'Не удалось обработать запрос.'});
    }
}
