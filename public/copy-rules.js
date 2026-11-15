/* copy-rules.js — механические правила редполитики для TaigaCheck.
 *
 * Только то, что однозначно ловится по тексту. Смысл, залог, канцелярит и роль строки
 * проверяются человеком по canon/30-copy.md — здесь их не оценить, и ложные срабатывания
 * хуже пропуска.
 *
 * Подключается после check-dom.js: расширяет window.TaigaCheck.copyRules.
 */
(function () {
    'use strict';
    const R = [
        // [код, регулярка, сообщение, ограничение по роли: undefined = любая строка]
        ['TP3', /[ёЁ]/, 'Буква «ё»: пишем «е» (расчетный счет, еще, все). Исключение — только когда без «ё» меняется смысл («всё»).'],
        ['BR6', /Не\s+удалось/i, '«Не удалось» → «Не получилось».'],
        ['BR7', /!/, 'Восклицательный знак убрать.'],
        ['TN1', /Пожалуйста|К\s+сожалению|Извините/i, 'Вежливые слова-паразиты убрать (Пожалуйста, К сожалению, Извините).'],
        ['VL1', /(^|\s)Введите(\s|$)/, '«Введите …» → «Напишите …» / «Выберите …».'],
        ['TN5', /[.!?,:;]\s+Вы(\s|$)|[.!?]\s+Ваш/, '«Вы»/«Ваш» с заглавной в середине текста: «вы», «ваш».'],
        ['BR1', /Т-банк|Тбанк|Т-БАНК/, '«Т-банк» → «Т-Банк».'],
        ['BR3', /(^|\s)смс(\s|$)|СМС\s+код/i, '«смс» → «СМС», «СМС код» → «СМС-код».'],
        ['BR4', /(^|\s)средств[ао]?(\s|$)/i, '«средства» → «деньги».'],
        ['BR8', /еще\s+раз/i, '«еще раз» → «снова».'],
        ['TP4', /\d\s?(руб\.?|р\.)(\s|$)/, '«руб.», «р.» → ₽.'],
        ['TP7', /->/, '«->» → «→».'],
        ['TP1', /"[^"]+"/, 'Прямые кавычки → «ёлочки».'],
    ];
    // Строки, которые точка в конце не должна заканчивать (роль определяется по элементу)
    const NO_DOT = 'button, [tuiButton], label, [tuiLabel], h1, h2, h3, h4, h5, h6, [tuiTitle], th, td, [tuiBadge], [tuiChip], tui-toast';

    function textNodes(root) {
        const out = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
            const t = n.nodeValue.replace(/\s+/g, ' ').trim();
            if (!t) continue;
            const el = n.parentElement;
            if (!el || el.closest('[data-tui-check-ignore], [data-tui-copy-ignore], script, style, svg, #tui-check-badge')) continue;
            out.push({t, el});
        }
        return out;
    }

    window.TaigaCheckCopy = function () {
        const found = [];
        for (const {t, el} of textNodes(document.body)) {
            for (const [code, re, msg] of R) {
                if (re.test(t)) found.push({rule: 'copy', where: `${el.tagName.toLowerCase()} «${t.slice(0, 30)}»`, message: `${code}: ${msg}`});
            }
            if (/\.$/.test(t) && !/\.\.\.$/.test(t) && el.closest(NO_DOT) && !/[.!?]\s/.test(t)) {
                found.push({rule: 'copy', where: `${el.tagName.toLowerCase()} «${t.slice(0, 30)}»`, message: 'TP2: точка в конце кнопки, заголовка, лейбла, ячейки или тоста.'});
            }
        }
        for (const i of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
            const t = i.getAttribute('placeholder');
            for (const [code, re, msg] of R) if (re.test(t)) found.push({rule: 'copy', where: `placeholder «${t.slice(0, 30)}»`, message: `${code}: ${msg}`});
        }
        return found;
    };
})();
