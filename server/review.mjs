const MOCK_DELAY_MS = 5000;

export const REVIEW_RULES_VERSION = '2026-11-16';

import {reviewWithRules} from '../shared/review-rules.mjs';

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function validateReviewRequest(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Передайте объект с паспортом.';
    if (!payload.passport || typeof payload.passport !== 'object' || Array.isArray(payload.passport)) return 'Передайте данные паспорта.';
    return null;
}

export {reviewWithRules};

export async function reviewPassport(payload, {delayMs = MOCK_DELAY_MS} = {}) {
    const error = validateReviewRequest(payload);
    if (error) return {ok: false, status: 400, body: {error}};

    if (process.env.AI_PROVIDER === 'openai') {
        try {
            const {reviewWithOpenAI} = await import('./openai.mjs');
            const issues = await reviewWithOpenAI(payload.passport);
            return {ok: true, status: 200, body: {status: 'completed', provider: 'openai', rulesVersion: REVIEW_RULES_VERSION, issues}};
        } catch (providerError) {
            return {
                ok: true,
                status: 200,
                body: {
                    status: 'fallback', provider: 'rules', rulesVersion: REVIEW_RULES_VERSION,
                    issues: reviewWithRules(payload.passport),
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
            issues: reviewWithRules(payload.passport),
        },
    };
}
