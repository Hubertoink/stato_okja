import { X as XIcon } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

/**
 * A visual modal backdrop that deliberately does not handle clicks.
 * Dialogs are closed through their explicit controls so unsaved work cannot
 * disappear from an incidental click outside the panel.
 */
export function ModalBackdrop({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`absolute inset-0 ${className}`} />;
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
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  blur?: boolean;
  showCloseButton?: boolean;
  /** Information modals keep their title and close control visible while their content scrolls. */
  variant?: 'default' | 'information';
}) {
  // Lock background scroll when modal is open
  useBodyScrollLock(open);
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
  const isInformationModal = variant === 'information';
  const content = (
    <div
      className={`fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay ${blur ? 'backdrop-blur-sm' : ''}`}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        aria-label={title || 'Dialog'}
        aria-modal="true"
        className={`w-full ${maxW} max-h-[85vh] rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl bottom-sheet-animate modal-panel-roomy md:rounded-2xl ${isInformationModal ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 md:p-6'} ${blur ? 'backdrop-blur-xl' : ''}`}
        role="dialog"
        tabIndex={-1}
      >
        <div
          className={isInformationModal
            ? 'flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 md:p-6'
            : 'mb-4 flex items-center justify-between'}
        >
          <h3 className="text-lg font-bold gradient-text">{title}</h3>
          {showCloseButton && (
            <button
              className="inline-flex items-center justify-center rounded-xl bg-[var(--surface-2)] p-2 text-[var(--text-secondary)] transition-all duration-200 hover:scale-105 hover:bg-[var(--surface-3)]"
              onClick={onClose}
              aria-label="Schließen"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        {isInformationModal ? (
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
