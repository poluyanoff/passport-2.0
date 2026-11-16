import {mountFlow} from './shell/FlowShell.js';
import {React, T} from './runtime.js';
import {about, spec} from './flow.content.js';
import './passport.css';

const h = React.createElement;
const TEXTAREA_HEIGHT = 104;
const STEPS = [
    ['problem', 'Кого касается проблема', 'Назовите сегмент и его размер'],
    ['solution', 'Что происходит', 'Опишите проблему'],
    ['src', 'Какие есть данные', 'Отметьте, какие источники смотрели, и добавьте ссылки на артефакты'],
    ['business', 'На что влияет в бизнесе', 'Отметьте, на что влияет проблема, и оставьте комментарий'],
    ['hyp', 'Что предлагается сделать', 'Опишите идею решения или пропустите, если ждёте решение от дизайнера'],
    ['metrics', 'Как оценим результат', 'Укажите метрики, по которым поймёте результат'],
    ['refs', 'Что уже сделано другими', 'Покажите аналоги и что берете из них в решение'],
    ['why', 'Когда нужен результат', 'Число, к которому дизайн должен быть готов'],
];
const SHARES = ['до 1%', '1–5%', '5–10%', '10–25%', '25–50%', 'более 50%'];
const SOURCES = ['Аналитика, выгрузка', 'Интервью с пользователями', 'Результат теста или A/B', 'Исследования', 'Обращения в поддержку', 'Проблема не требует подтверждения, опираемся на мнение команды'];
const OPINION_SOURCE = SOURCES[SOURCES.length - 1];
const BUSINESS_IMPACTS = ['Финансовые показатели', 'MAU, Retention', 'Репутация', 'ФОТ'];
const REFERENCES = ['Прямые конкуренты', 'Косвенные конкуренты', 'Аналоги внутри компании', 'Аналоги внутри отдела'];
const FREQUENCIES = ['Каждый день', 'Несколько раз в неделю', 'Несколько раз в месяц', 'Реже одного раза в месяц', 'Разово'];
const DATE_TYPES = ['Старт разработки', 'Передача в разработку', 'Демонстрация бизнесу', 'Запуск в прод'];
function PassportTextarea({label, labelOutside, value, onChange, disabled, invalid, error, placeholder, rows = 3, compact = false}) {
    return h(T.Textarea, {
        className: compact ? 'passport-textarea passport-textarea--compact' : 'passport-textarea',
        label, labelOutside, value, onChange, disabled, invalid, error, placeholder, rows,
        height: compact ? 52 : TEXTAREA_HEIGHT,
    });
}

