import {createDialRoot, mountButtonGroup} from 'dialkit/vanilla';
import {STEPS} from './steps.data';

/*
 * Панель разработчика: быстрый прыжок на любой шаг.
 * Только для локальной сборки, на пользователей не попадает —
 * подключается под флагом isDevMode() и удаляется одной строкой.
 */
export function mountDevNav(go: (index: number) => void): () => void {
    const root = createDialRoot({position: 'top-right', defaultOpen: false});
    const body = document.createElement('div');
    body.className = 'guide-dev-nav-steps';
    // Кладём кнопки внутрь панели, а не рядом с ней: после монтирования
    // переносим body в .dialkit-panel, который создаёт createDialRoot.
    root.element.appendChild(body);
    queueMicrotask(() => {
        const panel = root.element.querySelector('.dialkit-panel');

        if (panel) {
            panel.appendChild(body);
        }
    });

    const group = mountButtonGroup(body, {
        buttons: STEPS.map((s, i) => ({
            label: `${i + 1}. ${s.nav}`,
            onClick: () => go(i),
        })),
    });

    return () => {
        group.destroy();
        root.destroy();
    };
}
