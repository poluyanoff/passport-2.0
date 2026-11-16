import {readFile} from 'node:fs/promises';

const responseSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['issues'],
    properties: {
        issues: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'step', 'title', 'severity', 'description', 'recommendation'],
                properties: {
                    id: {type: 'string'},
                    step: {type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6, 7]},
                    title: {type: 'string'},
                    severity: {type: 'string', enum: ['recommendation']},
                    description: {type: 'string'},
                    recommendation: {type: 'string'},
                },
            },
        },
    },
};

function outputText(response) {
    if (typeof response.output_text === 'string') return response.output_text;
    return response.output
        ?.flatMap(item => item.content || [])
        .find(content => content.type === 'output_text')
        ?.text;
}

function normalizeIssues(value) {
    if (!Array.isArray(value?.issues)) throw new Error('Модель вернула ответ в неожиданном формате.');
    return value.issues.slice(0, 6).map((item, index) => {
        if (!Number.isInteger(item.step) || item.step < 0 || item.step > 7) throw new Error('Модель вернула неверный шаг проверки.');
        const clean = key => String(item[key] || '').trim().slice(0, 600);
        const description = clean('description');
        const recommendation = clean('recommendation');
        if (!description || !recommendation) throw new Error('Модель вернула неполное замечание.');
        return {
            id: clean('id') || `ai-issue-${index + 1}`,
            step: item.step,
            title: clean('title'),
            severity: 'recommendation',
            description,
            recommendation,
        };
    });
}

export async function reviewWithOpenAI(passport) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Не задан OPENAI_API_KEY.');

    const rules = JSON.parse(await readFile(new URL('../ai/review-rules.json', import.meta.url), 'utf8'));
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            store: false,
            instructions: [
                'Ты проверяешь описание продуктовой задачи перед передачей дизайнеру.',
                'Не повторяй формальные обязательные проверки формы. Не требуй ссылки, примеры или аналоги.',
                'Пиши по-русски. Возвращай только конкретные исправимые рекомендации.',
                'Не выдумывай факты. Если замечаний нет, верни пустой массив issues.',
            ].join(' '),
            input: JSON.stringify({rules, passport}),
            text: {format: {type: 'json_schema', name: 'passport_review', strict: true, schema: responseSchema}},
        }),
    });

    if (!response.ok) throw new Error(`OpenAI вернул ошибку ${response.status}.`);
    return normalizeIssues(JSON.parse(outputText(await response.json())));
}
