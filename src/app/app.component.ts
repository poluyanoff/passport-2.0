import {ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TuiButton, TuiDialog, TuiIcon, TuiLabel, TuiNotification, TuiRoot, TuiTextfield, TuiTitle} from '@taiga-ui/core';
import {
    TuiChevron,
    TuiCheckbox,
    TuiDataListWrapper,
    TuiProgressBar,
    TuiSelect,
    TuiTextarea,
    TuiToastService,
    tuiCheckboxOptionsProvider,
} from '@taiga-ui/kit';
import {TuiAppBar, TuiCardLarge, TuiCell, TuiHeader} from '@taiga-ui/layout';
import {BIZ, CHECKS, INFL, REFS, SHARES, SPECIAL, SRC, STEPS} from './steps.data';

type St = 'g' | 'a' | 'r';

const T = (s: string | undefined | null): string => (s ?? '').trim();
const first = (s: string): string => T(s).split(/(?<=[.!?])\s|\n/)[0] ?? '';
const worst = (...v: St[]): St => (v.includes('r') ? 'r' : v.includes('a') ? 'a' : 'g');

const OPTIONAL: string[] = ['refs'];

interface Model {
    title: string;
    pBizAs: string;
    pBizTo: string;
    pUsrAs: string;
    pUsrTo: string;
    nowSolve: string;
    src: Record<string, {on: boolean; out: string; l: string}>;
    seg: {n: string; c: string; s: string};
    ctx: string;
    met: Array<{n: string; a: string; b: string; l: string}>;
    checks: string[];
    special: string | null;
    specialWhy: string;
    biz: Record<string, boolean>;
    whyNow: string;
    devDate: string;
    hyp: {a: string; b: string; c: string; d: string};
    refs: Record<string, {on: boolean; l: string; take: string}>;
    limits: string;
    oos: string;
}

function empty(): Model {
    return {
        title: '',
        pBizAs: '',
        pBizTo: '',
        pUsrAs: '',
        pUsrTo: '',
        nowSolve: '',
        src: Object.fromEntries(SRC.map(s => [s.id, {on: false, out: '', l: ''}])),
        seg: {n: '', c: '', s: ''},
        ctx: '',
        met: [{n: '', a: '', b: '', l: ''}],
        checks: [],
        special: null,
        specialWhy: '',
        biz: Object.fromEntries(BIZ.map(b => [b.id, false])),
        whyNow: '',
        devDate: '',
        hyp: {a: '', b: '', c: '', d: ''},
        refs: Object.fromEntries(REFS.map(r => [r.id, {on: false, l: '', take: ''}])),
        limits: '',
        oos: '',
    };
}

