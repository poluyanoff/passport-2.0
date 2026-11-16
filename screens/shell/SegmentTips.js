import { React, T } from '../runtime.js';
const h = React.createElement;
// Segmented has no per-item tooltips: each item gets a DS TooltipHost on a fixed anchor laid over it.
function SegmentTips({labels, children}) {
  const root = React.useRef(null);
  const [rects, setRects] = React.useState([]);
  const [active, setActive] = React.useState(-1);
  React.useLayoutEffect(() => {
    const measure = () => setRects([...root.current.querySelectorAll('.tui-seg__item')].map(item => ({left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight})));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const locate = event => {
    const items = [...root.current.querySelectorAll('.tui-seg__item')];
    setActive(items.indexOf(event.target.closest?.('.tui-seg__item')));
  };
  return h('div', {ref: root, className: 'segment-tips', onMouseOver: locate, onFocus: locate, onMouseLeave: () => setActive(-1), onBlur: () => setActive(-1)},
    children,
    labels.map((label, index) => rects[index] && h(T.TooltipHost, {key: label, content: label, open: active === index, side: 'bottom', platform: 'desktop', className: 'segment-tips__anchor', style: {...rects[index], position: 'absolute', pointerEvents: 'none'}}, h('span'))));
}
export { SegmentTips };
