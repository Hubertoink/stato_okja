import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { useAnchoredPopoverPosition } from '@/components/ui/useAnchoredPopoverPosition';

export default function OrganizationDropdown({
  label,
  currentName,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  currentName: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const position = useAnchoredPopoverPosition(open, panel, anchor);
  const close = () => {
    setOpen(false);
    anchor.current?.querySelector('button')?.focus();
  };
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const selected = panel.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (selected || panel.current?.querySelector<HTMLElement>('button'))?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <>
      <div ref={anchor} className="sidebar-org-anchor">
        <Button
          variant="ghost"
          className="sidebar-org-trigger"
          disabled={disabled}
          aria-label={label}
          title={currentName}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <Building2 aria-hidden="true" />
          <span className="sidebar-label">{currentName}</span>
          <ChevronDown aria-hidden="true" className="sidebar-label sidebar-org-chevron" />
        </Button>
      </div>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label={label}
            className="sidebar-org-menu"
            style={position}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget as Node | null) &&
                !anchor.current?.contains(event.relatedTarget as Node | null)
              )
                setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
                return;
              }
              const items = Array.from(
                panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || [],
              );
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              let next: number;
              if (event.key === 'ArrowDown') next = (current + 1) % items.length;
              else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = items.length - 1;
              else return;
              event.preventDefault();
              items[next]?.focus();
            }}
          >
            <Menu>
              {options.map((option) => (
                <MenuItem
                  key={option.id}
                  role="menuitemradio"
                  aria-checked={value === option.id}
                  className={value === option.id ? 'theme-nav-item-active' : ''}
                  onClick={() => {
                    close();
                    onChange(option.id);
                  }}
                >
                  <span className="min-w-0 flex-1 break-words">{option.name}</span>
                  {value === option.id && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </MenuItem>
              ))}
            </Menu>
          </div>,
          document.body,
        )}
    </>
  );
}
