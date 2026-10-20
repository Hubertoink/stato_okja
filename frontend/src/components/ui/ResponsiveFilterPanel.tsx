import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import Modal from '@/components/Modal';
import { CloseButton } from './Button';
import { useTranslation } from 'react-i18next';
import { PAGE_ACTIONS_POSITION_EVENT } from './FloatingPageActions';

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
  const isMobile = useIsMobile(mobileBreakpoint);
  const { t } = useTranslation('common');
  const panelRef = useRef<HTMLElement | null>(null);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    if (!open || isMobile) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        !panelRef.current?.contains(event.target as Node)
        && !anchorRef?.current?.contains(event.target as Node)
      ) onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [anchorRef, isMobile, onClose, open]);

  useEffect(() => {
    if (!open || isMobile || !anchorRef?.current) {
      setAnchorStyle(undefined);
      return;
    }
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dock = anchorRef.current?.closest('.page-actions-dock');
      const dockTop = dock?.getBoundingClientRect().top;
      const viewportWidth = document.documentElement.clientWidth;
      const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 0;
      const right = Math.max(16, Math.min(viewportWidth - rect.right, viewportWidth - panelWidth - 16));
      const headerBottom = document.querySelector('.header-navigation-shell')?.getBoundingClientRect().bottom ?? 0;
      setAnchorStyle({
        position: 'fixed',
        top: dock ? 'auto' : `${Math.min(rect.bottom + 8, window.innerHeight - 48)}px`,
        bottom: dockTop !== undefined ? `${window.innerHeight - dockTop + 8}px` : 'auto',
        maxHeight: dockTop !== undefined ? `${Math.max(120, dockTop - headerBottom - 24)}px` : undefined,
        right: `${right}px`,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener(PAGE_ACTIONS_POSITION_EVENT, updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener(PAGE_ACTIONS_POSITION_EVENT, updatePosition);
    };
  }, [anchorRef, isMobile, open]);

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
