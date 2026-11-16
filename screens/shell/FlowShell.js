import { React, ReactDOM, T } from '../runtime.js';
import { SegmentTips } from './SegmentTips.js';
import { DocPages } from './DocPages.js';
import './shell.css';
const h = React.createElement;

/* Оболочка просмотра флоу: название, переключатель устройств, «Начать сначала»,
   вкладки «О задаче / Решение / Спецификации». Про конкретный флоу ничего не знает.

   mountFlow(root, {
     title,                    название флоу в шапке
     solution: {mobile, desktop}   компоненты решения; desktop: null → заглушка «появится позже»
                               каждый получает {device, controls, resetVersion}
     controls,                 необязательно: {initial, render({value, setValue}), reset?}
                               свои переключатели над телефоном (например, тип клиента)
     resetKeys: [],            ключи localStorage, которые чистит «Начать сначала»
     baseUrl,                  адрес, на который возвращаем историю при сбросе
     about: {sheets}, spec: {sheets}   данные для DocPages
     darkTheme: false,         показать переключатель темы
     bare: false               скрыть оболочку предпросмотра и показать только интерфейс
   }) */
function FlowShell({title, solution, controls, resetKeys = [], baseUrl, about, spec, darkTheme = false, bare = false}) {
  const [resetVersion, setResetVersion] = React.useState(0);
  const [control, setControl] = React.useState(controls?.initial);
  const [dark, setDark] = React.useState(false);
  const [device, setDevice] = React.useState('desktop');
  const [editText, setEditText] = React.useState(() => !!window.inlineEdit?.get());
  React.useEffect(() => {const sync = event => setEditText(event.detail); addEventListener('inline-edit-change', sync); return () => removeEventListener('inline-edit-change', sync);}, []);
  const tabs = [['О задаче', about], ['Решение', true], ['Спецификации', spec]].filter(([, on]) => on).map(([label]) => label);
  const [tab, setTab] = React.useState('Решение');
  React.useEffect(() => {
    const platform = device === 'desktop' ? 'desktop' : 'ios';
    document.documentElement.dataset.theme = `${platform}-${dark ? 'night' : 'day'}`;
  }, [dark, device]);
  function resetFlow() {
    resetKeys.forEach(key => localStorage.removeItem(key));
    if (baseUrl) history.replaceState(null, '', baseUrl);
    setControl(controls?.initial);
    setResetVersion(version => version + 1);
  }
  const Mobile = solution.mobile, Desktop = solution.desktop;
  if (bare) {
    const Screen = Desktop || Mobile;

    return h('main', {className: 'bare-flow'}, Screen ? h(Screen, {key: resetVersion, control, resetVersion}) : null);
  }

  return h(React.Fragment, null,
    h('header', {className: 'topbar', 'data-tui-check-ignore': true},
      h('p', {className: 'flow-title tui-body-m-bold'}, title),
      tab === 'Решение' && h('div', {className: 'top-controls', 'data-tui-check-ignore': true},
        h(SegmentTips, {labels: ['Desktop', 'Mobile']}, h(T.Segmented, {size: 's', activeIndex: device === 'desktop' ? 0 : 1, onChange: index => setDevice(index === 0 ? 'desktop' : 'mobile'), items: [{icon: 'small-pragmatic/device-desktop', ariaLabel: 'Desktop'}, {icon: 'small-pragmatic/device-phone', ariaLabel: 'Mobile'}]})),
        h('div', {className: 'theme-switch', hidden: !darkTheme}, h(SegmentTips, {labels: ['Светлая тема', 'Темная тема']}, h(T.Segmented, {size: 's', activeIndex: dark ? 1 : 0, onChange: index => setDark(index === 1), items: [{icon: 'small-pragmatic/sun', ariaLabel: 'Светлая тема'}, {icon: 'small-pragmatic/night', ariaLabel: 'Темная тема'}]}))),
        h(T.TooltipHost, {content: 'Начать сначала', side: 'bottom', platform: 'desktop'}, h(T.Button, {size: 's', appearance: 'secondary-grayscale', ariaLabel: 'Начать сначала', onClick: resetFlow}, h(T.Icon, {name: 'small-pragmatic/arrow-rewind', size: 16})))),
      h('div', {className: 'top-right', 'data-tui-check-ignore': true},
        window.inlineEdit && h(SegmentTips, {labels: ['Просмотр', 'Редактирование текстов']}, h(T.Segmented, {size: 's', activeIndex: editText ? 1 : 0, onChange: index => window.inlineEdit?.set(index === 1), items: [{icon: 'small-pragmatic/eye', ariaLabel: 'Просмотр'}, {icon: 'small-pragmatic/font', ariaLabel: 'Редактирование текстов'}]})),
        tabs.length > 1 && h('nav', {className: 'top-chips', 'aria-label': 'Разделы'}, tabs.map(label => h(T.Chip, {key: label, size: 's', appearance: 'neutral', selected: label === tab, 'aria-current': label === tab ? 'page' : undefined, onClick: () => setTab(label)}, label))))),
    h('div', {className: 'app-content'},
      h('main', {className: 'solution-pane', hidden: tab !== 'Решение'},
        controls && h('div', {className: 'flow-controls', 'data-tui-check-ignore': true}, h('div', {className: 'flow-controls-actions'}, controls.render({value: control, setValue: setControl}))),
        device === 'desktop' && h('div', {className: 'desktop-viewport'}, Desktop ? h(Desktop, {key: resetVersion, control, resetVersion}) : h('div', {className: 'empty-pane tui-body-m'}, 'Desktop-версия появится позже')),
        h('div', {className: 'phone-viewport', hidden: device === 'desktop'}, h(Mobile, {key: resetVersion, control, resetVersion}))),
      tab === 'О задаче' && about && h('main', {className: 'about-pane'}, h(DocPages, about)),
      tab === 'Спецификации' && spec && h('main', {className: 'about-pane'}, h(DocPages, spec))),
    h('div', {className: 'home-button', 'data-tui-check-ignore': true},
      h(T.Button, {size: 'l', rounded: true, appearance: 'floating', icon: 'medium/home', platform: 'desktop', ariaLabel: 'На главную', title: 'На главную', onClick: () => {window.location.assign('/');}})));
}
export function mountFlow(root, config) {
  ReactDOM.createRoot(root).render(h(FlowShell, config));
}
