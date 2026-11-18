const GENERIC_VALUES = ['нет', 'не знаю', 'n/a', 'na', 'тест', 'текст', 'пример', 'что-то', 'что то'];

export const FORMAL_REVIEW_WARNING = 'AI-проверка пока не запускалась: сначала исправьте формальные признаки полей. После этого сервис проверит смысл описания.';

function text(value) {
    return String(value || '').trim();
}

function isSpecific(value, minLength = 12) {
    const normalized = text(value).toLowerCase();
    return normalized.length >= minLength && !GENERIC_VALUES.includes(normalized);
}

function issue({id, step, title, description, recommendation}) {
    return {id, step, title, severity: 'recommendation', description, recommendation};
}

export function reviewWithRules(passport) {
    const issues = [];
    const situation = passport.situation || {};
    const business = passport.business || {};
    const hypotheses = Array.isArray(passport.hypotheses) ? passport.hypotheses : [];
    const metrics = Array.isArray(passport.metrics) ? passport.metrics : [];

    if (!situation.businessInitiative && (!isSpecific(situation.context) || !isSpecific(situation.difficulty) || !isSpecific(situation.consequence))) {
        issues.push(issue({
            id: 'situation-specificity', step: 1, title: 'Нужна базовая детализация ситуации',
            description: 'Формальная проверка не подтвердила заполненность одного или нескольких полей: текст короче 12 символов либо похож на шаблонный ответ. Смысл ситуации на этом этапе не анализировался.',
            recommendation: 'Дополните контекст, затруднение и последствие конкретными формулировками — затем запустится AI-проверка смысла.',
        }));
    }
    if (!business.impacts?.length && !isSpecific(business.comment)) {
        issues.push(issue({
            id: 'business-impact', step: 3, title: 'Нужно обозначить влияние на бизнес',
            description: 'Формальная проверка не нашла выбранную область влияния или достаточно развёрнутый комментарий. Содержательность влияния пока не анализировалась.',
            recommendation: 'Отметьте область влияния либо добавьте комментарий длиной не менее 12 символов — затем запустится AI-проверка смысла.',
        }));
    }
    if (hypotheses.some(hypothesis => !isSpecific(hypothesis.if) || !isSpecific(hypothesis.then) || !isSpecific(hypothesis.because))) {
        issues.push(issue({
            id: 'hypothesis-specificity', step: 4, title: 'Нужно дополнить гипотезу',
            description: 'Формальная проверка обнаружила в одной или нескольких гипотезах короткое или шаблонное поле «Если», «То» или «Потому что». Причинно-следственная связь пока не анализировалась.',
            recommendation: 'Дополните все части гипотезы текстом не менее 12 символов — затем AI проверит логику связи.',
        }));
    }
    const completeMetrics = metrics.filter(metric => text(metric.name) && text(metric.current) && text(metric.unit) && text(metric.target));
    if (!completeMetrics.length || completeMetrics.some(metric => !isSpecific(metric.name, 2) || !isSpecific(metric.target, 1))) {
        issues.push(issue({
            id: 'metrics-quality', step: 5, title: 'Нужно заполнить метрику',
            description: 'Формальная проверка не нашла полностью заполненную метрику либо обнаружила короткое или шаблонное название и целевое значение. Качество метрики пока не анализировалось.',
            recommendation: 'Укажите название, текущее и целевое значения и единицу измерения — затем запустится AI-проверка смысла.',
        }));
    }
    return issues;
}
