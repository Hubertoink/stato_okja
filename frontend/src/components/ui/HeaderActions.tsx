import type { ComponentProps } from 'react';
import { Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { IconButton } from './Button';
import { Input } from './Field';

/** Standard search trigger and popover for list page headers. */
export function HeaderSearchAction({
  clearLabel,
  closeLabel,
  onClear,
  onOpenChange,
  onValueChange,
  open,
  openLabel,
  placeholder,
  value,
}: {
  clearLabel: string;
  closeLabel: string;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  open: boolean;
  openLabel: string;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="relative">
      {open ? (
        <div className="header-action-popover" role="search">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <Input
              autoFocus
              className="mt-0 py-2 pl-9 pr-10"
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
              type="search"
              value={value}
            />
            {value.trim() ? (
              <IconButton
                aria-label={clearLabel}
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={onClear}
                size="icon-compact"
                title={clearLabel}
                variant="ghost"
              >
                <XCircle aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
      ) : null}
      <IconButton
        aria-label={open ? closeLabel : openLabel}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        title={open ? closeLabel : openLabel}
        variant="secondary"
      >
        <Search aria-hidden="true" />
      </IconButton>
    </div>
  );
}

/** Standard filter trigger for list page headers. */
export function HeaderFilterButton({
  className = '',
  ...props
}: Omit<ComponentProps<typeof IconButton>, 'aria-label' | 'children' | 'variant'> & {
  'aria-label': string;
}) {
  return (
    <IconButton
      className={className}
      variant="secondary"
      {...props}
    >
      <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
    </IconButton>
  );
}
