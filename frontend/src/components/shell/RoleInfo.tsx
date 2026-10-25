import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, CloseButton } from '@/components/ui/Button';
import { useAnchoredPopoverPosition } from '@/components/ui/useAnchoredPopoverPosition';
import type { Role } from '@/lib/auth';
import './role-info.css';

export default function RoleInfo({
  role,
  dismiss,
  onOpen,
}: {
  role: Role;
  dismiss: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const position = useAnchoredPopoverPosition(open, panel, anchor);
  const label = t(`roles.${role}`);
  const close = () => {
    setOpen(false);
    anchor.current?.querySelector('button')?.focus();
  };
  useEffect(() => {
    if (dismiss) setOpen(false);
  }, [dismiss]);
  useEffect(() => {
    setOpen(false);
  }, [role]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div ref={anchor} className="sidebar-role">
      <Button
        variant="ghost"
        className="sidebar-role-trigger"
        aria-label={t('roleInfo.label', { role: label })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
      >
        <span>{role === 'org_admin' ? t('roleInfo.shortOrgAdmin') : label}</span>
      </Button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            tabIndex={-1}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
            className="sidebar-role-panel theme-menu-panel"
            style={position}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget as Node | null) &&
                !anchor.current?.contains(event.relatedTarget as Node | null)
              )
                setOpen(false);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <strong id={`${id}-title`}>{label}</strong>
              <CloseButton aria-label={t('roleInfo.close')} onClick={close} size="icon-compact" />
            </div>
            <p id={`${id}-description`} className="mt-2 text-sm">
              {t(`roleInfo.${role}`)}
            </p>
            {role !== 'superadmin' && (
              <p className="mt-3 text-xs text-[var(--text-secondary)]">{t('roleInfo.scope')}</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
