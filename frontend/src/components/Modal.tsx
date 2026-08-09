import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { useTranslation } from 'react-i18next';
import { EditorHeader } from '@/components/ui/EditorFrame';
import { CloseButton } from '@/components/ui/Button';

/** Visual backdrop for custom dialogs that do not use the shared Modal shell. */
export function ModalBackdrop({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  return <div aria-hidden="true" className={`absolute inset-0 ${className}`} onClick={onClick} />;
}

type ModalHistoryState = { __statoModalStack?: string[] };
type ModalHistoryControls = {
  dismiss: () => void;
  /** Removes the modal-only browser-history entry without invoking onClose. */
  dismissWithoutCallback: (afterDismiss: () => void) => boolean;
};

/**
 * Keeps modal navigation inside the current page. On mobile, a browser-back
 * gesture first dismisses the topmost dialog. Callers keep their existing
 * onClose guards, so unsaved-change confirmation continues to decide whether
 * the dialog may actually close.
 */
export function useModalHistory(onClose: () => void, open = true): ModalHistoryControls {
  const modalId = useId();
  const onCloseRef = useRef(onClose);
  const dismissingRef = useRef(false);
  const suppressCloseRef = useRef(false);
  const silentDismissActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const getStack = (state: ModalHistoryState | null | undefined) => state?.__statoModalStack || [];
    const currentStack = getStack(window.history.state as ModalHistoryState);
    window.history.pushState(
      { ...(window.history.state || {}), __statoModalStack: [...currentStack, modalId] },
      '',
      window.location.href,
    );

    const handlePopState = (event: PopStateEvent) => {
      const nextStack = getStack(event.state as ModalHistoryState);
      if (nextStack.includes(modalId)) return;

      if (suppressCloseRef.current) {
        suppressCloseRef.current = false;
        const afterDismiss = silentDismissActionRef.current;
        silentDismissActionRef.current = null;
        afterDismiss?.();
        return;
      }

      // Restore the modal history entry before delegating to onClose. This is
      // important when an unsaved-changes guard declines the close request.
      window.history.pushState(
        { ...(event.state || {}), __statoModalStack: [...nextStack, modalId] },
        '',
        window.location.href,
      );
      dismissingRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Let a replacement modal register itself first. Selecting a project,
      // for example, swaps the picker for the activity editor in one React
      // update. Removing the old history entry synchronously would otherwise
      // deliver its pending popstate to the newly opened editor and close it.
      window.setTimeout(() => {
        const state = window.history.state as ModalHistoryState;
        const stack = getStack(state);
        const index = stack.lastIndexOf(modalId);
        if (index < 0) return;
        if (index === stack.length - 1) {
          window.history.back();
          return;
        }
        window.history.replaceState(
          { ...(state || {}), __statoModalStack: stack.filter((id) => id !== modalId) },
          '',
          window.location.href,
        );
      }, 0);
    };
  }, [modalId, open]);

  const dismiss = useCallback(() => {
    const stack = ((window.history.state as ModalHistoryState | null)?.__statoModalStack || []);
    if (!dismissingRef.current && stack.at(-1) === modalId) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [modalId]);

  const dismissWithoutCallback = useCallback((afterDismiss: () => void) => {
    const stack = ((window.history.state as ModalHistoryState | null)?.__statoModalStack || []);
    if (stack.at(-1) !== modalId) return false;
    suppressCloseRef.current = true;
    silentDismissActionRef.current = afterDismiss;
    window.history.back();
    return true;
  }, [modalId]);

  return { dismiss, dismissWithoutCallback };
}

export default function Modal({
  open,
  title,
  children,
  onClose,
  maxWidth = 'md',
  blur = true,
  showCloseButton = true,
  variant = 'default',
  headerActions,
  mobilePlacement = 'bottom',
  theme = 'app',
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  blur?: boolean;
  showCloseButton?: boolean;
  /** Information and form modals keep their title and controls visible while their content scrolls. */
  variant?: 'default' | 'information' | 'form';
  headerActions?: React.ReactNode;
  /** Filter panels use a top sheet on phones; regular dialogs stay bottom-aligned. */
  mobilePlacement?: 'bottom' | 'top';
  /** Public pages deliberately keep their own presentation independent of a stored app theme. */
  theme?: 'app' | 'public';
}) {
  const { t } = useTranslation('common');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const { dismiss } = useModalHistory(onClose, open);
  // Lock background scroll when modal is open
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [open]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  const maxW = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-md',
    lg: 'md:max-w-lg',
    xl: 'md:max-w-xl',
    '2xl': 'md:max-w-2xl',
    '3xl': 'md:max-w-3xl',
    '4xl': 'md:max-w-4xl',
    '5xl': 'md:max-w-5xl',
    '6xl': 'md:max-w-6xl',
  }[maxWidth];
  const isStructuredModal = variant === 'information' || variant === 'form';
  const themeClassName = theme === 'public' ? 'public-survey public-survey-modal' : '';
  const content = (
    <div
      className={`visual-viewport-fixed z-[70] bg-black/40 flex ${mobilePlacement === 'top' ? 'items-start' : 'items-end'} md:items-center justify-center p-0 md:p-6 modal-overlay ${themeClassName} ${blur ? "backdrop-blur-sm" : ''}`}
      onWheel={(e) => e.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        aria-label={title ? undefined : t('dialog.ariaLabel')}
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className={`w-full ${maxW} max-h-[85vh] ${mobilePlacement === 'top' ? 'rounded-b-3xl top-sheet-animate' : 'rounded-t-3xl bottom-sheet-animate'} border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl modal-panel-roomy ${themeClassName} ${variant === 'form' ? 'modal-editor-surface' : ''} md:rounded-2xl ${isStructuredModal ? "flex flex-col overflow-hidden" : "overflow-y-auto p-4 md:p-6"} ${blur ? "backdrop-blur-xl" : ''}`}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        {isStructuredModal ? (
          <EditorHeader
            title={title}
            titleId={titleId}
            actions={headerActions}
            onClose={dismiss}
            closeLabel={t('actions.close')}
            showCloseButton={showCloseButton}
          />
        ) : (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold gradient-text">{title}</h3>
            {showCloseButton && (
            <CloseButton
              onClick={dismiss}
              aria-label={t('actions.close')}
            />
            )}
          </div>
        )}
        {variant === 'information' ? (
          <div className="min-h-0 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
            {children}
          </div>
        ) : children}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
