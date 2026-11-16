import { React, T } from '../runtime.js';
const h = React.createElement;

const options = [
  ['doc', 'Выписка', 'Операции за выбранный период'],
  ['check', 'Справка', 'Подтверждение реквизитов счета'],
  ['letter', 'Письмо в банк', 'Свободная форма']
];

// Получает {control, resetVersion}. Экраны рисуются внутри рамки телефона 375 px.
export function Mobile({ resetVersion }) {
  const [step, setStep] = React.useState(0);
  const [choice, setChoice] = React.useState(0);
  React.useEffect(() => { setStep(0); setChoice(0); }, [resetVersion]);
  if (step === 1) {
    return h(T.PageLayout, { platform: 'mobile', header: { title: 'Готово' } },
      h(T.BlockStatus, { platform: 'mobile', title: 'Документ заказан', description: options[choice][1],
        action: h(T.Button, { platform: 'mobile', appearance: 'secondary', onClick: () => setStep(0) }, 'Заказать еще') }));
  }
  return h(T.PageLayout, { platform: 'mobile', header: { title: 'Заказ документа' } },
    h(T.CardLarge, { platform: 'mobile', title: 'Что нужно' },
      options.map(([avatar, title, description], i) => h(T.Cell, { key: title, platform: 'mobile', avatar, title, description, onClick: () => setChoice(i) })),
      h(T.Button, { platform: 'mobile', onClick: () => setStep(1) }, 'Продолжить')));
}

// Десктоп: те же два шага на PageLayout в одну колонку, в рамке 1360 × 800.
export function Desktop({ resetVersion }) {
  const [step, setStep] = React.useState(0);
  const [choice, setChoice] = React.useState(0);
  React.useEffect(() => { setStep(0); setChoice(0); }, [resetVersion]);
  if (step === 1) {
    return h(T.PageLayout, { layout: 'single', level: 'nested', header: { title: 'Готово', titleAlign: 'center' } },
      h(T.BlockStatus, { title: 'Документ заказан', text: options[choice][1],
        actions: [{ label: 'Заказать еще', appearance: 'secondary', onClick: () => setStep(0) }] }));
  }
  return h(T.PageLayout, { layout: 'single', header: { title: 'Заказ документа' } },
    h(T.CardLarge, { title: 'Что нужно' },
      options.map(([avatar, title, description], i) => h(T.Cell, { key: title, avatar, title, description, control: 'radio', checked: i === choice, onClick: () => setChoice(i) })),
      h(T.Button, { onClick: () => setStep(1) }, 'Продолжить')));
}
