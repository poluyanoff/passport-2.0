/* check-dom.js — проверка соблюдения ДС по отрендеренному DOM для Angular Taiga UI 5.31.
 *
 * Ставится как обычный скрипт на страницу прототипа:
 *   <script src="/check-dom.js"></script>          — в dev
 *   window.TaigaCheck.check()                      — вернёт массив нарушений
 *
 * Отличия от React-порта коллеги (TaigaUI.check()), из которого взята идея:
 *   • опирается не на классы tui-*, а на атрибуты-директивы и api/index.json;
 *   • ловит NG0309 (директива поставлена дважды) — в React такой ошибки не бывает,
 *     а здесь она роняет всё приложение;
 *   • проверяет иконки и по имени файла в assets, и по факту 404.
 *
 * Принцип: смотрим только то, что дописано руками. Элемент, несущий директиву ДС,
 * правилами «самодельной вёрстки» не трогаем — за него отвечает компонент.
 */
(function () {
    'use strict';

    const state = {api: null, missingIcons: new Set(), runtimeErrors: [], violations: []};

    // Браузер отдаёт один и тот же цвет в разных функциях: токены через var() приходят
    // как rgb()/rgba(), а фон компонента — как color(srgb r g b / a). Без нормализации
    // любой такой фон выглядит «не из токенов».
    const norm = (c) => {
        const v = String(c || '').trim().toLowerCase();
        const m = v.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
        if (!m) return v.replace(/\s+/g, '');
        const to255 = (x) => Math.round(parseFloat(x) * 255);
        const a = m[4] === undefined ? 1 : parseFloat(m[4]);
        return a === 1
            ? `rgb(${to255(m[1])},${to255(m[2])},${to255(m[3])})`
            : `rgba(${to255(m[1])},${to255(m[2])},${to255(m[3])},${a})`;
    };

    /** Загружает справочник: встроенный (window.__TUI_API__) или рядом со скриптом. */
    async function loadApi() {
        if (state.api) return state.api;
        if (window.__TUI_API__) return (state.api = window.__TUI_API__);
        for (const url of ['/api/index.json', 'api/index.json']) {
            try {
                const r = await fetch(url);
                if (r.ok) return (state.api = await r.json());
            } catch { /* пробуем следующий */ }
        }
        return null;
    }

    /** Индекс: атрибут → директивы; имя класса → запись; CSS-крючки. */
    function buildIndex(api) {
        // Атрибуты в DOM всегда в нижнем регистре (tuibutton), в .d.ts — camelCase (tuiButton).
        const byAttr = new Map();
        const byName = new Map();
        for (const d of api.items) {
            byName.set(d.name, d);
            for (const sel of d.selectors) {
                for (const m of sel.matchAll(/\[([\w-]+)[\]=]?/g)) {
                    const k = m[1].toLowerCase();
                    if (!byAttr.has(k)) byAttr.set(k, []);
                    byAttr.get(k).push(d);
                }
            }
        }
        const cssHooks = new Set(Object.values(api.cssHooks || {}).flat().map(a => a.toLowerCase()));
        return {byAttr, byName, cssHooks};
    }

    /** Элемент реально виден: есть размеры, не скрыт стилями. */
    function visible(el) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 &&
            cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    }

    function describe(el) {
        if (!el || el === document.documentElement) return 'html';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
        const txt = (el.textContent || '').trim().slice(0, 24);
        if (txt) s += ` «${txt}${el.textContent.trim().length > 24 ? '…' : ''}»`;
        return s;
    }

    /** Допустимые цвета: каждую --tui-* переменную разрешаем в вычисленный стиль и
     *  нормализуем в rgb()/rgba(). Полупрозрачные слои (стекло, overlay) есть только
     *  как фон, поэтому проверяем переменную и как цвет, и как background-color. */
    function themeColors() {
        const probe = document.createElement('div');
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const names = new Set();
        for (const sheet of document.styleSheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            if (!rules) continue;
            for (const rule of rules) {
                if (!rule.style) continue;
                for (let i = 0; i < rule.style.length; i++) {
                    if (rule.style[i].startsWith('--tui-')) names.add(rule.style[i]);
                }
            }
        }
        const set = new Set();
        for (const n of names) {
            probe.style.color = '';
            probe.style.color = `var(${n})`;
            const c = getComputedStyle(probe).color;
            if (c && c !== 'rgba(0, 0, 0, 0)') set.add(norm(c));

            probe.style.backgroundColor = '';
            probe.style.backgroundColor = `var(${n})`;
            const bg = getComputedStyle(probe).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)') set.add(norm(bg));
        }
        probe.remove();
        return set;
    }

    function fonts() {
        const cs = getComputedStyle(document.documentElement);
        const fam = [cs.getPropertyValue('--tui-font-family-text'), cs.getPropertyValue('--tui-font-family-display')]
            .map(v => v.trim().replace(/["']/g, '').toLowerCase()).filter(Boolean);
        return new Set([...fam, 'tuitext', 'tuiheading']);
    }

    const iconRefs = new Map();

    function run() {
        const api = state.api;
        if (!api) return [{rule: 'api', where: '—', message: 'Не загружен api/index.json — проверка не может знать список директив.'}];
        const {byAttr, byName, cssHooks} = buildIndex(api);
        const out = [];
        const colors = themeColors();
        const dsFonts = fonts();
        const add = (rule, el, message) => out.push({rule, where: describe(el), message});

        // --- Шрифты: объявлено в CSS ≠ загружено. Без tbank-fonts.less все переменные --tui-font-*
        //     стоят на месте, а текст рисуется системным шрифтом. Смотрим, есть ли реальные FontFace.
        {
            const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '').toLowerCase());
            const needed = ['tuitext', 'tuiheading'];
            const missing = needed.filter(n => !loaded.includes(n));
            if (missing.length && document.fonts.size === 0) {
                add('font', document.body, 'Шрифты ДС не загружены (T-Sans, Neue Haas Unica): текст рисуется системным шрифтом. Добавьте в styles.less @import \'@taiga-ui/proprietary/styles/tbank-fonts.less\'.');
            }
        }

        // --- Тема ---
        if (!document.documentElement.hasAttribute('tuiTheme') && !document.querySelector('[tuiTheme]')) {
            add('theme', document.documentElement, 'Нет tuiTheme: тема выбирается до начала. tuiTheme="light"|"dark" и data-platform="web"|"ios"|"android" на <html>. Строк desktop-day в 5.31 нет.');
        }

        const all = document.body.querySelectorAll('*');
        for (const el of all) {
            // Собственная плашка проверки — служебный элемент, не часть макета.
            if (el.closest('[data-tui-check-ignore]') || el.closest('svg') || el.closest('#tui-check-badge')) continue;
            const tag = el.tagName.toLowerCase();
            if (['svg', 'script', 'style', 'br', 'path', 'g', 'defs'].includes(tag)) continue;
            if (!visible(el)) continue;

            const attrs = [...el.attributes].map(a => a.name);
            const dsAttrs = attrs.filter(a => byAttr.has(a.toLowerCase()) || cssHooks.has(a.toLowerCase()));
            const isDs = dsAttrs.length > 0;

            // --- Иконка: имя запоминаем, существование файла проверим пачкой в конце ---
            // Собираем ДО ветки isDs: tui-icon — сама директива ДС, иначе сюда не дойдём.
            for (const a of ['icon', 'iconstart', 'iconend']) {
                const v = el.getAttribute(a);
                if (v && /^@(tui|img)\./.test(v)) iconRefs.set(v, el);
            }

            // --- NG0309 в DOM не детектируется, и это не упущение ---
            // hostDirectives сами выставляют своим директивам атрибуты на элементе: на
            // <div tuiCardLarge> Angular добавляет tuisurface и tuiappearance. Ручную
            // установку от автоматической в DOM отличить нельзя. Плюс если NG0309 всё-таки
            // случился, приложение не рендерится и этой проверке негде работать.
            // Поэтому правило живёт в статической проверке шаблонов (scripts/verify-canon.mjs)
            // и в перехвате ошибки консоли (см. watchErrors ниже).

            // --- Неизвестный атрибут-директива: опечатка не ловится компилятором ---
            for (const a of attrs) {
                // Имя в DOM всегда в нижнем регистре: tuibutton, tuibuton. Сравниваем в нижнем.
                if (!/^tui[a-z]/.test(a) && !/^tui[A-Z]/.test(a)) continue;
                if (a === 'tuitheme' || a === 'tuiplatform') continue;      // тема и платформа — не директивы
                if (a.startsWith('ng-reflect')) continue;                    // артефакт dev-режима
                // Taiga 4.x маркирует свои элементы служебным атрибутом tui<имя>v (tuirootv,
                // tuicardlargev). Это не директива и не опечатка — отсекаем по паре «имя + v».
                if (/^tui[a-z]+v$/.test(a) && (byAttr.has(a.slice(0, -1)) || cssHooks.has(a.slice(0, -1)) ||
                    document.createElement(a.slice(0, -1).replace(/^tui/, 'tui-')).constructor !== HTMLUnknownElement ||
                    el.tagName.toLowerCase().replace(/-/g, '') === a.slice(0, -1))) continue;
                if (byAttr.has(a.toLowerCase()) || cssHooks.has(a.toLowerCase())) continue;
                // имя класса директивы в camelCase тоже допустимо в шаблоне
                if ([...byName.keys()].some(k => k.toLowerCase() === a)) continue;
                add('unknown-attr', el, `Атрибут «${a}» не объявлен ни одной директивой — вероятна опечатка. Смотри api/directives.md.`);
            }

            // --- Иконка: имя запоминаем, существование файла проверим пачкой в конце ---
            for (const a of ['icon', 'iconstart', 'iconend']) {
                const v = el.getAttribute(a);
                if (v && /^@(tui|img)\./.test(v)) iconRefs.set(v, el);
            }

            if (isDs) continue; // дальше — только самодельная вёрстка

            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const radius = parseFloat(cs.borderTopLeftRadius) || 0;
            const bg = norm(cs.backgroundColor);
            const hasBg = bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent';
            const text = (el.textContent || '').trim();
            // Интерактивность: не только button/a/role=button. Кликабельный div с onClick
            // Angular не помечает ролью, но курсор и обработчик выдают его.
            const clickable = tag === 'div' && (
                el.hasAttribute('ng-reflect-click') ||
                el.getAttribute('role') === 'button' ||
                getComputedStyle(el).cursor === 'pointer'
            );
            const interactive = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || clickable;

            // --- Самодельная кнопка ---
            if (interactive && hasBg && rect.height >= 24 && rect.height <= 64 && radius > 0) {
                add('hand-button', el, 'Самодельная кнопка. Нужен <button tuiButton appearance=… size=…> — он даёт высоты, шрифт, состояния и фокус.');
            } else if (!interactive && hasBg && radius >= 12 && rect.width >= 160 && rect.height >= 48 &&
                       !el.querySelector('button, a, input, tui-icon, tui-cell, [tuiCell]')) {
                // --- Самодельная карточка ---
                // Тень не обязательна: в ДС есть плоские карточки (appearance flat/outline).
                // Признак — крупная залитая поверхность со скруглением, а не «тень + радиус».
                add('hand-card', el, 'Самодельная карточка (фон + скругление). Нужен <div tuiCardLarge="normal" appearance="…"> — отступы, радиус и тень заданы в ДС.');
            }

            // --- Самодельное поле ---
            if ((tag === 'input' && !['hidden', 'checkbox', 'radio', 'file'].includes(el.type)) || tag === 'textarea' || tag === 'select') {
                if (!el.closest('[tuiTextfield]')) {
                    add('hand-input', el, 'Поле ввода без компонента ДС. Нужен <tui-textfield> с контролом input[tuiInput] внутри.');
                }
            }

            // --- Цвет не из токенов ---
            const col = norm(cs.color);
            const pcol = el.parentElement ? norm(getComputedStyle(el.parentElement).color) : '';
            if (col && col !== pcol && text && colors.size && !colors.has(col)) {
                add('color', el, `Цвет текста ${cs.color} не из токенов. Красим только var(--tui-text-…), --tui-background-…, --tui-border-…`);
            }
            // Фон проверяем только если он задан элементом, а не браузером по умолчанию:
            // у <button> и <input> без стилей он есть всегда (rgb(239,239,239)) и это не выбор автора.
            const UA_BG = /^rgb\(239,239,239\)$|^rgba\(239,239,239,1\)$/;
            const ownBg = hasBg && !(UA_BG.test(cs.backgroundColor) && ['button', 'input', 'select', 'textarea'].includes(tag));
            if (ownBg && colors.size && !colors.has(bg)) {
                add('color', el, `Фон ${cs.backgroundColor} не из токенов. Используйте var(--tui-background-…) или компонент ДС.`);
            }

            // --- Типографика руками: смотрим на явные признаки, а не на разницу с родителем.
            //     Разница с родителем — норма: шкалу ДС задаёт класс или сам компонент.
            const inline = el.getAttribute('style') || '';
            // inherit и var(--tui-…) — следование ДС, а не своё значение. Нарушение только
            // конкретное число/шрифт, заданный руками.
            const ownType = [...inline.matchAll(/(?:font-size|font-weight|font-family|line-height|letter-spacing)\s*:\s*([^;]+)/g)]
                .map(m => m[1].trim())
                .filter(v => !/^(inherit|unset|initial|revert)$/.test(v) && !/^var\(\s*--tui-/.test(v));
            if (ownType.length) {
                add('type', el, `Типографика задана руками («${ownType.join('; ').slice(0, 50)}»). Возьмите переменную шкалы: font: var(--tui-font-ui-m | body-m | heading-5 …) или [tuiHeader]="h3". Классов tui-heading-* в оригинале нет.`);
            }
        }
        return out;
    }

    /** Проверяет существование файлов иконок. Резолвер строит путь из имени иконки. */
    async function checkIcons(out, add) {
        const uniq = [...iconRefs.keys()];
        await Promise.all(uniq.map(async (icon) => {
            // @tui.pragmatic.small.check → pragmatic/small/check.svg
            const rel = icon.replace(/^@(?:tui|img)\./, '').replaceAll('.', '/') + '.svg';
            // Резолвер Taiga строит ровно один путь — по нему и проверяем.
            // Запасной «по короткому имени» маскировал бы настоящую ошибку пути.
            try {
                const r = await fetch(`assets/taiga-ui/icons/${rel}`, {method: 'HEAD'});
                if (r.ok) return;
            } catch { /* ниже отдадим нарушение */ }
            const el = iconRefs.get(icon);
            out.push({rule: 'icon', where: describe(el), message: `Иконки «${icon}» нет в assets: файл ${rel} не найден. Отрендерится пустой, без ошибки в консоли.`});
        }));
    }

    /** Плашка внизу слева: видно без консоли. */
    function badge(list) {
        let box = document.getElementById('tui-check-badge');
        if (!box) {
            box = document.createElement('div');
            box.id = 'tui-check-badge';
            box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;font:13px/1.4 -apple-system,sans-serif;background:#1b1b1b;color:#fff;border-radius:10px;padding:10px 14px;max-width:520px;max-height:45vh;overflow:auto;box-shadow:0 6px 24px rgba(0,0,0,.3);cursor:pointer';
            document.body.appendChild(box);
        }
        const ok = list.length === 0;
        box.style.background = ok ? '#0a7a3d' : '#b3261e';
        box.textContent = ok ? 'ДС: нарушений 0' : `ДС: нарушений — ${list.length}`;
        box.onclick = () => {
            box.style.background = '#1b1b1b';
            box.textContent = '';
            const pre = document.createElement('div');
            pre.textContent = list.map((v, i) => `${i + 1}. [${v.rule}] ${v.where}\n   ${v.message}`).join('\n\n');
            pre.style.whiteSpace = 'pre-wrap';
            box.appendChild(pre);
        };
    }

    /** Перехват 404 на иконках: единственный надёжный способ узнать, что файла нет. */
    /** NG0309 роняет приложение целиком: ловим из консоли и запоминаем. */
    function watchErrors() {
        const orig = console.error;
        console.error = function (...a) {
            const msg = a.map(String).join(' ');
            if (/NG0309|matches multiple times/i.test(msg)) {
                state.runtimeErrors.push({rule: 'ng0309', where: 'приложение', message: msg.slice(0, 300)});
            }
            return orig.apply(this, a);
        };
    }

    function watchIcons() {
        const orig = window.fetch;
        window.fetch = function (...a) {
            const url = typeof a[0] === 'string' ? a[0] : a[0]?.url || '';
            return orig.apply(this, a).then(r => {
                if (r.status === 404 && /\.svg(\?|$)/.test(url)) {
                    state.missingIcons.add(url.split('/').slice(-2).join('.'));
                }
                return r;
            });
        };
        document.addEventListener('error', (e) => {
            const t = e.target;
            if (t && t.tagName === 'IMG' && /\.svg/.test(t.src || '')) state.missingIcons.add(t.src);
        }, true);
    }

    window.TaigaCheck = {
        async check(opts = {}) {
            await loadApi();
            const list = [...run(), ...state.runtimeErrors, ...(window.TaigaCheckCopy ? window.TaigaCheckCopy() : [])];
            await checkIcons(list, null);
            if (opts.badge !== false) badge(list);
            if (opts.log !== false) console.table(list.map(v => ({rule: v.rule, where: v.where, message: v.message})));
            return list;
        },
        /** Для playwright: список без побочных эффектов. */
        async report() {
            await loadApi();
            const list = [...run(), ...state.runtimeErrors, ...(window.TaigaCheckCopy ? window.TaigaCheckCopy() : [])];
            await checkIcons(list, null);
            return list;
        },
    };

    watchIcons();
    watchErrors();

    // Автозапуск по атрибуту на body — как у коллеги, привычно для глаза.
    if (document.currentScript && document.currentScript.hasAttribute('data-auto')) {
        window.addEventListener('load', () => setTimeout(() => window.TaigaCheck.check(), 300));
    }
})();