@Component({
    selector: 'app-root',
    imports: [
        FormsModule,
        TuiAppBar,
        TuiButton,
        TuiCardLarge,
        TuiCell,
        TuiCheckbox,
        TuiChevron,
        TuiDataListWrapper,
        TuiDialog,
        TuiHeader,
        TuiIcon,
        TuiNotification,
        TuiProgressBar,
        TuiRoot,
        TuiSelect,
        TuiTextarea,
        TuiTextfield,
        TuiTitle,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.less',
    providers: [
        tuiCheckboxOptionsProvider({
            appearance: (el: HTMLInputElement) =>
                el.checked || el.indeterminate ? 'accent' : 'secondary',
        }),
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
    protected readonly steps = STEPS;
    protected readonly SRC = SRC;
    protected readonly REFS = REFS;
    protected readonly CHECKS = CHECKS;
    protected readonly SPECIAL = SPECIAL;
    protected readonly SHARES = SHARES;
    protected readonly INFL = INFL;
    protected readonly BIZ = BIZ;

    protected readonly hypRows: Array<{k: 'a' | 'b' | 'c' | 'd'; kw: string; ph: string}> = [
        {k: 'a', kw: 'Если', ph: 'воздействие, приводящее к изменению поведения субъекта'},
        {k: 'b', kw: 'то', ph: 'изменение поведения субъекта'},
        {k: 'c', kw: 'потому что', ph: 'идея, обеспечивающая срабатывание связки «если» и «то», опирающаяся на мотивацию субъекта'},
        {k: 'd', kw: 'тогда', ph: 'влияние на метрики цели'},
    ];

    protected readonly guide = signal<string[]>(STEPS.map(s => s.id));

    protected readonly progress = () =>
        Math.round((140 * (this.cur() + 1)) / this.steps.length);

    protected readonly guideFirst = () => this.cur() === 0;

    protected readonly progressWidth = () => `${this.progress()}px`;

    protected isGuide(id: string): boolean {
        return this.guide().includes(id);
    }

    protected readonly cur = signal(0);
    protected readonly sent = signal(false);
    protected readonly whyOpen = signal(false);
    protected readonly guideOpen = signal(false);
    protected readonly showError = signal(false);
    protected readonly phase = signal<'idle' | 'out-fwd' | 'out-back' | 'in-fwd' | 'in-back'>('idle');
    private destroyDevNav?: () => void;
    private readonly toast = inject(TuiToastService);
    protected readonly T = T;
    protected readonly done = signal<string>('');

    protected s: Model = empty();

    protected get step() {
        return this.steps[this.cur()]!;
    }

    ngOnInit(): void {
        if (!isDevMode()) {
            return;
        }

        import('./dev-nav').then(({mountDevNav}) => {
            this.destroyDevNav = mountDevNav(index => this.jump(index));
        });
    }

    // Прыжок без валидации и анимации — только для панели разработчика.
    private jump(index: number): void {
        if (index < 0 || index >= this.steps.length) {
            return;
        }

        this.phase.set('idle');
        this.showError.set(false);
        this.cur.set(index);
        window.scrollTo({top: 0});
    }

    protected next(): void {
        const s = this.s;
        const message = this.validation(s);

        if (message) {
            this.showError.set(true);

            if (this.step.id === 'src') {
                this.toast
                    .open(message, {
                        appearance: 'negative',
                        closable: false,
                        autoClose: 3000,
                        data: '@img.fixed.color.alert-warning',
                    })
                    .subscribe();
            }

            return;
        }

        this.showError.set(false);
        this.go(this.cur() + 1);
    }

    private validation(s: Model): string {
        if (!this.isGuide(this.step.id)) {
            return '';
        }

        if (this.step.id === 'user' && !T(s.pUsrAs)) {
            return 'Опишите, что происходит с человеком';
        }

        if (this.step.id === 'now' && !T(s.nowSolve)) {
            return 'Опишите, как человек решает проблему сейчас';
        }

        if (this.step.id === 'problem' && (!T(s.pUsrAs) || !T(s.nowSolve))) {
            return 'Опишите проблему человека и как он решает её сейчас';
        }

        if (this.step.id === 'src' && !this.anySrc()) {
            return 'Отметьте хотя бы один источник';
        }

        if (this.step.id === 'business' && !this.hasBiz()) {
            return 'Отметьте, на что влияет задача в бизнесе';
        }

        return '';
    }

    protected go(i: number): void {
        if (i < 0 || i >= this.steps.length || i === this.cur() || this.phase() !== 'idle') {
            return;
        }

        const back = i < this.cur();

        this.phase.set(back ? 'out-back' : 'out-fwd');

        // Уходящий шаг гаснет 100ms, новый въезжает 240ms (гайд ориджинейшена, как в прототипе селлера).
        setTimeout(() => {
            this.cur.set(i);
            this.showError.set(false);
            window.scrollTo({top: 0});
            this.phase.set(back ? 'in-back' : 'in-fwd');
            setTimeout(() => this.phase.set('idle'), 260);
        }, 100);
    }

    protected reset(): void {
        this.s = empty();
        this.sent.set(false);
        this.go(0);
    }

    protected addMet(): void {
        this.s.met.push({n: '', a: '', b: '', l: ''});
    }

    protected toggleBiz(c: string, on: boolean): void {
        this.s.biz[c] = on;
    }

    protected hasBiz(): boolean {
        return BIZ.some(b => this.s.biz[b.id]);
    }

    protected bizSum(): string {
        return BIZ.filter(b => this.s.biz[b.id]).map(b => b.n).join(', ');
    }

    protected toggleCheck(c: string, on: boolean): void {
        if (this.s.special) {
            this.s.special = null;
            this.s.specialWhy = '';
        }

        this.s.checks = on ? [...this.s.checks, c] : this.s.checks.filter(x => x !== c);
    }

    protected toggleSpecial(id: string, on: boolean): void {
        this.s.special = on ? id : null;
        this.s.specialWhy = '';

        if (on) {
            this.s.checks = [];
        }
    }

    protected specialPh(): string {
        return SPECIAL.find(x => x.id === this.s.special)?.ph ?? '';
    }

    protected anySrc(): boolean {
        return SRC.some(x => this.s.src[x.id]?.on);
    }

    protected hasConfirmedSources(): boolean {
        return SRC.slice(0, -1).some(x => this.s.src[x.id]?.on);
    }

    protected isRequired(id: string): boolean {
        return !OPTIONAL.includes(id);
    }

    /* ---------- состояния полей ---------- */

    private problemState(): St {
        const s = this.s;
        const as = [T(s.pBizAs), T(s.pUsrAs)].filter(Boolean).length;
        const to = [T(s.pBizTo), T(s.pUsrTo)].filter(Boolean).length;

        return as === 2 && to === 2 ? 'g' : as || to ? 'a' : 'r';
    }

    private proofState(): St {
        return SRC.some(x => this.s.src[x.id]?.on) ? 'g' : 'r';
    }

    private segState(): St {
        const r = this.s.seg;
        const full = T(r.n) && T(r.c) && r.s;
        const part = T(r.n) || T(r.c) || r.s;

        return full ? 'g' : part ? 'a' : 'r';
    }

    private metricState(): St {
        const full = this.s.met.filter(r => T(r.n) && T(r.a) && T(r.b) && T(r.l)).length;
        const part = this.s.met.filter(r => T(r.n) || T(r.a) || T(r.b)).length;

        return full ? 'g' : part ? 'a' : 'r';
    }

    private checkState(): St {
        if (this.s.special) {
            return T(this.s.specialWhy) ? 'a' : 'r';
        }

        return this.s.checks.length >= 2 ? 'g' : this.s.checks.length === 1 ? 'a' : 'r';
    }

    private hypState(): St {
        const h = this.s.hyp;
        const v = [h.a, h.b, h.c, h.d].map(T).filter(Boolean).length;

        return v === 3 ? 'g' : v ? 'a' : 'r';
    }

    private refState(): St {
        const on = REFS.filter(r => this.s.refs[r.id]?.on);

        if (on.some(r => T(this.s.refs[r.id]?.take))) {
            return 'g';
        }

        return on.length ? 'a' : 'r';
    }

    protected state(id: string): St {
        const s = this.s;

        switch (id) {
            case 'title':
                return T(s.title) ? 'g' : 'r';
            case 'user':
                return s.pUsrAs && s.pUsrTo ? 'g' : s.pUsrAs || s.pUsrTo ? 'a' : 'r';
            case 'now':
                return T(s.nowSolve) ? 'g' : 'r';
            case 'problem':
                return s.pUsrAs && s.nowSolve ? 'g' : s.pUsrAs || s.nowSolve ? 'a' : 'r';
            case 'business':
                return this.hasBiz() ? 'g' : 'r';
            case 'src':
                return this.proofState();
            case 'why':
                return worst(T(s.whyNow) ? 'g' : 'r', T(s.devDate) ? 'g' : 'a');
            case 'refs':
                return this.refState();
            case 'hyp':
                return worst(this.hypState(), this.metricState());
            default:
                return T(s.limits) ? 'g' : 'r';
        }
    }

    protected sum(id: string): string {
        const s = this.s;

        switch (id) {
            case 'title':
                return T(s.title);
            case 'user':
                return first(s.pUsrAs);
            case 'now':
                return first(s.nowSolve);
            case 'problem':
                return [first(s.pUsrAs), first(s.nowSolve)].filter(Boolean).join(' · ');
            case 'business':
                return this.bizSum();
            case 'src': {
                const on = SRC.filter(x => s.src[x.id]?.on);
                const out = on.map(x => T(s.src[x.id]?.out)).find(Boolean);

                return out || on.map(x => x.n.split(',')[0]!.toLowerCase()).join(', ');
            }

            case 'why': {
                const d = T(s.devDate) ? new Date(s.devDate).toLocaleDateString('ru-RU') : '';

                return [d ? `старт разработки ${d}` : '', first(s.whyNow)].filter(Boolean).join(' · ');
            }

            case 'refs': {
                const on = REFS.filter(r => s.refs[r.id]?.on);
                const take = on.map(r => T(s.refs[r.id]?.take)).find(Boolean);

                return take || on.map(r => r.n.toLowerCase()).join(', ');
            }

            case 'hyp':
                return [T(s.hyp.a), T(s.hyp.b)].filter(Boolean).join(' → ');

            default:
                return first(s.limits);
        }
    }

    protected miss(id: string): string {
        const s = this.s;

        switch (id) {
            case 'title':
                return 'не заполнено';
            case 'user':
                return s.pUsrAs && s.pUsrTo ? '' : 'не заполнено';
            case 'now':
                return T(s.nowSolve) ? '' : 'не заполнено';
            case 'problem':
                return !T(s.pUsrAs) && !T(s.nowSolve) ? 'не заполнено' : !T(s.pUsrAs) ? 'нет проблемы' : 'нет описания, как решают сейчас';
            case 'business':
                return this.hasBiz() ? '' : 'не отмечено, на что влияет';
            case 'src':
                return this.proofState() === 'r' ? 'ни один источник не отмечен' : '';
            case 'why':
                return !T(s.whyNow) ? 'не заполнено, почему сейчас' : 'нет даты старта разработки';
            case 'refs':
                return this.refState() === 'r' ? 'аналоги не смотрели' : 'нет вывода, что берем';
            case 'hyp':
                return this.hypState() === 'r' ? 'гипотеза не сформулирована' : this.metricState() === 'r' ? 'метрика не указана' : 'заполнены не все части';
            default:
                return 'не зафиксировано';
        }
    }

    /* ---------- статус передачи: смотрит только на обязательные шаги ---------- */

    protected reqRed() {
        return this.steps.filter(x => this.isRequired(x.id) && this.state(x.id) === 'r');
    }

    protected reqOpen() {
        return this.steps.filter(x => this.isRequired(x.id) && this.state(x.id) !== 'g');
    }

    protected optOpen() {
        return this.steps.filter(x => !this.isRequired(x.id) && this.state(x.id) !== 'g');
    }

    protected readiness(): {k: St; v: string; w: string; appearance: string} {
        const red = this.reqRed();
        const open = this.reqOpen();
        const opt = this.optOpen();

        if (red.length) {
            return {
                k: 'r',
                appearance: 'negative',
                v: 'Не готово к передаче',
                w: `Пустых обязательных шагов: ${red.length} (${red.map(x => x.nav.toLowerCase()).join(', ')}). Без них дизайнер не сможет начать.`,
            };
        }

        if (open.length) {
            return {
                k: 'a',
                appearance: 'warning',
                v: 'Можно передавать с рисками',
                w: `Обязательные шаги заполнены, но не до конца: ${open.map(x => x.nav.toLowerCase()).join(', ')}. Дизайнер доберет это вопросами, риски останутся в паспорте.`,
            };
        }

        return {
            k: 'g',
            appearance: 'positive',
            v: 'Готово к передаче дизайну',
            w: opt.length ? `Обязательное закрыто полностью. Можно усилить: ${opt.map(x => x.nav.toLowerCase()).join(', ')}.` : 'Всё закрыто полностью.',
        };
    }

    protected rules() {
        const red = this.reqRed();
        const open = this.reqOpen();

        return [
            {appearance: 'negative', k: 'Не передаем', t: 'Хотя бы один обязательный шаг пустой: название, проблема, источник, метрики, аудитория или сроки.', on: red.length > 0},
            {appearance: 'warning', k: 'С рисками', t: 'Обязательные шаги не пустые, но заполнены не до конца: дизайнер добирает вопросами, риски остаются в паспорте.', on: !red.length && open.length > 0},
            {appearance: 'positive', k: 'Передаем', t: 'Все обязательные шаги зеленые. Референсы, гипотеза и границы на статус не влияют, но их отсутствие попадет в паспорт как пробел.', on: !open.length},
        ];
    }

    protected send(): void {
        this.done.set(this.readiness().v.toLowerCase());
        this.sent.set(true);
        window.scrollTo({top: 0});
    }

    protected openStep(id: string): void {
        this.whyOpen.set(false);
        this.go(this.steps.findIndex(x => x.id === id));
    }

    protected fillDemo(): void {
        this.s = {
            title: 'Перевыбор магазина при подключении',
            pBizAs: 'Тратим ресурс разработки и поддержки на переназначение магазина после ошибки пользователя: 10–20 обращений в месяц.',
            pBizTo: 'Пользователь исправляет всё сам, обращения не доходят до поддержки.',
            pUsrAs: 'Ошибся с выбором магазина и не может перевыбрать — идёт в поддержку и ждёт до недели.',
            pUsrTo: 'Меняет выбор сам, подключение занимает один день.',
            nowSolve: 'Пишет в поддержку, оператор пересоздаёт заявку вручную. Занимает от 1 до 7 дней, в это время партнёр не может торговать.',
            src: {
                ...empty().src,
                sup: {on: true, out: '14 обращений за июль, все про перевыбор магазина', l: 'dash/tickets'},
                an: {on: true, out: 'Воронка подключения: 8% отвалов на шаге выбора магазина', l: 'dash/funnel'},
            },
            seg: {n: 'Новые селлеры на подключении', c: '≈1000 в Q3', s: '5–10%'},
            ctx: 'Подключаю магазин с ноутбука один раз, в начале работы с сервисом, спешу и не перечитываю подписи к полям.',
            met: [
                {n: 'Обращения по пересозданию заявки', a: '10–20 в месяц', b: '0–2 в месяц', l: 'dash/support-tickets'},
                {n: 'Скорость подключения', a: '1–7 дней', b: '1–2 дня', l: 'dash/onboarding'},
            ],
            checks: ['Сравнение метрики до и после', 'Счетчик использования'],
            special: null,
            specialWhy: '',
            biz: {...empty().biz, fin: true, mau: true},
            whyNow: 'До конца года цель 3–5 тысяч новых пользователей — при текущем флоу нагрузка на поддержку вырастет пропорционально.',
            devDate: '2026-09-01',
            hyp: {
                a: 'дать возможность перевыбрать магазин до подтверждения заявки',
                b: 'пользователь исправляет ошибку сам, не обращаясь в поддержку',
                c: 'он замечает ошибку сразу и хочет быстрее закончить подключение, а не ждать оператора',
                d: 'обращения по пересозданию упадут с 10–20 до 0–2 в месяц, скорость подключения — с 1–7 до 1–2 дней',
            },
            refs: {
                ...empty().refs,
                r2: {on: true, l: 'figma/tbusiness-onboarding', take: 'Паттерн подтверждения до записи в базу'},
                r3: {on: true, l: 'Ozon Seller, WB Partner', take: 'Перевыбор магазина доступен до подтверждения'},
            },
            limits: 'Без самостоятельного перевыбора магазина решение бессмысленно: если исправление всё равно идёт через поддержку, косты мы не снимаем.',
            oos: 'Не меняем сценарий авторизации в маркетплейсе.',
        };
    }
}
