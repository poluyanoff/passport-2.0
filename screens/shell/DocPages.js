import { React, T } from '../runtime.js';
const h = React.createElement;

/* Рендер блоков документа из данных.
   'текст'                 → абзац
   ['h', 'Заголовок']      → подзаголовок
   ['b', 'Жирный абзац']   → жирный абзац
   ['badge', 'Метка']      → плашка
   ['ul', ['a', 'b']]      → список
   ['code', 'текст']       → блок кода */
export function renderBlocks(items) {
  return (typeof items === 'string' ? [items] : items).map((item, i) => {
    if (typeof item === 'string') return h('p', {key: i, className: 'about-p tui-body-m'}, item);
    if (item[0] === 'h') return h('h3', {key: i, className: 'about-h3 tui-heading-6'}, item[1]);
    if (item[0] === 'b') return h('p', {key: i, className: 'about-p tui-body-m-bold'}, item[1]);
    if (item[0] === 'badge') return h('span', {key: i, className: 'about-badge tui-ui-s-bold'}, item[1]);
    if (item[0] === 'code') return h('pre', {key: i, className: 'about-code tui-body-s'}, h('code', null, item[1]));
    return h('ul', {key: i, className: 'about-ul tui-body-m'}, item[1].map(t => h('li', {key: t}, t)));
  });
}
const sections = list => list.map(([title, body]) => h('div', {key: title, className: 'about-block'}, h('h2', {className: 'about-h2 tui-heading-3'}, title), renderBlocks(body)));
const crumbs = text => text && h('p', {className: 'about-p about-crumbs tui-body-m'}, text);

/* Лист документа. Поля: crumbs, title, intro (блоки), links, sections, team. Нужные — по очереди. */
function Sheet({crumbs: path, title, intro, links, sections: body, team}) {
  return h('section', {className: 'about-sheet'},
    crumbs(path),
    h('h1', {className: 'about-h1 tui-heading-1'}, title),
    intro && renderBlocks(intro),
    links && h('div', {className: 'about-links'}, links.map(([label, href, kind, icon]) => h(href ? 'a' : 'span', {key: label, className: 'about-link tui-ui-s-bold about-link--' + (kind || 'neutral'), href, target: href ? '_blank' : undefined, rel: href ? 'noreferrer' : undefined}, h(T.Icon, {name: icon, size: 16, color: 'currentColor'}), h('span', {className: 'about-link__label'}, label)))),
    body && sections(body),
    team && team.map(([name, role, login]) => h('div', {key: name, className: 'about-block'},
      h('div', {className: 'about-person'}, h('h2', {className: 'about-h2 tui-heading-4'}, name),
        h('span', {className: 'about-nick tui-ui-s-bold'}, h('svg', {width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true}, h('path', {d: 'M2 12.5V5l3.5 3L8 3.5 10.5 8 14 5v7.5z', fill: 'currentColor'})), login)),
      h('p', {className: 'about-p tui-body-m'}, role))));
}
export const DocPages = ({sheets}) => h('article', {className: 'about-task'}, sheets.map((sheet, i) => h(Sheet, {key: i, ...sheet})));
