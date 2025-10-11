import { X as XIcon } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
  showCancel = true,
  secondaryLabel,
  onSecondaryConfirm,
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
}) {
  if (!open) return null;
  const content = (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-lg p-4 md:p-6 max-h-[80vh] overflow-y-auto bottom-sheet-animate">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-viridian">{title || 'Hinweis'}</h3>
          <button className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onCancel} aria-label="Schließen">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="text-gray-700 text-sm">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 py-2 pb-safe -mx-4 md:-mx-6 px-4 md:px-6">
          {showCancel && (
            <button type="button" className="px-3 py-1.5 rounded bg-gray-200 text-gray-700" onClick={onCancel}>{cancelLabel}</button>
          )}
          {secondaryLabel && onSecondaryConfirm && (
            <button type="button" className="px-3 py-1.5 rounded bg-white border border-gray-300 text-gray-800 hover:bg-gray-50" onClick={onSecondaryConfirm}>{secondaryLabel}</button>
          )}
          <button type="button" className="px-3 py-1.5 rounded bg-viridian text-white" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
  // Render in a portal to avoid clipping inside parents with transforms/overflow (e.g., modals)
  if (typeof document !== 'undefined') return createPortal(content, document.body);
  return content;
}
