const GENERIC_VALUES = ['нет', 'не знаю', 'n/a', 'na', 'тест', 'текст', 'пример', 'что-то', 'что то'];

export const FORMAL_REVIEW_WARNING = 'AI-проверка пока не запускалась: сначала исправьте формальные признаки полей. После этого сервис проверит смысл описания.';

function text(value) {
    return String(value || '').trim();
}

export function hasValidAudience(audience) {
    return Array.isArray(audience) && audience.length > 0 && audience.length <= 10 && audience.every(segment =>
        segment && typeof segment === 'object' && ['Клиент', 'Сотрудник'].includes(segment.type) && text(segment.name) && (text(segment.count) || text(segment.share)),
    );
}

export function hasValidSituation(situation) {
    return situation && typeof situation === 'object' && !Array.isArray(situation)
        && typeof situation.businessInitiative === 'boolean'
        && Array.isArray(situation.problems)
        && situation.problems.length <= 10
        && (situation.businessInitiative || situation.problems.length > 0)
        && (situation.businessInitiative || situation.problems.every(problem => problem && typeof problem === 'object'
            && text(problem.context) && text(problem.difficulty) && text(problem.consequence) && text(problem.frequency)));
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

    const problems = Array.isArray(situation.problems) ? situation.problems : [];
    if (!situation.businessInitiative && problems.some(problem => !isSpecific(problem.context) || !isSpecific(problem.difficulty) || !isSpecific(problem.consequence))) {
        issues.push(issue({
            id: 'situation-specificity', step: 1, title: 'Нужна базовая детализация проблемы',
            description: 'Формальная проверка не подтвердила заполненность одного или нескольких полей в проблемах: текст короче 12 символов либо похож на шаблонный ответ. Смысл проблем на этом этапе не анализировался.',
            recommendation: 'Дополните контекст, затруднение и последствие конкретными формулировками в каждой проблеме — затем запустится AI-проверка смысла.',
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
