import { useRef, useCallback, useEffect, useState } from 'react';
import { autoT } from '@/i18n/auto';

interface QuickTallyButtonProps {
  value: number;
  onChange: (newValue: number) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  valueClassName?: string;
}

/**
 * Touch-optimized counter button for quick tally.
 * - Tap: +1
 * - Long press (500ms): -1
 * Touch movement is deliberately ignored so scrolling a list never changes a count.
 */
export default function QuickTallyButton({
  value,
  onChange,
  label,
  disabled = false,
  className,
  valueClassName,
}: QuickTallyButtonProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosition = useRef<{ x: number; y: number } | null>(null);
  const touchMoved = useRef(false);
  const wasLongPress = useRef(false);
  const lastTouchAt = useRef<number>(0);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const showFeedback = useCallback((delta: 1 | -1) => {
    setFeedback(delta);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 900);
  }, []);

  const isLikelySyntheticMouseEvent = useCallback(() => {
    // Mobile browsers often fire mouse events after touch.
    // Ignore mouse events shortly after a touch interaction to prevent double triggers.
    return Date.now() - lastTouchAt.current < 800;
  }, []);

  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);

  const increment = useCallback(() => {
    if (disabled) return;
    triggerHaptic();
    onChange(value + 1);
    showFeedback(1);
  }, [value, onChange, disabled, showFeedback, triggerHaptic]);

  const decrement = useCallback(() => {
    if (disabled || value <= 0) return;
    triggerHaptic();
    onChange(Math.max(0, value - 1));
    showFeedback(-1);
  }, [value, onChange, disabled, showFeedback, triggerHaptic]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      lastTouchAt.current = Date.now();
      touchStartPosition.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      touchMoved.current = false;
      wasLongPress.current = false;

      longPressTimer.current = setTimeout(() => {
        wasLongPress.current = true;
        decrement();
      }, 500);
    },
    [disabled, decrement]
  );

  const handleTouchEnd = useCallback(
    () => {
      lastTouchAt.current = Date.now();
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      const wasScrollGesture = touchMoved.current;
      touchStartPosition.current = null;
      touchMoved.current = false;

      if (wasScrollGesture) return;

      // Only increment if it wasn't a long press
      if (!wasLongPress.current) {
        increment();
      }
    },
    [increment]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    lastTouchAt.current = Date.now();
    const start = touchStartPosition.current;
    const touch = e.touches[0];
    if (
      start &&
      touch &&
      (Math.abs(touch.clientX - start.x) > 10 || Math.abs(touch.clientY - start.y) > 10)
    ) {
      touchMoved.current = true;
    }
    // A real gesture cancels a pending long press as well as the final tap.
    if (!touchMoved.current) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPosition.current = null;
    touchMoved.current = true;
  }, []);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    if (isLikelySyntheticMouseEvent()) return;
    wasLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      decrement();
    }, 500);
  }, [disabled, decrement, isLikelySyntheticMouseEvent]);

  const handleMouseUp = useCallback(() => {
    if (isLikelySyntheticMouseEvent()) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!wasLongPress.current && !disabled) {
      increment();
    }
  }, [increment, disabled, isLikelySyntheticMouseEvent]);

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Context menu for decrement on desktop (right-click)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isLikelySyntheticMouseEvent()) return;
      decrement();
    },
    [decrement, isLikelySyntheticMouseEvent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled || e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        increment();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        decrement();
      }
    },
    [disabled, decrement, increment],
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      className={`
        relative select-none
        min-w-[3.5rem] min-h-[3.5rem] 
        px-3 py-2
        rounded-lg border-2
        font-bold text-xl
        transition-all duration-150
        ${disabled
            ? "cursor-not-allowed"
            : "active:scale-95 cursor-pointer"
        }
        ${className || ''}
      `}
        style={disabled
          ? { backgroundColor: 'var(--input-disabled-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-faint)' }
          : { backgroundColor: 'var(--surface-1)', borderColor: 'var(--cambridge-blue)', color: 'var(--viridian)' }
        }
      aria-label={label ? `${label}: ${value}` : autoT('ui_4d730a6286e0', { value0: value })}
    >
      <span className={`text-2xl tabular-nums ${valueClassName || ''}`}>{value}</span>
      {feedback ? (
        <span
          aria-live="polite"
          className={`pointer-events-none absolute -right-1 -top-2 rounded-full bg-[var(--surface-elevated)] px-1.5 py-0.5 text-xs font-bold shadow-sm ${
            feedback === -1 ? 'text-[var(--status-danger-text)]' : 'text-[var(--viridian)]'
          }`}
        >
          {feedback === -1 ? '−1' : '+1'}
        </span>
      ) : null}
    </button>
  );
}
