import { useRef, useCallback } from 'react';

interface QuickTallyButtonProps {
  value: number;
  onChange: (newValue: number) => void;
  label?: string;
  disabled?: boolean;
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
}: QuickTallyButtonProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const wasLongPress = useRef(false);

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
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    wasLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      decrement();
    }, 500);
  }, [disabled, decrement]);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!wasLongPress.current && !disabled) {
      increment();
    }
  }, [increment, disabled]);

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
      decrement();
    },
    [decrement]
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
          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-white border-cambridge-blue text-viridian hover:bg-mint-green active:scale-95 active:bg-cambridge-blue active:text-white cursor-pointer'
        }
      `}
      aria-label={label ? `${label}: ${value}` : `Zähler: ${value}`}
    >
      <span className="text-2xl tabular-nums">{value}</span>
    </button>
  );
}
