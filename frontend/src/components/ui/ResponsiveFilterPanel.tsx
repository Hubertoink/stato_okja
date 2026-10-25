import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import Modal from '@/components/Modal';
import { CloseButton } from './Button';
import { useTranslation } from 'react-i18next';
import { useAnchoredPopoverPosition } from './useAnchoredPopoverPosition';

/** A header-anchored filter popover on desktop and a full-width top sheet on phones. */
export function ResponsiveFilterPanel({
  children,
  anchorRef,
  desktopClassName = '',
  mobileBreakpoint = 768,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  anchorRef?: RefObject<HTMLElement | null>;
  desktopClassName?: string;
  mobileBreakpoint?: number;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const isMobile = useIsMobile(mobileBreakpoint, { touchIsMobile: false });
  const { t } = useTranslation('common');
  const panelRef = useRef<HTMLElement | null>(null);
  // The mobile Modal owns its lock; desktop keeps the existing anchored dropdown.
  useBodyScrollLock(open && !isMobile);
  const anchorStyle = useAnchoredPopoverPosition(open && !isMobile, panelRef, anchorRef);

  useEffect(() => {
    if (!open || isMobile) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        !panelRef.current?.contains(event.target as Node)
        && !(anchorRef?.current ?? panelRef.current?.parentElement)?.contains(event.target as Node)
      ) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      const anchor = anchorRef?.current ?? panelRef.current?.parentElement;
      anchor?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [anchorRef, isMobile, onClose, open]);

  if (!open) return null;
  if (isMobile) {
    return (
      <Modal onClose={onClose} open title={title} maxWidth="6xl">
        {children}
      </Modal>
    );
  }

  return (
    <section
      ref={panelRef}
      aria-label={title}
      className={`header-action-popover header-filter-popover ${desktopClassName}`.trim()}
      role="dialog"
      style={anchorStyle}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
        <CloseButton aria-label={t('actions.close')} onClick={onClose} size="icon-compact" />
      </header>
      {children}
    </section>
  );
}
