import {mountFlow} from './shell/FlowShell.js';
import {React, T} from './runtime.js';
import {about, spec} from './flow.content.js';
import {ControlRenderer, Folder, useDialKitController} from 'dialkit';
import './passport.css';
import 'dialkit/styles.css';

const h = React.createElement;
const TEXTAREA_HEIGHT = 64;
const STEPS = [
    ['problem', 'Кого касается проблема', 'Опишите аудиторию и её размер'],
    ['solution', 'Что происходит', 'Опишите проблемы пользователей'],
    ['src', 'Какие есть данные', 'Отметьте, какие источники смотрели, и добавьте ссылки на артефакты'],
    ['business', 'Зачем это бизнесу', 'Во что инвестируем ресурсы команды'],
    ['hyp', 'Что предлагается сделать', 'Опишите идею решения или пропустите, если ждёте решение от дизайнера'],
    ['metrics', 'Как оценим результат', 'Укажите метрики, по которым поймёте результат'],
    ['refs', 'Что уже сделано другими', 'Покажите аналоги и что берете из них в решение'],
    ['why', 'Когда нужен результат', 'Число, к которому дизайн должен быть готов'],
];
const SHARES = ['до 1%', '1–5%', '5–10%', '10–25%', '25–50%', 'более 50%'];
const SEGMENT_TYPES = ['Клиент', 'Сотрудник'];
const SOURCES = ['Аналитика, выгрузка', 'Интервью с пользователями', 'Результат теста или A/B', 'Исследования', 'Обращения в поддержку', 'Экспертная оценка команды'];
const BUSINESS_IMPACTS = [
    'Нарастить объём продаж и выручку',
    'Увеличить активность и охват аудитории',
    'Улучшить удержание пользователей / снизить отток',
    'Оптимизировать воронку',
    'Улучшить CX',
    'Ускорить получение ценности от продукта',
    'Довести до маркет-нормал',
    'Избежать репутационных рисков',
    'Снизить затраты на ФОТ',
    'Соблюсти регуляторные требования',
    'Снизить клиентский негатив',
];
const REFERENCES = ['Прямые конкуренты', 'Косвенные конкуренты', 'Аналоги внутри компании', 'Аналоги внутри отдела'];
const FREQUENCIES = ['Несколько раз в день', 'Раз в день', 'Несколько раз в неделю', 'Несколько раз в месяц', 'Раз в месяц', 'Раз в квартал', 'Разово'];
const DATE_TYPES = ['Старт разработки', '3 амиго', 'Демонстрация бизнесу', 'Запуск в прод'];
const METRIC_UNITS = ['%', '₽', 'шт.', 'обращения', 'заявки', 'человек'];
const MAX_SEGMENTS = 10;
const MAX_PROBLEMS = 10;
const MAX_HYPOTHESES = 10;
const EXAMPLE_DIAL_ID = 'passport-examples';
const EXAMPLE_DIAL_CONFIG = {
    good: {type: 'action', label: 'Хороший пример'},
    fallback: {type: 'action', label: 'Падает на fallback'},
    ai: {type: 'action', label: 'Падает на AI-проверке'},
};
const EXAMPLE_DIAL_CONTROLS = Object.entries(EXAMPLE_DIAL_CONFIG).map(([path, control]) => ({type: 'action', path, label: control.label}));
let entitySequence = 0;

function createEntityId(prefix) {
    entitySequence += 1;
    return `${prefix}-${Date.now()}-${entitySequence}`;
}

function createHypothesis() {
    return {id: createEntityId('hypothesis'), if: '', then: '', because: ''};
}

function createSegment() {
    return {id: createEntityId('segment'), type: SEGMENT_TYPES[0], name: '', count: '', share: ''};
}

