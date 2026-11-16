const GENERIC_VALUES = ['нет', 'не знаю', 'n/a', 'na', 'тест', 'текст', 'пример', 'что-то', 'что то'];

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
    const hypothesis = passport.hypothesis || {};
    const metrics = Array.isArray(passport.metrics) ? passport.metrics : [];

    if (!situation.businessInitiative && (!isSpecific(situation.context) || !isSpecific(situation.difficulty) || !isSpecific(situation.consequence))) {
        issues.push(issue({
            id: 'situation-specificity', step: 1, title: 'Что происходит',
            description: 'Добавьте больше конкретики: в каком контексте возникает проблема, с каким затруднением сталкивается человек и к чему это приводит.',
            recommendation: 'Опишите ситуацию через действие пользователя, препятствие и последствие.',
        }));
    }
    if (!business.impacts?.length && !isSpecific(business.comment)) {
        issues.push(issue({
            id: 'business-impact', step: 3, title: 'На что влияет в бизнесе',
            description: 'Неясно, на что именно влияет проблема для бизнеса.',
            recommendation: 'Отметьте область влияния или опишите последствия в комментарии.',
        }));
    }
    if (text(hypothesis.if) || text(hypothesis.then) || text(hypothesis.because)) {
        if (!isSpecific(hypothesis.if) || !isSpecific(hypothesis.then) || !isSpecific(hypothesis.because)) {
            issues.push(issue({
                id: 'hypothesis-specificity', step: 4, title: 'Что предлагается сделать',
                description: 'Гипотеза сформулирована слишком общо — связь между действием, результатом и причиной не читается.',
                recommendation: 'Уточните, что именно изменится для пользователя и почему это даст ожидаемый результат.',
            }));
        }
    }
    const completeMetrics = metrics.filter(metric => text(metric.name) && text(metric.current) && text(metric.target));
    if (!completeMetrics.length || completeMetrics.some(metric => !isSpecific(metric.name, 2) || !isSpecific(metric.target, 1))) {
        issues.push(issue({
            id: 'metrics-quality', step: 5, title: 'Как оценим результат',
            description: 'Сформулируйте метрики так, чтобы по ним можно было однозначно оценить результат.',
            recommendation: 'Укажите название метрики, её текущее и целевое значение.',
        }));
    }
    return issues;
}
