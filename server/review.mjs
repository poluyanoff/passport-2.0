import {FORMAL_REVIEW_WARNING, hasValidAudience, hasValidSituation, reviewWithRules} from '../shared/review-rules.mjs';

const MOCK_DELAY_MS = 5000;

export const REVIEW_RULES_VERSION = '2026-11-18-semantic-links';

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function validateReviewRequest(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Передайте объект с паспортом.';
    if (!payload.passport || typeof payload.passport !== 'object' || Array.isArray(payload.passport)) return 'Передайте данные паспорта.';
    if (!hasValidAudience(payload.passport.audience)) return 'Передайте от одного до десяти сегментов с типом, названием и размером.';
    if (!hasValidSituation(payload.passport.situation)) return 'Передайте от одной до десяти заполненных проблем или отметьте инициативу бизнеса.';
    return null;
}

function passportForAiReview(passport) {
    return passport.situation?.businessInitiative
        ? {...passport, situation: {...passport.situation, problems: []}}
        : passport;
}

export {reviewWithRules};

export async function reviewPassport(payload, {delayMs = MOCK_DELAY_MS} = {}) {
    const error = validateReviewRequest(payload);
    if (error) return {ok: false, status: 400, body: {error}};

    const formalIssues = reviewWithRules(payload.passport);
    if (formalIssues.length) {
        return {ok: true, status: 200, body: {
            status: 'completed', provider: 'rules', rulesVersion: REVIEW_RULES_VERSION,
            issues: formalIssues, warning: FORMAL_REVIEW_WARNING,
        }};
    }

    if (process.env.AI_PROVIDER === 'openai') {
        try {
            const {reviewWithOpenAI} = await import('./openai.mjs');
            const issues = await reviewWithOpenAI(passportForAiReview(payload.passport));
            return {ok: true, status: 200, body: {status: 'completed', provider: 'openai', rulesVersion: REVIEW_RULES_VERSION, issues}};
        } catch (providerError) {
            return {
                ok: true,
                status: 200,
                body: {
                    status: 'fallback', provider: 'rules', rulesVersion: REVIEW_RULES_VERSION,
                    issues: formalIssues,
                    warning: 'AI-проверка временно недоступна. Показаны предварительные рекомендации.',
                },
            };
        }
    }

    await wait(delayMs);

    return {
        ok: true,
        status: 200,
        body: {
            status: 'completed',
            provider: 'mock',
            rulesVersion: REVIEW_RULES_VERSION,
            issues: formalIssues,
        },
    };
}
