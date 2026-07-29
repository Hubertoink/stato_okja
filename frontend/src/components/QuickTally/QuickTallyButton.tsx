import { useRef, useCallback } from 'react';
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
 * - Swipe down: -1
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
  const touchStartY = useRef<number | null>(null);
  const wasLongPress = useRef(false);
  const lastTouchAt = useRef<number>(0);

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
  }, [value, onChange, disabled, triggerHaptic]);

  const decrement = useCallback(() => {
    if (disabled || value <= 0) return;
    triggerHaptic();
    onChange(Math.max(0, value - 1));
  }, [value, onChange, disabled, triggerHaptic]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      lastTouchAt.current = Date.now();
      touchStartY.current = e.touches[0].clientY;
      wasLongPress.current = false;

      longPressTimer.current = setTimeout(() => {
        wasLongPress.current = true;
        decrement();
      }, 500);
    },
    [disabled, decrement]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      lastTouchAt.current = Date.now();
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Detect swipe down
      if (touchStartY.current !== null) {
        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY.current;

        if (deltaY > 30) {
          // Swipe down detected
          decrement();
          touchStartY.current = null;
          return;
        }
      }

      touchStartY.current = null;

      // Only increment if it wasn't a long press
      if (!wasLongPress.current) {
        increment();
      }
    },
    [increment, decrement]
  );

  const handleTouchMove = useCallback(() => {
    lastTouchAt.current = Date.now();
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
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
    </button>
  );
}
