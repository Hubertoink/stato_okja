import { describe, expect, it } from 'vitest';
import { shouldQueueProcessAutosave } from './processAutosave';

describe('process autosave isolation', () => {
  const base = {
    canEdit: true,
    selectedProcessId: 'process-b',
    hydratedProcessId: 'process-b',
    title: 'Prozess A',
    currentSnapshot: 'snapshot-from-process-a',
    savedSnapshot: 'snapshot-from-process-b',
  };

  it('does not save the previous process state into a newly hydrated target process', () => {
    expect(shouldQueueProcessAutosave({
      ...base,
      skipAfterHydrationProcessId: 'process-b',
    })).toBe(false);
  });

  it('queues a real edit only after hydration has completed', () => {
    expect(shouldQueueProcessAutosave({
      ...base,
      title: 'Prozess B geändert',
      currentSnapshot: 'edited-process-b',
      skipAfterHydrationProcessId: null,
    })).toBe(true);
  });

  it('does not queue an identical save twice while switching quickly', () => {
    expect(shouldQueueProcessAutosave({
      ...base,
      title: 'Prozess B geändert',
      currentSnapshot: 'edited-process-b',
      queuedSnapshot: 'edited-process-b',
      skipAfterHydrationProcessId: null,
    })).toBe(false);
  });
});
