/* Тестовый флоу на общей оболочке (screens/shell). Образец: вкладки «О задаче / Решение / Спецификации», Desktop/Mobile, «Начать сначала». */
import { mountFlow } from '../shell/FlowShell.js';
import { Mobile, Desktop } from './solution.js';
import { about, spec } from './content.js';

mountFlow(document.getElementById('root'), {
  title: 'Тестовый флоу',
  baseUrl: new URL('/screens/demo-flow/', window.location.origin),
  resetKeys: [],
  solution: {mobile: Mobile, desktop: Desktop},
  about,
  spec
});
