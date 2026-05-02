import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { useIsMobile } from '@/lib/useIsMobile';
import { demoModeEnabled } from './config';

type DemoHoverHintPlacement = 'top' | 'bottom';
type DemoHoverHintAlign = 'start' | 'end';
type DemoHoverHintMobileTriggerPosition = 'stacked' | 'corner';

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
  mobileTriggerPosition = 'stacked',
  className = '',
  children,
}: {
  title: string;
  description: string;
  placement?: DemoHoverHintPlacement;
  align?: DemoHoverHintAlign;
  mobileTriggerPosition?: DemoHoverHintMobileTriggerPosition;
  className?: string;
  children: ReactNode;
}) {
  const tooltipId = useId();
  const titleId = `${tooltipId}-title`;
  const descriptionId = `${tooltipId}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
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
  const toggleHint = () => {
    if (isOpen) closeHint();
    else openHint();
  };

  useEffect(() => {
    if (!demoModeEnabled || !isMobileHint || !isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || mobileTriggerRef.current?.contains(target)) return;
      clearActiveDemoHoverHint(tooltipId);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isMobileHint, isOpen, tooltipId]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) closeHint();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') closeHint();
  };

  if (!demoModeEnabled) return <>{children}</>;

  return (
    <div
      className={`demo-hover-hint demo-hover-hint-${placement} demo-hover-hint-align-${align} ${isMobileHint ? `demo-hover-hint-touch demo-hover-hint-mobile-trigger-${mobileTriggerPosition}` : ''} ${className}`.trim()}
      aria-describedby={!isMobileHint && isOpen ? tooltipId : undefined}
      data-demo-hint-open={isOpen ? 'true' : undefined}
      onBlurCapture={isMobileHint ? undefined : handleBlur}
      onFocusCapture={isMobileHint ? undefined : openHint}
      onKeyDownCapture={handleKeyDown}
      onPointerEnter={isMobileHint ? undefined : openHint}
      onPointerLeave={isMobileHint ? undefined : closeHint}
    >
      {isMobileHint && (
        <div className="demo-hover-hint-mobile-controls">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="demo-hover-hint-mobile-trigger"
            aria-label={isOpen ? 'Demo-Hinweis schließen' : 'Demo-Hinweis anzeigen'}
            aria-expanded={isOpen}
            aria-controls={tooltipId}
            onClick={toggleHint}
          >
            <Info aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
      <div
        ref={panelRef}
        id={tooltipId}
        className="demo-hover-hint-panel"
        role={isMobileHint ? 'dialog' : 'tooltip'}
        aria-modal={isMobileHint ? 'false' : undefined}
        aria-labelledby={isMobileHint ? titleId : undefined}
        aria-describedby={isMobileHint ? descriptionId : undefined}
      >
        {isMobileHint && (
          <button
            type="button"
            className="demo-hover-hint-mobile-close"
            aria-label="Demo-Hinweis schließen"
            onClick={closeHint}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <div className="demo-hover-hint-kicker">Demo-Hinweis</div>
        <div id={titleId} className="demo-hover-hint-title">{title}</div>
        <div id={descriptionId} className="demo-hover-hint-description">{description}</div>
      </div>
    </div>
  );
}