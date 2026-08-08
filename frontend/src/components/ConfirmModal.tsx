import { X as XIcon } from 'lucide-react';
import React from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useModalHistory } from '@/components/Modal';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  onConfirm,
  onCancel,
  showCancel = true,
  secondaryLabel,
  onSecondaryConfirm,
  primaryAction = 'confirm',
  confirmDisabled = false,
}: {
  open: boolean;
  title?: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showCancel?: boolean;
  secondaryLabel?: string;
  onSecondaryConfirm?: () => void;
  primaryAction?: 'confirm' | 'secondary';
  confirmDisabled?: boolean;
}) {
  const { t } = useTranslation('common');
  const { dismiss, dismissWithoutCallback } = useModalHistory(onCancel, open);
  // Lock background scroll while this modal is open
  useBodyScrollLock(open);
  const handleConfirm = () => {
    if (dismissWithoutCallback(onConfirm)) {
      // The callback runs from the popstate handler, after the modal-only
      // entry has been removed and before the editor consumes its route entry.
      return;
    }
    onConfirm();
  };
  if (!open) return null;
  const content = (
    <div
      className="fixed inset-0 z-[70] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg p-4 md:p-6 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-viridian">{title || t('dialog.title')}</h3>
          <button
            className="modal-close-button inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={dismiss}
            aria-label={t('actions.close')}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="text-gray-700 text-sm">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {showCancel && (
            <button
              type="button"
              className="w-full shrink-0 whitespace-nowrap rounded bg-gray-200 px-4 py-2 text-center text-gray-700 sm:w-auto"
              onClick={dismiss}
            >
              {cancelLabel || t('actions.cancel')}
            </button>
          )}
          {secondaryLabel && onSecondaryConfirm && (
            <button
              type="button"
              className={`w-full shrink-0 whitespace-nowrap rounded px-4 py-2 text-center sm:w-auto ${
                primaryAction === 'secondary'
                  ? 'bg-viridian text-white hover:bg-cambridge-blue'
                  : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              }`}
              onClick={onSecondaryConfirm}
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            className={`w-full shrink-0 whitespace-nowrap rounded px-4 py-2 text-center sm:w-auto disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${
              primaryAction === 'secondary'
                ? 'border border-[var(--status-danger-text)] bg-transparent text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]'
                : 'bg-viridian text-white'
            }`}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
  // Render in a portal to avoid clipping inside parents with transforms/overflow (e.g., modals)
  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