function Passport({platform}) {
    const [step, setStep] = React.useState(0);
    const [showError, setShowError] = React.useState(false);
    const [sent, setSent] = React.useState(false);
    const [checking, setChecking] = React.useState(false);
    const [checkingProgress, setCheckingProgress] = React.useState(0);
    const [review, setReview] = React.useState(false);
    const [reviewStep, setReviewStep] = React.useState(null);
    const [reviewIssues, setReviewIssues] = React.useState([]);
    const [segment, setSegment] = React.useState({name: '', count: '', share: ''});
    const [context, setContext] = React.useState('');
    const [difficulty, setDifficulty] = React.useState('');
    const [consequence, setConsequence] = React.useState('');
    const [frequency, setFrequency] = React.useState('');
    const [businessInitiative, setBusinessInitiative] = React.useState(false);
    const [sources, setSources] = React.useState([]);
    const [sourceLinks, setSourceLinks] = React.useState('');
    const [businessComment, setBusinessComment] = React.useState('');
    const [businessImpacts, setBusinessImpacts] = React.useState([]);
    const [hypothesis, setHypothesis] = React.useState({if: '', then: '', because: ''});
    const [metrics, setMetrics] = React.useState([{name: '', current: '', target: ''}]);
    const [references, setReferences] = React.useState([]);
    const [referenceDetails, setReferenceDetails] = React.useState({});
    const [startDate, setStartDate] = React.useState(null);
    const [dateType, setDateType] = React.useState('');
    const [, title, description] = STEPS[step];
    const mobile = platform === 'mobile';
    const minStartDate = new Date().toISOString().slice(0, 10);

    React.useEffect(() => {
        if (!checking) return undefined;

        const startedAt = Date.now();
        const progressTimer = window.setInterval(() => {
            setCheckingProgress(Math.min((Date.now() - startedAt) / 5000, 0.96));
        }, 100);

        return () => {
            window.clearInterval(progressTimer);
        };
    }, [checking]);

    function toggle(setItems, item, checked) {
        setItems(current => checked ? [...current, item] : current.filter(value => value !== item));
    }

    function toggleSource(source, checked) {
        if (source === OPINION_SOURCE) {
            setSources(checked ? [OPINION_SOURCE] : []);
            return;
        }
        setSources(current => checked
            ? [...current.filter(value => value !== OPINION_SOURCE), source]
            : current.filter(value => value !== source),
        );
    }

    function updateMetric(index, key, value) {
        setMetrics(current => current.map((metric, metricIndex) => metricIndex === index ? {...metric, [key]: value} : metric));
    }

    function updateReference(reference, key, value) {
        setReferenceDetails(current => ({...current, [reference]: {...current[reference], [key]: value}}));
    }

    function validationError() {
        if (step === 0) {
            if (!segment.name.trim()) return {field: true};
            if (!segment.count.trim() && !segment.share) return {toast: 'Укажите размер сегмента: количество людей или долю аудитории'};
        }
        if (step === 1 && !businessInitiative && (!context.trim() || !difficulty.trim() || !consequence.trim() || !frequency)) return {field: true};
        if (step === 2 && !sources.length) return {toast: 'Выберите хотя бы один источник данных'};
        if (step === 3 && !businessImpacts.length && !businessComment.trim()) return {toast: 'Отметьте влияние на бизнес или добавьте комментарий'};
        if (step === 4) {
            if (!hypothesis.if.trim() || !hypothesis.then.trim() || !hypothesis.because.trim()) return {field: true};
        }
        if (step === 5) {
            if (!metrics.some(metric => metric.name.trim() && metric.current.trim() && metric.target.trim())) return {toast: 'Добавьте хотя бы одну метрику: название, текущее и целевое значение'};
        }
        if (step === 7 && (!startDate || startDate < minStartDate || !dateType.trim())) return {field: true};
        return null;
    }

    function next() {
        const validation = validationError();
        if (validation) {
            setShowError(true);
            if (validation.toast) T.showToast({label: validation.toast, icon: 'fixed-color/alert-negative'});
            return;
        }
        setShowError(false);
        if (reviewStep !== null) {
            setReviewStep(null);
            setReview(true);
        } else if (step === STEPS.length - 1) void startReview();
        else setStep(current => current + 1);
    }

    function skip() {
        setShowError(false);
        setStep(current => current + 1);
    }

    function editReviewIssue(issue) {
        setReview(false);
        setReviewStep(issue.step);
        setShowError(false);
        setStep(issue.step);
    }

    function finishReview() {
        setReview(false);
        setSent(true);
    }

    function reviewPayload() {
        return {
            passport: {
                audience: segment,
                situation: {context, difficulty, consequence, frequency, businessInitiative},
                sources: {items: sources, links: sourceLinks},
                business: {impacts: businessImpacts, comment: businessComment},
                hypothesis,
                metrics,
                references: references.map(reference => ({name: reference, ...referenceDetails[reference]})),
                deadline: {date: startDate, type: dateType},
            },
        };
    }

    async function startReview() {
        setCheckingProgress(0);
        setChecking(true);
        try {
            const response = await fetch('/api/review', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(reviewPayload()),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось проверить описание');
            setReviewIssues(Array.isArray(data.issues) ? data.issues : []);
            if (data.warning) T.showToast({label: data.warning, icon: 'fixed-color/alert-negative'});
            setCheckingProgress(1);
            setReview(true);
        } catch (error) {
            T.showToast({label: error.message || 'Не удалось проверить описание. Попробуйте ещё раз.', icon: 'fixed-color/alert-negative'});
        } finally {
            setChecking(false);
        }
    }

    function reset() {
        setStep(0); setShowError(false); setSent(false); setChecking(false); setCheckingProgress(0); setReview(false); setReviewStep(null); setReviewIssues([]);
        setSegment({name: '', count: '', share: ''}); setContext(''); setDifficulty(''); setConsequence(''); setFrequency(''); setBusinessInitiative(false);
        setSources([]); setSourceLinks(''); setBusinessComment(''); setBusinessImpacts([]);
        setHypothesis({if: '', then: '', because: ''}); setMetrics([{name: '', current: '', target: ''}]);
        setReferences([]); setReferenceDetails({}); setStartDate(null); setDateType('');
    }

    const fields = step === 0
        ? h('div', {className: 'passport-fields'},
            h('section', {className: 'passport-segment'}, h('div', {className: 'passport-segment-fields'},
                h(T.Input, {label: 'Сегмент', value: segment.name, onChange: value => setSegment(current => ({...current, name: value})), invalid: showError && !segment.name.trim(), error: showError && !segment.name.trim() ? 'Укажите сегмент' : undefined, placeholder: 'Новые селлеры на\u00a0подключении'}),
                h(T.Input, {label: 'Сколько человек', value: segment.count, onChange: value => setSegment(current => ({...current, count: value})), placeholder: 'Около 1 000 в\u00a0квартал'}),
                h(T.Select, {label: 'Доля от общей аудитории', value: segment.share, onChange: value => setSegment(current => ({...current, share: value})), items: SHARES, placeholder: 'Выберите долю'}),
            )),
        )
        : step === 1
            ? h('div', {className: 'passport-fields'},
                h(T.Checkbox, {label: 'Явной проблемы нет, есть инициатива бизнеса', checked: businessInitiative, onChange: setBusinessInitiative}),
                h(T.Input, {label: 'В каком контексте', value: context, onChange: setContext, disabled: businessInitiative, invalid: showError && !businessInitiative && !context.trim(), error: showError && !businessInitiative && !context.trim() ? 'Опишите контекст' : undefined, placeholder: 'При ежедневной проверке финансовых показателей'}),
                h(PassportTextarea, {label: 'С каким затруднением сталкивается', value: difficulty, onChange: setDifficulty, disabled: businessInitiative, invalid: showError && !businessInitiative && !difficulty.trim(), error: showError && !businessInitiative && !difficulty.trim() ? 'Опишите затруднение' : undefined, placeholder: 'Вынужден вручную сравнивать данные за разные периоды', compact: true}),
                h(PassportTextarea, {label: 'К чему это приводит', value: consequence, onChange: setConsequence, disabled: businessInitiative, invalid: showError && !businessInitiative && !consequence.trim(), error: showError && !businessInitiative && !consequence.trim() ? 'Опишите последствие' : undefined, placeholder: 'Тратит больше времени и может поздно заметить снижение прибыли', compact: true}),
                h(T.Select, {label: 'Как часто это происходит', value: frequency, onChange: setFrequency, disabled: businessInitiative, invalid: showError && !businessInitiative && !frequency, error: showError && !businessInitiative && !frequency ? 'Выберите частоту' : undefined, items: FREQUENCIES, placeholder: 'Выберите частоту'}),
            )
        : step === 2
            ? h('div', {className: 'passport-fields'},
                h('div', {className: 'passport-choices'}, SOURCES.map(source => h(T.Checkbox, {key: source, label: source, checked: sources.includes(source), disabled: sources.includes(OPINION_SOURCE) && source !== OPINION_SOURCE, onChange: checked => toggleSource(source, checked)}))),
                sources.some(source => source !== OPINION_SOURCE) && h(PassportTextarea, {label: 'Примеры и ссылки', value: sourceLinks, onChange: setSourceLinks, placeholder: 'Ссылки на выгрузки, интервью, исследования или результаты тестов'}),
            )
            : step === 3
                ? h('div', {className: 'passport-fields'},
                    h('div', {className: 'passport-choices'}, BUSINESS_IMPACTS.map(impact => h(T.Checkbox, {key: impact, label: impact, checked: businessImpacts.includes(impact), onChange: checked => toggle(setBusinessImpacts, impact, checked)}))),
                    h(PassportTextarea, {label: 'Комментарий', value: businessComment, onChange: setBusinessComment, placeholder: 'Опишите, как проблема влияет на бизнес: потери, обращения, затраты или другие последствия'}),
                )
                : step === 4
                    ? h('div', {className: 'passport-fields'},
                        h(PassportTextarea, {label: 'Если', value: hypothesis.if, onChange: value => setHypothesis(current => ({...current, if: value})), invalid: showError && !hypothesis.if.trim(), error: showError && !hypothesis.if.trim() ? 'Опишите действие' : undefined, placeholder: 'Добавим в отчёт сравнение показателей за разные периоды', rows: 2, compact: true}),
                        h(PassportTextarea, {label: 'То', value: hypothesis.then, onChange: value => setHypothesis(current => ({...current, then: value})), invalid: showError && !hypothesis.then.trim(), error: showError && !hypothesis.then.trim() ? 'Опишите ожидаемый результат' : undefined, placeholder: 'Пользователь быстрее заметит изменение показателей', rows: 2, compact: true}),
                        h(PassportTextarea, {label: 'Потому что', value: hypothesis.because, onChange: value => setHypothesis(current => ({...current, because: value})), invalid: showError && !hypothesis.because.trim(), error: showError && !hypothesis.because.trim() ? 'Объясните причину' : undefined, placeholder: 'Не придётся вручную собирать и сравнивать данные', rows: 2, compact: true}),
                    )
                    : step === 5
                        ? h('div', {className: 'passport-fields'},
                        h('div', {className: 'passport-metrics'}, metrics.map((metric, index) => h('section', {className: 'passport-metric', key: index},
                            h('div', {className: 'passport-metric-row'},
                                h('div', {className: 'passport-metric-fields'},
                                    h(T.Input, {label: 'Ключевая метрика', value: metric.name, onChange: value => updateMetric(index, 'name', value)}),
                                    h(T.Input, {label: 'Сейчас', value: metric.current, onChange: value => updateMetric(index, 'current', value)}),
                                    h(T.Input, {label: 'Цель', value: metric.target, onChange: value => updateMetric(index, 'target', value)}),
                                ),
                                metrics.length > 1 && h(T.Button, {appearance: 'flat', size: 'm', icon: 'small-pragmatic/trash', title: 'Удалить метрику', ariaLabel: 'Удалить метрику', onClick: () => setMetrics(current => current.filter((_, metricIndex) => metricIndex !== index))}),
                            ),
                        ))),
                        h('button', {type: 'button', className: 'passport-add-metric', onClick: () => setMetrics(current => [...current, {name: '', current: '', target: ''}])},
                            h('span', {className: 'passport-add-metric__icon', 'aria-hidden': true}, h(T.Icon, {name: 'small-pragmatic/plus', size: 24})),
                            h('span', {className: 'tui-ui-m'}, 'Добавить метрику'),
                        ),
                    )
                    : step === 6
                        ? h('div', {className: 'passport-fields'}, REFERENCES.map(reference => h('section', {className: 'passport-reference', key: reference},
                            h(T.Checkbox, {label: reference, checked: references.includes(reference), onChange: checked => toggle(setReferences, reference, checked)}),
                            references.includes(reference) && h('div', {className: 'passport-reference-fields'},
                                h(T.Input, {label: 'Ссылки', value: referenceDetails[reference]?.links || '', onChange: value => updateReference(reference, 'links', value)}),
                                h(T.Input, {label: 'Что берем и почему', value: referenceDetails[reference]?.take || '', onChange: value => updateReference(reference, 'take', value)}),
                            ),
                        )))
                        : h('div', {className: 'passport-fields passport-date'}, h('div', {className: 'passport-date-fields'},
                            h(T.InputDate, {label: 'Дата', value: startDate, onChange: value => setStartDate(value), min: minStartDate, error: showError && (!startDate || startDate < minStartDate) ? 'Укажите дату не раньше сегодняшней' : undefined}),
                            h(T.Combobox, {label: 'Что за дата', value: dateType, onChange: value => setDateType(String(value || '')), items: DATE_TYPES, placeholder: 'Выберите или впишите', error: showError && !dateType.trim() ? 'Укажите, что произойдёт в эту дату' : undefined}),
                        ));

    function epicDescription() {
        return [
            '## Аудитория',
            [segment.name, segment.count, segment.share].filter(Boolean).join(' · '),
            '', '## Контекст', context,
            '', '## Затруднение', difficulty,
            '', '## Последствие', consequence,
            frequency ? `\nЧастота: ${frequency}` : '',
            '', '## Подтверждение', sources.join(', '), sourceLinks,
            '', '## Влияние на бизнес', businessImpacts.join(', '), businessComment,
            '', '## Гипотеза', [hypothesis.if, hypothesis.then, hypothesis.because].filter(Boolean).join(' → '),
            '', '## Метрики', ...metrics.map(metric => [metric.name, metric.current, metric.target].filter(Boolean).join(' — ')),
            '', '## Срок', [dateType, startDate].filter(Boolean).join(' — '),
        ].filter(Boolean).join('\n');
    }

    async function copyEpicDescription() {
        await navigator.clipboard.writeText(epicDescription());
        T.showToast({label: 'Описание скопировано', icon: 'fixed-color/check-circle-positive'});
    }

    if (checking) return h(T.Dialog, {open: true, inline: true, fullscreen: true, closeButton: false, platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined}, h(T.BlockStatus, {type: 'fullscreen', preset: 'process', animation: 'business', image: false, title: 'Проверяем описание', text: 'Ищем, что можно улучшить перед отправкой дизайнеру', progress: checkingProgress}));

    if (review) return h(T.Dialog, {
        open: true, inline: true, fullscreen: true, closeButton: false,
        platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined,
        title: 'Результаты проверки', description: 'Вот что стоит уточнить перед отправкой дизайнеру',
        stickyFooter: true, actions: [{label: 'Отправить дизайнеру', onClick: finishReview}],
    }, h('div', {className: 'passport-review'}, reviewIssues.length
        ? reviewIssues.map(issue => h(T.CardLarge, {
        key: issue.id, appearance: 'flat', space: 'compact', title: issue.title, description: issue.description,
        footer: h(T.Button, {appearance: 'secondary', size: 'm', onClick: () => editReviewIssue(issue)}, 'Исправить'), footerKind: 'buttons',
        }))
        : h(T.CardLarge, {appearance: 'flat', space: 'compact', title: 'Всё готово', description: 'Замечаний по содержанию нет. Можно отправить описание дизайнеру.'})));

    if (sent) return h(T.Dialog, {open: true, inline: true, fullscreen: true, closeButton: false, platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined}, h(T.BlockStatus, {type: 'fullscreen', kind: 'result', image: 'check', title: 'Задача описана', text: 'Вставьте описание в эпик в поле Description', actions: [{label: 'Скопировать описание', icon: 'small-pragmatic/copy', onClick: copyEpicDescription}, {label: 'Заполнить заново', appearance: 'secondary', onClick: reset}]}));

    return h(T.Dialog, {
        open: true, inline: true, fullscreen: true, closeButton: false,
        platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined,
        title, description, progress: (step + 1) / STEPS.length, step, stepDirection: 'forward',
        onBack: step ? () => { setShowError(false); setStep(current => current - 1); } : undefined,
        stickyFooter: true,
        actions: [
            (step === 4 || step === 6) && {label: 'Пропустить', appearance: 'flat', onClick: skip},
            {label: reviewStep !== null ? 'Готово' : step === STEPS.length - 1 ? 'Отправить дизайнеру' : 'Дальше', onClick: next},
        ].filter(Boolean),
    }, fields);
}

export function Mobile() { return h(Passport, {platform: 'mobile'}); }
export function Desktop() { return h(Passport, {platform: 'desktop'}); }

mountFlow(document.getElementById('root'), {
    title: 'Паспорт дизайн-задачи', baseUrl: new URL('/', window.location.origin), resetKeys: [],
    solution: {mobile: Mobile, desktop: Desktop}, bare: true, about, spec,
});
