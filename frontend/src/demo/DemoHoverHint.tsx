import { useId, type ReactNode } from 'react';
import { demoModeEnabled } from './config';

type DemoHoverHintPlacement = 'top' | 'bottom';
type DemoHoverHintAlign = 'start' | 'end';

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

  if (!demoModeEnabled) return <>{children}</>;

  return (
    <div
      className={`demo-hover-hint demo-hover-hint-${placement} demo-hover-hint-align-${align} ${className}`.trim()}
      aria-describedby={tooltipId}
    >
      {children}
      <div id={tooltipId} className="demo-hover-hint-panel" role="tooltip">
        <div className="demo-hover-hint-kicker">Demo-Hinweis</div>
        <div className="demo-hover-hint-title">{title}</div>
        <div className="demo-hover-hint-description">{description}</div>
      </div>
    </div>
  );
}