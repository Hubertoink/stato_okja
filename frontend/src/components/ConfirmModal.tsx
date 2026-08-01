import { X as XIcon } from 'lucide-react';
import React from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

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
}) {
  const { t } = useTranslation('common');
  // Lock background scroll while this modal is open
  useBodyScrollLock(open);
  if (!open) return null;
  const content = (
    <div
      className="fixed inset-0 z-[70] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg p-4 md:p-6 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-viridian">{title || t('dialog.title')}</h3>
          <button
            className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700"
            onClick={onCancel}
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
              onClick={onCancel}
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
            className={`w-full shrink-0 whitespace-nowrap rounded px-4 py-2 text-center sm:w-auto ${
              primaryAction === 'secondary'
                ? 'border border-[var(--status-danger-text)] bg-transparent text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]'
                : 'bg-viridian text-white'
            }`}
            onClick={onConfirm}
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
