// Dev-режим инлайн-редактирования: Alt+E на странице включает правку текста,
// после выхода из поля новый текст записывается в строковый литерал в исходниках.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['screens'];
const EXT = /\.(js|mjs|ts|tsx|jsx)$/;

const files = () => ROOTS.flatMap(r => readdirSync(r, { recursive: true })
  .filter(p => EXT.test(p) && !p.includes('node_modules') && !p.includes('_starter')).map(p => join(r, p)));

const SPECIAL = /[\u00a0\u202f\u2009\u2011\u2013\u2014]/g;
const uEsc = t => t.replace(SPECIAL, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const variants = (text, quote, escapeSpecial) => {
  let esc = text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  if (escapeSpecial) esc = uEsc(esc);
  return quote === "'" ? esc.replace(/'/g, "\\'") : quote === '"' ? esc.replace(/"/g, '\\"') : esc.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
};

export function applyInlineEdit(from, to) {
  const changes = new Map();
  let count = 0;
  for (const file of files()) {
    let src = readFileSync(file, 'utf8'), changed = false;
    for (const q of ["'", '"', '`']) {
      for (const esc of [false, true]) {
        const needle = q + variants(from, q, esc) + q;
        if (!src.includes(needle)) continue;
        const parts = src.split(needle);
        count += parts.length - 1;
        src = parts.join(q + variants(to, q, esc) + q);
        changed = true;
      }
    }
    if (changed) { changes.set(file, src); }
  }
  if (!count) return { ok: false, error: 'Не нашёл эту строку в коде целиком (возможно, текст собирается из частей).' };
  for (const [f, src] of changes) writeFileSync(f, src);
  return { ok: true, file: [...changes.keys()].join(', ') + (count > 1 ? ` (замен: ${count})` : '') };
}

export const inlineEditClient = `
(() => {
  let on = sessionStorage.inlineEdit === '1';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;z-index:99999;left:50%;bottom:12px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:#222;color:#fff;font:13px/1.3 system-ui;display:none;pointer-events:none';
  document.addEventListener('DOMContentLoaded', () => document.body.append(bar));
  const say = (t, bad) => { bar.style.display = 'block'; bar.style.background = bad ? '#c4281c' : '#222'; bar.textContent = t; clearTimeout(say.t); say.t = setTimeout(show, 3500); };
  const show = () => { bar.style.background = '#222'; bar.style.display = on ? 'block' : 'none'; bar.textContent = 'Режим правки текста включён'; };
  const style = document.createElement('style');
  style.textContent = '[data-ie]{outline:2px solid #ffdd2d !important;outline-offset:2px;cursor:text !important}.ie-on *:hover{outline:2px dashed var(--tui-background-accent-2,#428bf9);outline-offset:2px}';
  document.head.append(style);
  const sync = () => { document.documentElement.classList.toggle('ie-on', on); show(); dispatchEvent(new CustomEvent('inline-edit-change', {detail: on})); };
  const set = v => { on = v; sessionStorage.inlineEdit = on ? '1' : '0'; sync(); };
  window.inlineEdit = {get: () => on, set};
  addEventListener('keydown', e => { if (e.altKey && e.code === 'KeyE') set(!on); });
  addEventListener('DOMContentLoaded', sync);
  const leaf = el => { for (; el && el !== document.body; el = el.parentElement) if (el.childNodes.length && [...el.childNodes].every(n => n.nodeType === 3) && el.textContent.trim()) return el; };
  let cur, orig;
  addEventListener('click', e => {
    if (!on) return;
    const el = leaf(e.target);
    if (!el && !e.target.closest('[data-ie]')) return;
    e.preventDefault(); e.stopPropagation();
    if (el && el !== cur) { cur = el; orig = el.textContent; el.dataset.ie = ''; el.contentEditable = 'plaintext-only'; el.focus(); }
  }, true);
  for (const t of ['mousedown', 'pointerdown', 'mouseup', 'pointerup']) addEventListener(t, e => { if (on && !e.target.closest('[data-ie]')) { e.stopPropagation(); } }, true);
  addEventListener('keydown', e => { if (cur && e.key === 'Enter') { e.preventDefault(); cur.blur(); } if (cur && e.key === 'Escape') { cur.textContent = orig; cur.blur(); } if (cur) e.stopPropagation(); }, true);
  addEventListener('focusout', async e => {
    if (e.target !== cur) return;
    const el = cur, from = orig, to = el.textContent; cur = null;
    el.removeAttribute('data-ie'); el.removeAttribute('contenteditable');
    if (from === to) return;
    const r = await (await fetch('/__inline-edit', { method: 'POST', body: JSON.stringify({ from, to }) })).json();
    if (r.ok) say('Сохранено в ' + r.file); else { el.textContent = from; say(r.error, true); }
  }, true);
})();`;

export function handleInlineEdit(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let out;
    try { const { from, to } = JSON.parse(body); out = applyInlineEdit(from, to); } catch (e) { out = { ok: false, error: String(e) }; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(out));
  });
}
