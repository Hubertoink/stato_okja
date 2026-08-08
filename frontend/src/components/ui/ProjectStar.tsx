import { Star, StarOff } from 'lucide-react';
import { IconButton, type ButtonSize } from './Button';

type ProjectStarSize = 'sm' | 'md';

/** Consistent passive marker for projects highlighted by the user. */
export function ProjectStarIndicator({ className = '', size = 'md' }: { className?: string; size?: ProjectStarSize }) {
  return <Star aria-hidden="true" className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 fill-current text-amber-400 drop-shadow-sm ${className}`.trim()} />;
}

/** Consistent, accessible toggle for highlighting a project. */
export function ProjectStarButton({
  ariaLabel,
  className = '',
  onClick,
  starred,
  title,
  size = 'icon-compact',
}: {
  ariaLabel: string;
  className?: string;
  onClick: () => void;
  starred: boolean;
  title?: string;
  size?: Extract<ButtonSize, 'icon-compact' | 'icon' | 'icon-touch'>;
}) {
  return (
    <IconButton
      aria-label={ariaLabel}
      aria-pressed={starred}
      className={`border-transparent bg-transparent ${starred
        ? 'text-amber-400 hover:bg-amber-400/15 hover:text-amber-500'
        : 'text-[var(--text-muted)] hover:bg-amber-400/10 hover:text-amber-400'} ${className}`}
      onClick={onClick}
      size={size}
      title={title}
      variant="ghost"
    >
      {starred ? <Star aria-hidden="true" fill="currentColor" /> : <StarOff aria-hidden="true" />}
    </IconButton>
  );
}
