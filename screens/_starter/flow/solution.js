import { React, T } from '../../runtime.js';
const h = React.createElement;

// Получает {control, resetVersion}. Рисует экраны внутри рамки телефона 375 px.
export function Mobile() {
  return h(T.PageLayout, {platform: 'mobile', header: {title: 'Заголовок экрана'}},
    h(T.CardLarge, {platform: 'mobile', title: 'Первый блок'},
      h(T.Cell, {platform: 'mobile', title: 'Пункт', description: 'Описание'})));
}
