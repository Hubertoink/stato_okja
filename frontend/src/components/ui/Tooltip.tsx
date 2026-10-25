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
  placement = 'top',
  enabled = true,
}: {
  text: string;
  children: ReactElement<{ 'aria-describedby'?: string; title?: string }>;
  disabled?: boolean;
  placement?: 'top' | 'right';
  enabled?: boolean;
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
  const shown = enabled && visible;
  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      setPosition(null);
    }
  }, [enabled]);

  useLayoutEffect(() => {
    if (!visible || !anchor.current || !bubble.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const box = bubble.current.getBoundingClientRect();
    if (placement === 'right') {
      const preferredLeft = rect.right + 8;
      setPosition({
        left: Math.max(8, Math.min(preferredLeft, window.innerWidth - box.width - 8)),
        top: Math.max(
          8,
          Math.min(rect.top + (rect.height - box.height) / 2, window.innerHeight - box.height - 8),
        ),
      });
      return;
    }
    setPosition({
      left: Math.max(
        8,
        Math.min(rect.left + (rect.width - box.width) / 2, window.innerWidth - box.width - 8),
      ),
      top:
        rect.top - box.height - 6 >= 8
          ? rect.top - box.height - 6
          : Math.min(window.innerHeight - box.height - 8, rect.bottom + 6),
    });
  }, [visible, text, placement]);
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
      aria-describedby={disabled && shown ? id : undefined}
      onMouseEnter={() => {
        if (enabled) setVisible(true);
      }}
      onMouseLeave={() => {
        if (!anchor.current?.contains(document.activeElement)) hide();
      }}
      onFocus={() => {
        if (enabled) setVisible(true);
      }}
      onBlur={hide}
      onClick={hide}
      onKeyDown={(event) => {
        if (shown && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hide();
        }
      }}
    >
      {cloneElement(children, {
        title: undefined,
        'aria-describedby': shown
          ? [children.props['aria-describedby'], id].filter(Boolean).join(' ')
          : children.props['aria-describedby'],
      })}
      {shown &&
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
