import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '@/components/ConfirmModal';

type DiscardAction = (() => void) | null;
type UnsavedChangesGuardOptions<T> = {
  enabled?: boolean;
  getSnapshot?: (value: T) => string;
};

const defaultSnapshot = (value: unknown) => JSON.stringify(value);

/**
 * Protects an editor from accidentally closing with local changes.  It deliberately
 * keeps the browser warning separate from the in-app confirmation: browsers only
 * permit their own, non-customised text for beforeunload warnings.
 */
export function useUnsavedChangesGuard<T>(
  value: T,
  { enabled = true, getSnapshot = defaultSnapshot as (value: T) => string }: UnsavedChangesGuardOptions<T> = {},
) {
  const { t } = useTranslation('common');
  const snapshot = useMemo(() => getSnapshot(value), [getSnapshot, value]);
  const baselineRef = useRef<string | null>(null);
  const [discardAction, setDiscardAction] = useState<DiscardAction>(null);
  const [, setRevision] = useState(0);

  if (baselineRef.current === null) baselineRef.current = snapshot;

  const isDirty = enabled && baselineRef.current !== snapshot;

  const reset = useCallback((nextValue: T) => {
    baselineRef.current = getSnapshot(nextValue);
    setDiscardAction(null);
    // The baseline lives in a ref so it survives renders; force one render so
    // the unload listener is removed immediately after a successful save/reset.
    setRevision((revision) => revision + 1);
  }, [getSnapshot]);

  const requestDiscard = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      setDiscardAction(() => action);
    },
    [isDirty],
  );

  const cancelDiscard = useCallback(() => setDiscardAction(null), []);
  const confirmDiscard = useCallback(() => {
    const action = discardAction;
    setDiscardAction(null);
    action?.();
  }, [discardAction]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const discardDialog = (
    <ConfirmModal
      open={Boolean(discardAction)}
      title={t('unsavedChanges.title')}
      message={t('unsavedChanges.message')}
      confirmLabel={t('unsavedChanges.discard')}
      cancelLabel={t('unsavedChanges.keepEditing')}
      onConfirm={confirmDiscard}
      onCancel={cancelDiscard}
    />
  );

  return { discardDialog, isDirty, requestDiscard, reset };
}
