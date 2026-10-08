import {
  cloneElement,
  useId,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

export function Tooltip({
  text,
  children,
  disabled = false,
}: {
  text: string;
  children: ReactElement<{ 'aria-describedby'?: string; title?: string }>;
  disabled?: boolean;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const hide = () => {
    setVisible(false);
    setPosition(null);
  };

  useLayoutEffect(() => {
    if (!visible || !anchor.current || !bubble.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const box = bubble.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.right - box.width, window.innerWidth - box.width - 8)),
      top:
        rect.bottom + box.height + 8 < window.innerHeight
          ? rect.bottom + 8
          : Math.max(8, rect.top - box.height - 8),
    });
  }, [visible, text]);
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setVisible(false);
      setPosition(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [visible]);

  return (
    <span
      ref={anchor}
      className="app-tooltip-trigger"
      tabIndex={disabled ? 0 : undefined}
      aria-label={disabled ? text : undefined}
      aria-describedby={disabled && visible ? id : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => {
        if (!anchor.current?.contains(document.activeElement)) hide();
      }}
      onFocus={() => setVisible(true)}
      onBlur={hide}
      onClick={hide}
      onKeyDown={(event) => {
        if (visible && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hide();
        }
      }}
    >
      {cloneElement(children, {
        title: undefined,
        'aria-describedby': visible
          ? [children.props['aria-describedby'], id].filter(Boolean).join(' ')
          : children.props['aria-describedby'],
      })}
      {visible &&
        createPortal(
          <span
            ref={bubble}
            id={id}
            role="tooltip"
            className="app-action-tooltip"
            style={position ? position : { left: 0, top: 0, visibility: 'hidden' }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
