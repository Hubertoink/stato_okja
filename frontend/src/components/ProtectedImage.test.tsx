import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useResolvedImageSrc } from './ProtectedImage';

const state = vi.hoisted(() => ({ generation: 0, scope: 'org-1', get: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: state.get }, getAuthSessionGeneration: () => state.generation }));
vi.mock('@/lib/orgScope', () => ({ useOrgScopeKey: () => state.scope }));
afterEach(() => vi.unstubAllGlobals());

it('does not reuse protected images across organization or session changes', async () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second'), revokeObjectURL: vi.fn() });
  state.get.mockResolvedValue({ data: new Blob(['image']) });
  const { result, rerender, unmount } = renderHook(() => useResolvedImageSrc('/uploads/images/private.jpg'));
  await waitFor(() => expect(result.current).toBe('blob:first'));
  state.generation += 1;
  rerender();
  expect(result.current).toBeUndefined();
  await waitFor(() => expect(result.current).toBe('blob:second'));
  state.get.mockRejectedValue(new Error('Forbidden'));
  state.scope = 'org-2';
  rerender();
  expect(result.current).toBeUndefined();
  await waitFor(() => expect(state.get).toHaveBeenCalledTimes(3));
  expect(result.current).toBeUndefined();
  unmount();
});