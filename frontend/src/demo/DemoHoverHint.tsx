import { useEffect, useId, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import { demoModeEnabled } from './config';
import { autoT } from '@/i18n/auto';

type DemoHoverHintPlacement = 'top' | 'bottom';
type DemoHoverHintAlign = 'start' | 'end';

type ActiveHintListener = (activeHintId: string | null) => void;

let activeDemoHoverHintId: string | null = null;
const activeHintListeners = new Set<ActiveHintListener>();

function setActiveDemoHoverHint(nextHintId: string | null) {
  activeDemoHoverHintId = nextHintId;
  activeHintListeners.forEach((listener) => listener(activeDemoHoverHintId));
}

function clearActiveDemoHoverHint(hintId: string) {
  if (activeDemoHoverHintId === hintId) setActiveDemoHoverHint(null);
}

export default function DemoHoverHint({
  title,
  description,
  placement = 'top',
  align = 'start',
  className = '',
  children,
}: {
  title: string;
  description: string;
  placement?: DemoHoverHintPlacement;
  align?: DemoHoverHintAlign;
  className?: string;
  children: ReactNode;
}) {
  const tooltipId = useId();
  const isMobileHint = useIsMobile(768);
  const [activeHintId, setActiveHintId] = useState(activeDemoHoverHintId);
  const isOpen = activeHintId === tooltipId;

  useEffect(() => {
    activeHintListeners.add(setActiveHintId);
    setActiveHintId(activeDemoHoverHintId);

    return () => {
      activeHintListeners.delete(setActiveHintId);
      clearActiveDemoHoverHint(tooltipId);
    };
  }, [tooltipId]);

  const openHint = () => setActiveDemoHoverHint(tooltipId);
  const closeHint = () => clearActiveDemoHoverHint(tooltipId);
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) closeHint();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') closeHint();
  };

  if (!demoModeEnabled || isMobileHint) return <>{children}</>;

  return (
    <div
      className={`demo-hover-hint demo-hover-hint-${placement} demo-hover-hint-align-${align} ${className}`.trim()}
      aria-describedby={isOpen ? tooltipId : undefined}
      data-demo-hint-open={isOpen ? "true" : undefined}
      onBlurCapture={handleBlur}
      onFocusCapture={openHint}
      onKeyDownCapture={handleKeyDown}
      onPointerEnter={openHint}
      onPointerLeave={closeHint}
    >
      {children}
      <div id={tooltipId} className="demo-hover-hint-panel" role="tooltip">
        <div className="demo-hover-hint-kicker">{autoT('ui_57888d6f71a5')}</div>
        <div className="demo-hover-hint-title">{title}</div>
        <div className="demo-hover-hint-description">{description}</div>
      </div>
    </div>
  );
}