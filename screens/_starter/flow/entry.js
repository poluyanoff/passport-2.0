/* Шаблон нового флоу с общей оболочкой (screens/shell).
   Не копируйте папку руками: импорты здесь считаются от screens/_starter/flow, в копии на уровень выше они ломаются.
   Создавайте флоу командой: npm run flow:new -- "Название флоу" (она правит импорты, главную и README).
   Дальше поправьте about/spec и экран в solution.js. Оболочка даёт шапку, переключатель Desktop/Mobile,
   «Начать сначала» и вкладки «О задаче / Решение / Спецификации». */
import { mountFlow } from '../../shell/FlowShell.js';
import { Mobile } from './solution.js';
import { about, spec } from './content.js';

mountFlow(document.getElementById('root'), {
  title: 'Название флоу',
  baseUrl: new URL('/screens/_starter/flow/', window.location.origin), // куда вернуть адрес при «Начать сначала»
  resetKeys: [],                                  // ключи localStorage, которые нужно очистить при сбросе
  solution: {mobile: Mobile, desktop: null},      // desktop: null → заглушка «появится позже»
  // controls: {initial: 'a', render: ({value, setValue}) => ...},  // свои переключатели над телефоном
  about,                                          // убрать строку — вкладки «О задаче» не будет
  spec                                            // то же для «Спецификации»
});
