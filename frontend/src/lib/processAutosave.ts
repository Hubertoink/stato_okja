export type ProcessAutosaveDecision = {
  canEdit: boolean;
  selectedProcessId: string | null;
  hydratedProcessId: string | null;
  title: string;
  currentSnapshot: string;
  savedSnapshot?: string;
  queuedSnapshot?: string;
  skipAfterHydrationProcessId?: string | null;
};

export function shouldQueueProcessAutosave({
  canEdit,
  selectedProcessId,
  hydratedProcessId,
  title,
  currentSnapshot,
  savedSnapshot,
  queuedSnapshot,
  skipAfterHydrationProcessId,
}: ProcessAutosaveDecision) {
  if (!canEdit || !selectedProcessId || hydratedProcessId !== selectedProcessId || !title.trim()) return false;
  if (skipAfterHydrationProcessId === selectedProcessId) return false;
  if (savedSnapshot === currentSnapshot || queuedSnapshot === currentSnapshot) return false;
  return true;
}
