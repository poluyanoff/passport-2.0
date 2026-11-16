import { React, ReactDOM } from '../runtime.js';
const h = React.createElement;
// The phone frame is demo infrastructure, outside the design-system components.
// Screens supply their own NavigationBar and FloatingContainer.
function PreviewModal({open, onClose, label, children}) {
  const scroll = React.useRef(null);
  const close = React.useRef(onClose);
  close.current = onClose;
  // Держим модалку в DOM на время анимации закрытия.
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) {setMounted(true); return;}
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    scroll.current?.focus({preventScroll: true});
    const escape = event => {
      if (event.key === 'Escape' && !document.querySelector('.tui-bs__sheet')) {
        event.preventDefault(); close.current();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  if (!open && !mounted) return null;
  return h('div', {className: 'preview-modal' + (open ? '' : ' is-closing'), role: 'dialog', 'aria-modal': true, 'aria-label': label, inert: open ? undefined : ''},
    h('div', {ref: scroll, className: 'preview-modal-scroll', tabIndex: -1}, children));
}
function PhoneOverlay({component, children, ...props}) {
  const [container, setContainer] = React.useState(null);
  React.useLayoutEffect(() => {setContainer(document.querySelector('.phone-viewport'));}, []);
  if (!container) return null;
  return ReactDOM.createPortal(h(component, {...props, inline: true}, children), container);
}
export { PreviewModal, PhoneOverlay };