function createProblem() {
    return {id: createEntityId('problem'), context: '', difficulty: '', consequence: '', frequency: ''};
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

const PEOPLE_FORMS = {one: 'человек', few: 'человека', many: 'человек', other: 'человека'};
const PEOPLE_PLURAL_RULES = new Intl.PluralRules('ru-RU');

function formatSegmentCount(value) {
    const count = String(value || '').trim();
    if (!count || /человек(?:а|ов)?/iu.test(count)) return count;

    const match = count.match(/\d(?:[\d\s.,]*\d)?/u);
    if (!match) return count;

    const number = Number(match[0].replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(number)) return count;

    const people = PEOPLE_FORMS[PEOPLE_PLURAL_RULES.select(number)];
    return `${count.slice(0, match.index)}${match[0]} ${people}${count.slice(match.index + match[0].length)}`;
}

function formatSegmentShare(value) {
    const share = String(value || '').trim();
    return share && !/аудитори[яи]/iu.test(share) ? `${share} аудитории` : share;
}

function formatSegmentDescription(segment) {
    return [formatSegmentCount(segment.count), formatSegmentShare(segment.share)].filter(Boolean).join(' · ');
}

function formatProblemDescription(problem) {
    return [
        `Контекст: ${problem.context}`,
        `Затруднение: ${problem.difficulty}`,
        `Последствие: ${problem.consequence}`,
        problem.frequency && `Частота: ${problem.frequency}`,
    ].filter(Boolean).join('\n');
}

function metricDelta(metric) {
    const current = parseMetricValue(metric.current);
    const target = parseMetricValue(metric.target);
    if (current === null || target === null) return null;

    const difference = target - current;
    const sign = difference > 0 ? '+' : '';
    const absoluteUnit = metric.unit === '%' ? ' п.п.' : metric.unit ? ` ${metric.unit}` : '';
    const absolute = `${sign}${formatMetricValue(difference)}${absoluteUnit}`;
    if (current === 0) return absolute;

    const relative = difference / Math.abs(current);
    const multiplier = target / current;
    const relativeSign = relative > 0 ? '+' : '';
    return `${absolute}, ${relativeSign}${formatMetricValue(relative * 100)}%, ×${formatMetricValue(multiplier)}`;
}

function metricRange(metric) {
    const current = parseMetricValue(metric.current);
    const target = parseMetricValue(metric.target);
    if (current === null || target === null) return null;
    return `${formatMetricValue(current)} → ${formatMetricValue(target)}${metric.unit ? ` ${metric.unit}` : ''}`;
}

function MetricDeltaField({metric}) {
    const key = [metric.current, metric.unit, metric.target].join('\u0000');
    const delta = metricDelta(metric);
    const previousKey = React.useRef(key);
    const [calculating, setCalculating] = React.useState(false);
    const changed = previousKey.current !== key;

    React.useEffect(() => {
        if (previousKey.current === key) return undefined;
        previousKey.current = key;

        if (!delta) {
            setCalculating(false);
            return undefined;
        }

        setCalculating(true);
        const timer = window.setTimeout(() => setCalculating(false), 1000);
        return () => window.clearTimeout(timer);
    }, [key, delta]);

    const loading = calculating || (changed && delta);
    return h('div', {className: 'passport-metric-delta-field'},
        h(T.Input, {
            className: `passport-metric-delta-input${loading ? ' passport-metric-delta-input--loading' : ''}`,
            label: 'Изменение', value: loading ? ' ' : delta || '', readOnly: true, cleaner: false,
            accessory: h(T.Icon, {name: 'small-pragmatic/lock', size: 16}),
            inputProps: {tabIndex: -1, 'aria-readonly': true},
            onFocus: event => event.target.blur(),
        }),
        loading && h(T.Skeleton, {className: 'passport-metric-delta-value-skeleton', variant: 'rounded', width: '58%', height: 16, radius: 4}),
    );
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

    return {items, draft, add, edit, save, remove, replace: nextItems => { setItems(nextItems); setDraft(null); }, cancel: () => setDraft(null), reset: () => { setItems([]); setDraft(null); }};
}

function PassportTextarea({label, labelOutside, value, onChange, disabled, invalid, error, placeholder, rows = 3}) {
    return h(T.Textarea, {
        className: 'passport-textarea',
        label, labelOutside, value, onChange, disabled, invalid, error, placeholder, rows,
        height: TEXTAREA_HEIGHT,
    });
}

function PassportExampleDial({filled, onAction, onReset}) {
    const dial = useDialKitController('Примеры паспорта', EXAMPLE_DIAL_CONFIG, {
        id: EXAMPLE_DIAL_ID,
        defaultCollapsed: true,
        onAction,
    });
    const [open, setOpen] = React.useState(false);
    const root = React.useRef(null);

    React.useEffect(() => {
        const closeOnOutsidePointerDown = event => {
            if (!root.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsidePointerDown);
        return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    }, []);

    return h('div', {ref: root, className: 'passport-example-dial dialkit-root', 'data-mode': 'popover', 'data-theme': 'dark', 'data-tui-check-ignore': ''},
        h('div', {className: 'dialkit-panel', 'data-position': 'bottom-right'},
            h(Folder, {title: 'Примеры паспорта', open, onOpenChange: setOpen, isRoot: true},
                h(ControlRenderer, {panelId: EXAMPLE_DIAL_ID, controls: EXAMPLE_DIAL_CONTROLS, values: dial.values}),
                filled && h('button', {type: 'button', className: 'dialkit-button passport-example-dial__reset', onClick: onReset}, 'Сбросить пример'),
            ),
        ),
    );
}

function useAdaptiveStickyFooter(step) {
    const [sticky, setSticky] = React.useState(false);

    React.useLayoutEffect(() => {
        let frame = 0;
        let delay = 0;
        const measure = () => {
            const dialog = document.querySelector('.tui-dlg--full.tui-dlg--inline:not(.tui-dlg--under)')
                || document.querySelector('.tui-dlg--full:not(.tui-dlg--under)');
            const screen = dialog?.querySelector('.tui-dlg__screen');
            const content = dialog?.querySelector('.tui-dlg__col--in .tui-dlg__content')
                || dialog?.querySelector('.tui-dlg__steps > .tui-dlg__col:last-child .tui-dlg__content');
            const footer = dialog?.querySelector('.tui-dlg__dock-in, .tui-dlg__footer');
            if (!screen || !content) return;

            const contentBottom = content.getBoundingClientRect().bottom;
            const footerHeight = footer?.getBoundingClientRect().height || 56;
            const availableBottom = Math.min(screen.getBoundingClientRect().bottom, window.innerHeight);
            const nextSticky = contentBottom + 32 + footerHeight + 48 > availableBottom;
            setSticky(current => current === nextSticky ? current : nextSticky);
        };
        const scheduleMeasure = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(measure);
        };
        const steps = document.querySelector('.tui-dlg--full.tui-dlg--inline:not(.tui-dlg--under) .tui-dlg__steps')
            || document.querySelector('.tui-dlg--full:not(.tui-dlg--under) .tui-dlg__steps');
        const observer = new MutationObserver(scheduleMeasure);
        if (steps) observer.observe(steps, {childList: true, subtree: true});
        window.addEventListener('resize', scheduleMeasure);
        scheduleMeasure();
        delay = window.setTimeout(scheduleMeasure, 350);

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(delay);
            observer.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
        };
    }, [step]);

    return sticky;
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
    const segments = useEntityCollection(createSegment, MAX_SEGMENTS);
    const [showSegmentError, setShowSegmentError] = React.useState(false);
    const problems = useEntityCollection(createProblem, MAX_PROBLEMS);
    const [showProblemError, setShowProblemError] = React.useState(false);
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
    const [demoFilled, setDemoFilled] = React.useState(false);
    const stickyFooter = useAdaptiveStickyFooter(step);
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
        toggle(setSources, source, checked);
    }

    function updateReference(reference, key, value) {
        setReferenceDetails(current => ({...current, [reference]: {...current[reference], [key]: value}}));
    }

    function openSegmentEditor() {
        if (!segments.add()) T.showToast({label: `Можно добавить не больше ${MAX_SEGMENTS} сегментов`, icon: 'fixed-color/alert-negative'});
        setShowSegmentError(false);
    }

    function editSegment(segment) {
        segments.edit(segment);
        setShowSegmentError(false);
    }

    function updateSegment(key, value) {
        segments.draft && segments.edit({...segments.draft, [key]: value});
    }

    function saveSegment() {
        const segment = segments.draft;
        if (!segment) return;
        if (!segment.name.trim() || (!segment.count.trim() && !segment.share)) {
            setShowSegmentError(true);
            return;
        }
        segments.save(segment);
        setShowSegmentError(false);
    }

    function openProblemEditor() {
        if (!problems.add()) T.showToast({label: `Можно добавить не больше ${MAX_PROBLEMS} проблем`, icon: 'fixed-color/alert-negative'});
        setShowProblemError(false);
    }

    function editProblem(problem) {
        problems.edit(problem);
        setShowProblemError(false);
    }

    function updateProblem(key, value) {
        problems.draft && problems.edit({...problems.draft, [key]: value});
    }

    function saveProblem() {
        const problem = problems.draft;
        if (!problem) return;
        if (!problem.context.trim() || !problem.difficulty.trim() || !problem.consequence.trim() || !problem.frequency) {
            setShowProblemError(true);
            return;
        }
        problems.save(problem);
        setShowProblemError(false);
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
            if (!segments.items.length) return {toast: 'Добавьте хотя бы один сегмент'};
        }
        if (step === 1 && !businessInitiative && !problems.items.length) return {toast: 'Добавьте хотя бы одну проблему или отметьте инициативу бизнеса'};
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
                audience: segments.items.map(({id, ...segment}) => segment),
                situation: {problems: problems.items.map(({id, ...problem}) => problem), businessInitiative},
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
        segments.reset(); setShowSegmentError(false); problems.reset(); setShowProblemError(false); setBusinessInitiative(false);
        setSources([]); setSourceLinks(''); setBusinessComment(''); setBusinessImpacts([]);
        hypotheses.reset(); setShowHypothesisError(false); metrics.reset(); setShowMetricError(false);
        setReferences([]); setReferenceDetails({}); setStartDate(null); setDateType('');
        setDemoFilled(false);
    }

    function fillExample(kind) {
        const examples = {
            good: {
                segment: {name: 'Новые селлеры на подключении', count: '1 000 в квартал', share: '1–5%'},
                problem: {context: 'При подключении магазина к сервису продавец заполняет данные о компании.', difficulty: 'Не понимает, какие документы нужны и где их найти.', consequence: 'Откладывает подключение и обращается в поддержку.', frequency: 'Несколько раз в неделю'},
                sources: ['Аналитика, выгрузка', 'Интервью с пользователями'],
                sourceLinks: 'https://example.com/research',
                impacts: ['Ускорить получение ценности от продукта'],
                businessComment: 'Сокращаем срок подключения и нагрузку на поддержку.',
                hypothesis: {if: 'Добавим понятный список документов на каждом шаге подключения.', then: 'Продавец быстрее завершит подключение магазина.', because: 'Не придётся искать требования в справке и уточнять их в поддержке.'},
                metric: {name: 'Конверсия в покупку', current: '12', unit: '%', target: '18'},
                reference: {links: 'https://example.com/competitor', take: 'Пошаговую подачу требований и примеры документов'},
            },
            fallback: {
                segment: {name: 'Покупатели', count: '500', share: '1–5%'},
                problem: {context: 'Не знаю', difficulty: 'Плохо', consequence: 'Непонятно', frequency: 'Раз в день'},
                sources: ['Аналитика, выгрузка'], sourceLinks: '',
                impacts: ['Оптимизировать воронку'], businessComment: '',
                hypothesis: {if: 'Сделаем', then: 'Станет лучше', because: 'Так надо'},
                metric: {name: 'Конверсия', current: '10', unit: '%', target: '12'},
                reference: {links: '', take: ''},
            },
            ai: {
                segment: {name: 'Покупатели с возвратом товара', count: '2 400 в месяц', share: '10–25%'},
                problem: {context: 'После оформления возврата покупатель открывает личный кабинет, чтобы узнать статус денег.', difficulty: 'Не видит срок и текущий этап возврата после передачи товара в пункт выдачи.', consequence: 'Повторно пишет в поддержку и оставляет негативный отзыв о сервисе.', frequency: 'Несколько раз в неделю'},
                sources: ['Обращения в поддержку', 'Интервью с пользователями'], sourceLinks: 'https://example.com/returns-research',
                impacts: ['Избежать репутационных рисков'], businessComment: 'Снижаем число повторных обращений и негативных отзывов о возвратах.',
                hypothesis: {if: 'Добавим в личный кабинет календарь городских мероприятий.', then: 'Покупатели будут чаще планировать досуг на выходные.', because: 'Информация о событиях поможет выбрать интересный маршрут.'},
                metric: {name: 'Количество просмотров календаря', current: '300', unit: 'шт.', target: '900'},
                reference: {links: 'https://example.com/city-events', take: 'Карточки мероприятий с датой и адресом'},
            },
        };
        const example = examples[kind] || examples.good;
        setStep(0); setShowError(false); setReview(false); setReviewStep(null); setReviewIssues([]);
        segments.replace([{...createSegment(), ...example.segment}]);
        problems.replace([{...createProblem(), ...example.problem}]);
        setBusinessInitiative(false);
        setSources(example.sources);
        setSourceLinks(example.sourceLinks);
        setBusinessImpacts(example.impacts); setBusinessComment(example.businessComment);
        hypotheses.replace([{...createHypothesis(), ...example.hypothesis}]);
        metrics.replace([{...createMetric(), ...example.metric, currentDate: new Date().toISOString().slice(0, 10)}]);
        setReferences(['Прямые конкуренты']);
        setReferenceDetails({'Прямые конкуренты': example.reference});
        setStartDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        setDateType('Передача в разработку');
        setDemoFilled(true);
    }

    const fields = step === 0
        ? h('div', {className: 'passport-segments'},
            h('button', {type: 'button', className: 'passport-add-metric passport-add-segment', onClick: openSegmentEditor},
                h('span', {className: 'passport-add-metric__icon', 'aria-hidden': true}, h(T.Icon, {name: 'small-pragmatic/plus', size: 24})),
                h('span', {className: 'tui-ui-m'}, 'Добавить сегмент аудитории'),
            ),
            h('div', {className: 'passport-segment-list'}, segments.items.map(segment => h(T.Cell, {
                key: segment.id, avatar: 'medium/users', avatarTone: 'accent-2', title: segment.name,
                description: formatSegmentDescription(segment),
                titleLines: 2, descriptionLines: 2,
                onClick: () => editSegment(segment),
            }))),
        )
        : step === 1
            ? h('div', {className: 'passport-problems'},
                h('button', {type: 'button', className: 'passport-add-metric passport-add-problem', onClick: openProblemEditor},
                    h('span', {className: 'passport-add-metric__icon', 'aria-hidden': true}, h(T.Icon, {name: 'small-pragmatic/plus', size: 24})),
                    h('span', {className: 'tui-ui-m'}, 'Добавить проблему'),
                ),
                h('div', {className: 'passport-problem-list'}, problems.items.map(problem => h(T.Cell, {
                    key: problem.id, avatar: 'medium/alert-circle', avatarTone: 'accent-2', title: problem.difficulty,
                    description: problem.consequence,
                titleLines: 2, descriptionLines: 2,
                    onClick: () => editProblem(problem),
                }))),
                h(T.Checkbox, {label: 'Явных проблем у пользователей нет. Задача — инициатива бизнеса', checked: businessInitiative, onChange: setBusinessInitiative}),
            )
        : step === 2
            ? h('div', {className: 'passport-fields'},
                h('div', {className: 'passport-choices'}, SOURCES.map(source => h(T.Checkbox, {key: source, label: source, checked: sources.includes(source), onChange: checked => toggleSource(source, checked)}))),
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
                            titleLines: 2, descriptionLines: 2,
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
                                h(T.Input, {label: 'Ссылки', value: referenceDetails[reference]?.links || '', onChange: value => updateReference(reference, 'links', value), placeholder: 'Ссылки на похожие решения'}),
                                h(T.Input, {label: 'Что берем и почему', value: referenceDetails[reference]?.take || '', onChange: value => updateReference(reference, 'take', value), placeholder: 'Что используем в своей задаче'}),
                            ),
                        )))
                        : h('div', {className: 'passport-fields passport-date'}, h('div', {className: 'passport-date-fields'},
                            h(T.InputDate, {label: 'Дата', value: startDate, onChange: value => setStartDate(value), min: minStartDate, error: showError && (!startDate || startDate < minStartDate) ? 'Укажите дату не раньше сегодняшней' : undefined}),
                            h(T.Combobox, {label: 'Что за дата', value: dateType, onChange: value => setDateType(String(value || '')), items: DATE_TYPES, placeholder: 'Выберите или впишите', error: showError && !dateType.trim() ? 'Укажите, что произойдёт в эту дату' : undefined}),
                        ));

    function epicDescription() {
        return [
            'Аудитория',
            ...segments.items.map(segment => [segment.type, segment.name, formatSegmentDescription(segment)].filter(Boolean).join(' · ')),
            ...(problems.items.length ? ['', 'Проблемы', ...problems.items.map((problem, index) => `${index + 1}. ${formatProblemDescription(problem)}`)] : []),
            ...(!problems.items.length && businessInitiative ? ['', 'Инициатива бизнеса без явной проблемы пользователя'] : []),
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
            list('Аудитория', segments.items.map(segment => [segment.type, segment.name, formatSegmentDescription(segment)].filter(Boolean).join(' · ')), 'ul'),
            list('Проблемы', problems.items.map(formatProblemDescription), 'ol'),
            !problems.items.length && businessInitiative && section('Инициатива', 'Бизнес-инициатива без явной проблемы пользователя'),
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
        stickyFooter: true, actions: [
            {label: 'Проверить ещё раз', appearance: 'flat', onClick: () => void startReview()},
            {label: 'Отправить дизайнеру', onClick: finishReview},
        ],
    }, h('div', {className: 'passport-review'}, reviewIssues.length
        ? reviewIssues.map(issue => h(T.CardLarge, {
        key: issue.id, appearance: 'flat', space: 'compact', title: issue.title, description: issue.description,
        footer: h(T.Button, {appearance: 'secondary', size: 'm', onClick: () => editReviewIssue(issue)}, 'Исправить'), footerKind: 'buttons',
        }))
        : h(T.CardLarge, {appearance: 'flat', space: 'compact', title: 'Всё готово', description: 'Замечаний по содержанию нет. Можно отправить описание дизайнеру.'})));

    if (sent) return h(T.Dialog, {open: true, inline: true, fullscreen: true, closeButton: false, platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined}, h(T.BlockStatus, {type: 'fullscreen', kind: 'result', image: 'check', title: 'Задача описана', text: 'Вставьте описание в эпик в поле Description', actions: [{label: 'Скопировать описание', icon: 'small-pragmatic/copy', onClick: copyEpicDescription}, {label: 'Заполнить заново', appearance: 'secondary', onClick: reset}]}));

    const isExistingSegment = segments.draft && segments.items.some(segment => segment.id === segments.draft.id);
    const closeSegmentEditor = () => { segments.cancel(); setShowSegmentError(false); };
    const segmentEditor = segments.draft && h(T.Dialog, {
        open: true, size: 'm', title: 'Кого касается проблема',
        onClose: closeSegmentEditor,
        actions: [
            !isExistingSegment && {label: 'Отмена', appearance: 'flat', onClick: closeSegmentEditor},
            isExistingSegment && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { segments.remove(segments.draft.id); setShowSegmentError(false); }},
            {label: 'Сохранить', onClick: saveSegment},
        ].filter(Boolean),
    }, h('div', {className: 'passport-segment-fields'},
        h(T.ChipGroup, {mode: 'single', value: segments.draft.type || SEGMENT_TYPES[0], onChange: value => updateSegment('type', value), items: SEGMENT_TYPES.map(value => ({label: value, value})), label: 'Тип сегмента'}),
        h(T.Input, {label: 'Название сегмента', value: segments.draft.name, onChange: value => updateSegment('name', value), invalid: showSegmentError && !segments.draft.name.trim(), error: showSegmentError && !segments.draft.name.trim() ? 'Укажите название сегмента' : undefined, placeholder: 'Новые селлеры на\u00a0подключении'}),
        h(T.Input, {label: 'Сколько человек', value: segments.draft.count, onChange: value => updateSegment('count', value), placeholder: 'Около 1 000 в\u00a0квартал'}),
        h(T.Select, {label: 'Доля от общей аудитории', value: segments.draft.share, onChange: value => updateSegment('share', value), items: SHARES, placeholder: 'Выберите долю', invalid: showSegmentError && !segments.draft.count.trim() && !segments.draft.share, error: showSegmentError && !segments.draft.count.trim() && !segments.draft.share ? 'Укажите количество или долю' : undefined}),
    ));

    const isExistingProblem = problems.draft && problems.items.some(problem => problem.id === problems.draft.id);
    const closeProblemEditor = () => { problems.cancel(); setShowProblemError(false); };
    const problemEditor = problems.draft && h(T.Dialog, {
        open: true, size: 'm', title: 'Проблема', description: 'Что мешает пользователю или бизнесу',
        onClose: closeProblemEditor,
        actions: [
            !isExistingProblem && {label: 'Отмена', appearance: 'flat', onClick: closeProblemEditor},
            isExistingProblem && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { problems.remove(problems.draft.id); setShowProblemError(false); }},
            {label: 'Сохранить', onClick: saveProblem},
        ].filter(Boolean),
    }, h('div', {className: 'passport-fields'},
        h(T.Input, {label: 'В каком контексте', value: problems.draft.context, onChange: value => updateProblem('context', value), invalid: showProblemError && !problems.draft.context.trim(), error: showProblemError && !problems.draft.context.trim() ? 'Опишите контекст' : undefined, placeholder: 'При ежедневной проверке финансовых показателей'}),
        h(T.Select, {label: 'Как часто это происходит', value: problems.draft.frequency, onChange: value => updateProblem('frequency', value), items: FREQUENCIES, invalid: showProblemError && !problems.draft.frequency, error: showProblemError && !problems.draft.frequency ? 'Выберите частоту' : undefined, placeholder: 'Выберите частоту'}),
        h(PassportTextarea, {label: 'С каким затруднением сталкивается', value: problems.draft.difficulty, onChange: value => updateProblem('difficulty', value), invalid: showProblemError && !problems.draft.difficulty.trim(), error: showProblemError && !problems.draft.difficulty.trim() ? 'Опишите затруднение' : undefined, placeholder: 'Вынужден вручную сравнивать данные за разные периоды'}),
        h(PassportTextarea, {label: 'К чему это приводит', value: problems.draft.consequence, onChange: value => updateProblem('consequence', value), invalid: showProblemError && !problems.draft.consequence.trim(), error: showProblemError && !problems.draft.consequence.trim() ? 'Опишите последствие' : undefined, placeholder: 'Тратит больше времени и может поздно заметить снижение прибыли'}),
    ));

    const isExistingHypothesis = hypotheses.draft && hypotheses.items.some(hypothesis => hypothesis.id === hypotheses.draft.id);
    const closeHypothesisEditor = () => { hypotheses.cancel(); setShowHypothesisError(false); };
    const hypothesisEditor = hypotheses.draft && h(T.Dialog, {
        open: true, size: 'm', title: 'Гипотеза', description: 'Как можно решить проблему',
        onClose: closeHypothesisEditor,
        actions: [
            !isExistingHypothesis && {label: 'Отмена', appearance: 'flat', onClick: closeHypothesisEditor},
            isExistingHypothesis && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { hypotheses.remove(hypotheses.draft.id); setShowHypothesisError(false); }},
            {label: 'Сохранить', onClick: saveHypothesis},
        ].filter(Boolean),
    }, h('div', {className: 'passport-fields'},
        h(PassportTextarea, {label: 'Если', value: hypotheses.draft.if, onChange: value => updateHypothesis('if', value), invalid: showHypothesisError && !hypotheses.draft.if.trim(), error: showHypothesisError && !hypotheses.draft.if.trim() ? 'Опишите действие' : undefined, placeholder: 'Добавим в отчёт сравнение показателей за разные периоды'}),
        h(PassportTextarea, {label: 'То', value: hypotheses.draft.then, onChange: value => updateHypothesis('then', value), invalid: showHypothesisError && !hypotheses.draft.then.trim(), error: showHypothesisError && !hypotheses.draft.then.trim() ? 'Опишите ожидаемый результат' : undefined, placeholder: 'Пользователь быстрее заметит изменение показателей'}),
        h(PassportTextarea, {label: 'Потому что', value: hypotheses.draft.because, onChange: value => updateHypothesis('because', value), invalid: showHypothesisError && !hypotheses.draft.because.trim(), error: showHypothesisError && !hypotheses.draft.because.trim() ? 'Объясните причину' : undefined, placeholder: 'Не придётся вручную собирать и сравнивать данные'}),
    ));

    const isExistingMetric = metrics.draft && metrics.items.some(metric => metric.id === metrics.draft.id);
    const closeMetricEditor = () => { metrics.cancel(); setShowMetricError(false); };
    const metricEditor = metrics.draft && h(T.Dialog, {
        open: true, size: 'm', title: 'Метрика', description: 'Как поймём, что решение сработало',
        onClose: closeMetricEditor,
        actions: [
            !isExistingMetric && {label: 'Отмена', appearance: 'flat', onClick: closeMetricEditor},
            isExistingMetric && {label: 'Удалить', appearance: 'flat-destructive', onClick: () => { metrics.remove(metrics.draft.id); setShowMetricError(false); }},
            {label: 'Сохранить', onClick: saveMetric},
        ].filter(Boolean),
    }, h('div', {className: 'passport-metric-fields'},
        h(T.Input, {label: 'Ключевая метрика', value: metrics.draft.name, onChange: value => updateMetric('name', value), invalid: showMetricError && !metrics.draft.name.trim(), error: showMetricError && !metrics.draft.name.trim() ? 'Укажите метрику' : undefined, placeholder: 'Конверсия в покупку'}),
        h(T.InputDate, {label: 'Дата замера текущего значения', value: metrics.draft.currentDate, onChange: value => updateMetric('currentDate', value)}),
        h('div', {className: 'passport-metric-details'},
            h(T.Input, {label: 'Текущее значение', value: metrics.draft.current, onChange: value => updateMetric('current', value), invalid: showMetricError && !metrics.draft.current.trim(), error: showMetricError && !metrics.draft.current.trim() ? 'Укажите текущее значение' : undefined, placeholder: '10'}),
            h(T.Combobox, {label: 'Единица измерения', value: metrics.draft.unit, onChange: value => updateMetric('unit', String(value || '')), items: METRIC_UNITS, invalid: showMetricError && !metrics.draft.unit.trim(), error: showMetricError && !metrics.draft.unit.trim() ? 'Укажите единицу измерения' : undefined, placeholder: 'Выберите или впишите'}),
        ),
        h('div', {className: 'passport-metric-target'},
            h('div', {className: 'passport-metric-target-row'},
                h(T.Input, {label: 'Целевое значение', value: metrics.draft.target, onChange: value => updateMetric('target', value), invalid: showMetricError && !metrics.draft.target.trim(), error: showMetricError && !metrics.draft.target.trim() ? 'Укажите целевое значение' : undefined, placeholder: '13'}),
                h(MetricDeltaField, {metric: metrics.draft}),
            ),
        ),
    ));

    const demoAction = h(PassportExampleDial, {key: 'examples', filled: demoFilled, onAction: fillExample, onReset: reset});

    return h(React.Fragment, null, h(T.Dialog, {
        open: true, inline: true, fullscreen: true, closeButton: false,
        platform: mobile ? 'mobile' : undefined, system: mobile ? 'ios' : undefined,
        title, description,
        progress: (step + 1) / STEPS.length, step, stepDirection: 'forward',
        onBack: step ? () => { setShowError(false); setStep(current => current - 1); } : undefined,
        stickyFooter,
        actions: [
            (step === 4 || step === 6) && {label: 'Пропустить', appearance: 'flat', onClick: skip},
            {label: reviewStep !== null ? 'Готово' : step === STEPS.length - 1 ? 'Проверить задачу' : 'Дальше', onClick: next},
        ].filter(Boolean),
    }, fields), demoAction, segmentEditor, problemEditor, hypothesisEditor, metricEditor);
}

export function Mobile() { return h(Passport, {platform: 'mobile'}); }
export function Desktop() { return h(Passport, {platform: 'desktop'}); }

mountFlow(document.getElementById('root'), {
    title: 'Паспорт дизайн-задачи', baseUrl: new URL('/', window.location.origin), resetKeys: [],
    solution: {mobile: Mobile, desktop: Desktop}, bare: true, about, spec,
});
