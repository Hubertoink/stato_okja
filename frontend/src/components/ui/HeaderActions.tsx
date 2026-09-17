import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchorRef.current?.contains(event.target)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportWidth = document.documentElement.clientWidth;
      const width = popoverRef.current?.getBoundingClientRect().width || 0;
      const left = Math.max(16, Math.min(anchor.right - width, viewportWidth - width - 16));
      setOffset(anchor.right - left - width);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  return (
    <div className="relative" ref={anchorRef} onKeyDown={(event) => {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
        anchorRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
      }
    }}>
      {open ? (
        <div ref={popoverRef} className="header-action-popover" role="search" style={{ right: offset }}>
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
