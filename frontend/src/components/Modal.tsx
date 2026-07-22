import { X as XIcon } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export default function Modal({
  open,
  title,
  children,
  onClose,
  maxWidth = 'md',
  blur = true,
  showCloseButton = true,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  blur?: boolean;
  showCloseButton?: boolean;
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
  const content = (
    <div
      className={`fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay ${blur ? 'backdrop-blur-sm' : ''}`}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        aria-label={title || 'Dialog'}
        aria-modal="true"
        className={`w-full ${maxW} max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 text-[var(--text-primary)] shadow-2xl bottom-sheet-animate modal-panel-roomy md:rounded-2xl md:p-6 ${blur ? 'backdrop-blur-xl' : ''}`}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-4">
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
        {children}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
