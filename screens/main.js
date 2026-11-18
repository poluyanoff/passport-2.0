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
const FREQUENCIES = ['Несколько раз в день', 'Раз в день', 'Несколько раз в неделю', 'Несколько раз в месяц', 'Раз в месяц', 'Раз в квартал', 'Разово'];
const DATE_TYPES = ['Старт разработки', 'Передача в разработку', 'Демонстрация бизнесу', 'Запуск в прод'];
const METRIC_UNITS = ['%', '₽', 'шт.', 'обращения', 'заявки'];
const MAX_HYPOTHESES = 10;
let entitySequence = 0;

function createEntityId(prefix) {
    entitySequence += 1;
    return `${prefix}-${Date.now()}-${entitySequence}`;
}

function createHypothesis() {
    return {id: createEntityId('hypothesis'), if: '', then: '', because: ''};
}

function createMetric() {
    return {id: createEntityId('metric'), name: '', current: '', unit: '', currentDate: null, target: ''};
}

function parseMetricValue(value) {
    const normalized = String(value || '').trim().replace(',', '.');
    return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function formatMetricValue(value) {
    return new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(value);
}

function metricDelta(metric) {
    const current = parseMetricValue(metric.current);
    const target = parseMetricValue(metric.target);
    if (current === null || target === null) return null;

    const difference = target - current;
    const sign = difference > 0 ? '+' : '';
    const absoluteUnit = metric.unit === '%' ? ' п.п.' : metric.unit ? ` ${metric.unit}` : '';
    const absolute = `${sign}${formatMetricValue(difference)}${absoluteUnit}`;
    if (current === 0) return `(${absolute})`;

    const relative = difference / Math.abs(current);
    const multiplier = target / current;
    const relativeSign = relative > 0 ? '+' : '';
    return `(${absolute}, ${relativeSign}${formatMetricValue(relative * 100)}%, ×${formatMetricValue(multiplier)})`;
}

function metricRange(metric) {
    const current = parseMetricValue(metric.current);
    const target = parseMetricValue(metric.target);
    if (current === null || target === null) return null;
    return `${formatMetricValue(current)} → ${formatMetricValue(target)}${metric.unit ? ` ${metric.unit}` : ''}`;
}

function useEntityCollection(createEntity, limit = Infinity) {
    const [items, setItems] = React.useState([]);
    const [draft, setDraft] = React.useState(null);

    function add() {
        if (items.length >= limit) return false;
        setDraft(createEntity());
        return true;
    }

    function edit(item) {
        setDraft({...item});
    }

    function save(item) {
        setItems(current => current.some(currentItem => currentItem.id === item.id)
            ? current.map(currentItem => currentItem.id === item.id ? item : currentItem)
            : [...current, item],
        );
        setDraft(null);
    }

    function remove(id) {
        setItems(current => current.filter(item => item.id !== id));
        setDraft(null);
    }

    return {items, draft, add, edit, save, remove, cancel: () => setDraft(null), reset: () => { setItems([]); setDraft(null); }};
}

function PassportTextarea({label, labelOutside, value, onChange, disabled, invalid, error, placeholder, rows = 3, compact = false}) {
    return h(T.Textarea, {
        className: compact ? 'passport-textarea passport-textarea--compact' : 'passport-textarea',
        label, labelOutside, labelOff: true, value, onChange, disabled, invalid, error, placeholder: label || placeholder, rows,
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
    const hypotheses = useEntityCollection(createHypothesis, MAX_HYPOTHESES);
    const [showHypothesisError, setShowHypothesisError] = React.useState(false);
    const metrics = useEntityCollection(createMetric);
    const [showMetricError, setShowMetricError] = React.useState(false);
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

    function updateReference(reference, key, value) {
        setReferenceDetails(current => ({...current, [reference]: {...current[reference], [key]: value}}));
    }

    function openHypothesisEditor() {
        if (!hypotheses.add()) T.showToast({label: `Можно добавить не больше ${MAX_HYPOTHESES} гипотез`, icon: 'fixed-color/alert-negative'});
        setShowHypothesisError(false);
    }

    function editHypothesis(hypothesis) {
        hypotheses.edit(hypothesis);
        setShowHypothesisError(false);
    }

    function updateHypothesis(key, value) {
        hypotheses.draft && hypotheses.edit({...hypotheses.draft, [key]: value});
    }

    function saveHypothesis() {
        const hypothesis = hypotheses.draft;
        if (!hypothesis) return;
        if (!hypothesis.if.trim() || !hypothesis.then.trim() || !hypothesis.because.trim()) {
            setShowHypothesisError(true);
            return;
        }
        hypotheses.save(hypothesis);
        setShowHypothesisError(false);
    }

    function openMetricEditor() {
        metrics.add();
        setShowMetricError(false);
    }

    function editMetric(metric) {
        metrics.edit(metric);
        setShowMetricError(false);
    }

    function updateMetric(key, value) {
        metrics.draft && metrics.edit({...metrics.draft, [key]: value});
    }

    function saveMetric() {
        const metric = metrics.draft;
        if (!metric) return;
        if (!metric.name.trim() || !metric.current.trim() || !metric.unit.trim() || !metric.target.trim()) {
            setShowMetricError(true);
            return;
        }
        metrics.save(metric);
        setShowMetricError(false);
    }

    function validationError() {
        if (step === 0) {
            if (!segment.name.trim()) return {field: true};
            if (!segment.count.trim() && !segment.share) return {toast: 'Укажите размер сегмента: количество людей или долю аудитории'};
        }
        if (step === 1 && !businessInitiative && (!context.trim() || !difficulty.trim() || !consequence.trim() || !frequency)) return {field: true};
        if (step === 2 && !sources.length) return {toast: 'Выберите хотя бы один источник данных'};
        if (step === 3 && !businessImpacts.length && !businessComment.trim()) return {toast: 'Отметьте влияние на бизнес или добавьте комментарий'};
        if (step === 5) {
            if (!metrics.items.some(metric => metric.name.trim() && metric.current.trim() && metric.unit.trim() && metric.target.trim())) return {toast: 'Добавьте хотя бы одну метрику: название, текущее значение, единицу измерения и цель'};
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
                hypotheses: hypotheses.items.map(({id, ...hypothesis}) => hypothesis),
                metrics: metrics.items.map(({id, ...metric}) => metric),
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
            const source = await response.text();
            let data;
            try {
                data = JSON.parse(source);
            } catch {
                throw new Error('Сервер вернул ответ в неверном формате. Откройте приложение через npm run dev.');
            }
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
        hypotheses.reset(); setShowHypothesisError(false); metrics.reset(); setShowMetricError(false);
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
                h(T.Input, {label: 'В каком контексте', value: context, onChange: setContext, disabled: businessInitiative, invalid: showError && !businessInitiative && !context.trim(), error: showError && !businessInitiative && !context.trim() ? 'Опишите контекст' : undefined, placeholder: 'При ежедневной проверке финансовых показателей'}),
                h(PassportTextarea, {label: 'С каким затруднением сталкивается', value: difficulty, onChange: setDifficulty, disabled: businessInitiative, invalid: showError && !businessInitiative && !difficulty.trim(), error: showError && !businessInitiative && !difficulty.trim() ? 'Опишите затруднение' : undefined, placeholder: 'Вынужден вручную сравнивать данные за разные периоды', compact: true}),
                h(PassportTextarea, {label: 'К чему это приводит', value: consequence, onChange: setConsequence, disabled: businessInitiative, invalid: showError && !businessInitiative && !consequence.trim(), error: showError && !businessInitiative && !consequence.trim() ? 'Опишите последствие' : undefined, placeholder: 'Тратит больше времени и может поздно заметить снижение прибыли', compact: true}),
                h(T.Select, {label: 'Как часто это происходит', value: frequency, onChange: setFrequency, disabled: businessInitiative, invalid: showError && !businessInitiative && !frequency, error: showError && !businessInitiative && !frequency ? 'Выберите частоту' : undefined, items: FREQUENCIES, placeholder: 'Выберите частоту'}),
                h(T.Checkbox, {label: 'Явных проблем у пользователей нет. Задача — инициатива бизнеса', checked: businessInitiative, onChange: setBusinessInitiative}),
            )
        : step === 2
            ? h('div', {className: 'passport-fields'},
                h('div', {className: 'passport-choices'}, SOURCES.map(source => h(T.Checkbox, {key: source, label: source, checked: sources.includes(source), disabled: sources.includes(OPINION_SOURCE) && source !== OPINION_SOURCE, onChange: checked => toggleSource(source, checked)}))),
                h(PassportTextarea, {label: 'Комментарии и ссылки на артефакты', value: sourceLinks, onChange: setSourceLinks, placeholder: 'Ссылки на выгрузки, интервью, исследования или результаты тестов'}),
            )
            : step === 3
                ? h('div', {className: 'passport-fields'},
                    h('div', {className: 'passport-choices'}, BUSINESS_IMPACTS.map(impact => h(T.Checkbox, {key: impact, label: impact, checked: businessImpacts.includes(impact), onChange: checked => toggle(setBusinessImpacts, impact, checked)}))),
                    h(PassportTextarea, {label: 'Комментарий', value: businessComment, onChange: setBusinessComment, placeholder: 'Опишите, как проблема влияет на бизнес: потери, обращения, затраты или другие последствия'}),
                )
                : step === 4
                    ? h('div', {className: 'passport-hypotheses'},
                        h('button', {type: 'button', className: 'passport-add-metric passport-add-hypothesis', onClick: openHypothesisEditor},
                            h('span', {className: 'passport-add-metric__icon', 'aria-hidden': true}, h(T.Icon, {name: 'small-pragmatic/plus', size: 24})),
                            h('span', {className: 'tui-ui-m'}, 'Добавить гипотезу'),
                        ),
                        h('div', {className: 'passport-hypothesis-list'}, hypotheses.items.map((hypothesis, index) => h(T.Cell, {
                            key: hypothesis.id, avatar: 'lightbulb', avatarTone: 'accent-2', title: `Гипотеза ${index + 1}`,
                            description: [hypothesis.if, hypothesis.then, hypothesis.because].join(' → '),
                            onClick: () => editHypothesis(hypothesis),
                        }))),
                    )
                    : step === 5
                        ? h('div', {className: 'passport-metrics'},
                        h('button', {type: 'button', className: 'passport-add-metric', onClick: openMetricEditor},
                            h('span', {className: 'passport-add-metric__icon', 'aria-hidden': true}, h(T.Icon, {name: 'small-pragmatic/plus', size: 24})),
                            h('span', {className: 'tui-ui-m'}, 'Добавить метрику'),
                        ),
                        h('div', {className: 'passport-metric-list'}, metrics.items.map((metric, index) => {
                            const delta = metricDelta(metric);
                            return h(T.Cell, {
                                key: metric.id, avatar: 'note-percent', avatarTone: 'accent-2', title: metric.name,
                                description: [metricRange(metric), delta].filter(Boolean).join(' '),
                                onClick: () => editMetric(metric),
                            });
                        })),
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
            'Аудитория',
            [segment.name, segment.count, segment.share].filter(Boolean).join(' · '),
            '', 'Контекст', context,
            '', 'Затруднение', difficulty,
            '', 'Последствие', consequence,
            frequency ? `\nЧастота: ${frequency}` : '',
            '', 'Подтверждение', sources.join(', '), sourceLinks,
            '', 'Влияние на бизнес', businessImpacts.join(', '), businessComment,
            ...(hypotheses.items.length ? ['', 'Гипотезы', ...hypotheses.items.map((hypothesis, index) => `${index + 1}. ${[hypothesis.if, hypothesis.then, hypothesis.because].filter(Boolean).join(' → ')}`)] : []),
            '', 'Метрики', ...metrics.items.map(metric => [metric.name, metric.current, metric.unit, metric.currentDate, metric.target].filter(Boolean).join(' — ')),
            '', 'Срок', [dateType, startDate].filter(Boolean).join(' — '),
        ].filter(Boolean).join('\n');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
    }

    function epicDescriptionHtml() {
        const section = (title, content) => content ? `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>` : '';
        const list = (title, items, tag) => items.length ? `<h2>${title}</h2><${tag}>${items.map(item => `<li>${escapeHtml(item).replace(/\n/g, '<br>')}</li>`).join('')}</${tag}>` : '';
        return [
            section('Аудитория', [segment.name, segment.count, segment.share].filter(Boolean).join(' · ')),
            section('Контекст', context), section('Затруднение', difficulty), section('Последствие', [consequence, frequency && `Частота: ${frequency}`].filter(Boolean).join('\n')),
            section('Подтверждение', [sources.join(', '), sourceLinks].filter(Boolean).join('\n')),
            section('Влияние на бизнес', [businessImpacts.join(', '), businessComment].filter(Boolean).join('\n')),
            list('Гипотезы', hypotheses.items.map(hypothesis => [hypothesis.if, hypothesis.then, hypothesis.because].filter(Boolean).join(' → ')), 'ol'),
            list('Метрики', metrics.items.map(metric => [metric.name, metric.current, metric.unit, metric.currentDate, metric.target].filter(Boolean).join(' — ')), 'ul'),
            section('Срок', [dateType, startDate].filter(Boolean).join(' — ')),
        ].filter(Boolean).join('');
    }

    async function copyEpicDescription() {
        const text = epicDescription();
        if (navigator.clipboard?.write && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({
            'text/plain': new Blob([text], {type: 'text/plain'}),
            'text/html': new Blob([epicDescriptionHtml()], {type: 'text/html'}),
        })]);
        else await navigator.clipboard.writeText(text);
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

    const isExistingHypothesis = hypotheses.draft && hypotheses.items.some(hypothesis => hypothesis.id === hypotheses.draft.id);
    const closeHypothesisEditor = () => { hypotheses.cancel(); setShowHypothesisError(false); };
    const hypothesisEditor = hypotheses.draft && h(T.Dialog, {
        open: true, size: 'l', title: 'Гипотеза', description: 'Какое решение может решить проблему',
        onClose: closeHypothesisEditor,
        actions: [
            !isExistingHypothesis && {label: 'Отмена', appearance: 'flat', onClick: closeHypothesisEditor},
            isExistingHypothesis && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { hypotheses.remove(hypotheses.draft.id); setShowHypothesisError(false); }},
            {label: 'Сохранить', onClick: saveHypothesis},
        ].filter(Boolean),
    }, h('div', {className: 'passport-fields'},
        h(PassportTextarea, {label: 'Если', value: hypotheses.draft.if, onChange: value => updateHypothesis('if', value), invalid: showHypothesisError && !hypotheses.draft.if.trim(), error: showHypothesisError && !hypotheses.draft.if.trim() ? 'Опишите действие' : undefined, placeholder: 'Добавим в отчёт сравнение показателей за разные периоды', rows: 2, compact: true}),
        h(PassportTextarea, {label: 'То', value: hypotheses.draft.then, onChange: value => updateHypothesis('then', value), invalid: showHypothesisError && !hypotheses.draft.then.trim(), error: showHypothesisError && !hypotheses.draft.then.trim() ? 'Опишите ожидаемый результат' : undefined, placeholder: 'Пользователь быстрее заметит изменение показателей', rows: 2, compact: true}),
        h(PassportTextarea, {label: 'Потому что', value: hypotheses.draft.because, onChange: value => updateHypothesis('because', value), invalid: showHypothesisError && !hypotheses.draft.because.trim(), error: showHypothesisError && !hypotheses.draft.because.trim() ? 'Объясните причину' : undefined, placeholder: 'Не придётся вручную собирать и сравнивать данные', rows: 2, compact: true}),
    ));

    const isExistingMetric = metrics.draft && metrics.items.some(metric => metric.id === metrics.draft.id);
    const closeMetricEditor = () => { metrics.cancel(); setShowMetricError(false); };
    const metricEditor = metrics.draft && h(T.Dialog, {
        open: true, size: 'l', title: 'Метрика', description: 'Как поймём, что решение сработало',
        onClose: closeMetricEditor,
        actions: [
            !isExistingMetric && {label: 'Отмена', appearance: 'flat', onClick: closeMetricEditor},
            isExistingMetric && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { metrics.remove(metrics.draft.id); setShowMetricError(false); }},
            {label: 'Сохранить', onClick: saveMetric},
        ].filter(Boolean),
    }, h('div', {className: 'passport-metric-fields'},
        h(T.Input, {label: 'Ключевая метрика', value: metrics.draft.name, onChange: value => updateMetric('name', value), invalid: showMetricError && !metrics.draft.name.trim(), error: showMetricError && !metrics.draft.name.trim() ? 'Укажите метрику' : undefined}),
        h('div', {className: 'passport-metric-details'},
            h(T.Input, {label: 'Текущее значение', value: metrics.draft.current, onChange: value => updateMetric('current', value), invalid: showMetricError && !metrics.draft.current.trim(), error: showMetricError && !metrics.draft.current.trim() ? 'Укажите текущее значение' : undefined, placeholder: '10'}),
            h(T.Combobox, {label: 'Единица измерения', value: metrics.draft.unit, onChange: value => updateMetric('unit', String(value || '')), items: METRIC_UNITS, invalid: showMetricError && !metrics.draft.unit.trim(), error: showMetricError && !metrics.draft.unit.trim() ? 'Укажите единицу измерения' : undefined, placeholder: 'Выберите или впишите'}),
            h(T.InputDate, {label: 'Дата', value: metrics.draft.currentDate, onChange: value => updateMetric('currentDate', value)}),
            h('div', {className: 'passport-metric-target'},
                h(T.Input, {label: 'Целевое значение', value: metrics.draft.target, onChange: value => updateMetric('target', value), invalid: showMetricError && !metrics.draft.target.trim(), error: showMetricError && !metrics.draft.target.trim() ? 'Укажите целевое значение' : undefined, placeholder: '13'}),
                metricDelta(metrics.draft) && h('div', {className: 'passport-metric-delta tui-ui-s'}, metricDelta(metrics.draft)),
            ),
        ),
    ));

    return h(React.Fragment, null, h(T.Dialog, {
        open: true, inline: true, fullscreen: true, closeButton: false,
        platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined,
        title, description,
        progress: (step + 1) / STEPS.length, step, stepDirection: 'forward',
        onBack: step ? () => { setShowError(false); setStep(current => current - 1); } : undefined,
        stickyFooter: true,
        actions: [
            (step === 4 || step === 6) && {label: 'Пропустить', appearance: 'flat', onClick: skip},
            {label: reviewStep !== null ? 'Готово' : step === STEPS.length - 1 ? 'Проверить задачу' : 'Дальше', onClick: next},
        ].filter(Boolean),
    }, fields), hypothesisEditor, metricEditor);
}

export function Mobile() { return h(Passport, {platform: 'mobile'}); }
export function Desktop() { return h(Passport, {platform: 'desktop'}); }

mountFlow(document.getElementById('root'), {
    title: 'Паспорт дизайн-задачи', baseUrl: new URL('/', window.location.origin), resetKeys: [],
    solution: {mobile: Mobile, desktop: Desktop}, bare: true, about, spec,
});
