import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecentProjectChoices } from './useRecentProjectChoices';

const context = vi.hoisted(() => ({ userId: 'alice', scope: 'babu' }));
vi.mock('./auth', () => ({ useAuth: () => ({ user: { id: context.userId } }) }));
vi.mock('./orgScope', () => ({ useOrgScopeKey: () => context.scope }));

describe('recent project choices', () => {
  beforeEach(() => {
    localStorage.clear();
    context.userId = 'alice';
    context.scope = 'babu';
  });

  it('restores choices only for the same user and organization', () => {
    const first = renderHook(useRecentProjectChoices);
    first.result.current.remember('open-door');
    first.unmount();
    expect(renderHook(useRecentProjectChoices).result.current.recentIds).toEqual(['open-door']);
    context.scope = 'another-organization';
    expect(renderHook(useRecentProjectChoices).result.current.recentIds).toEqual([]);
    context.scope = 'babu';
    context.userId = 'bob';
    expect(renderHook(useRecentProjectChoices).result.current.recentIds).toEqual([]);
  });

  it('still lets users choose when storage is unavailable', () => {
    const { result } = renderHook(useRecentProjectChoices);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    expect(() => result.current.remember('open-door')).not.toThrow();
    spy.mockRestore();
  });
});
