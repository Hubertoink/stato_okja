import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBodyScrollLock } from './useBodyScrollLock';

describe('useBodyScrollLock', () => {
  let bodyStyle: string | null;
  let htmlStyle: string | null;
  let scrollRestoration: ScrollRestoration;

  beforeEach(() => {
    bodyStyle = document.body.getAttribute('style');
    htmlStyle = document.documentElement.getAttribute('style');
    scrollRestoration = window.history.scrollRestoration;
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(window.innerWidth - 15);
    document.body.style.paddingRight = '8px';
    window.history.scrollRestoration = 'auto';
  });

  afterEach(() => {
    cleanup();
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (bodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', bodyStyle);
    if (htmlStyle === null) document.documentElement.removeAttribute('style');
    else document.documentElement.setAttribute('style', htmlStyle);
    window.history.scrollRestoration = scrollRestoration;
  });

  it.each(['stable', 'stable both-edges'])('does not compensate an already reserved %s gutter', (gutter) => {
    document.documentElement.style.scrollbarGutter = gutter;
    const { unmount } = renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.paddingRight).toBe('8px');
    expect(document.body.style.position).toBe('fixed');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.paddingRight).toBe('8px');
    expect(document.body.style.position).toBe('');
  });

  it('adds the scrollbar width to existing padding when no gutter is reserved', () => {
    document.documentElement.style.scrollbarGutter = 'auto';
    const { unmount } = renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.paddingRight).toBe('23px');
    unmount();
    expect(document.body.style.paddingRight).toBe('8px');
  });

  it('does not add compensation for overlay scrollbars', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(window.innerWidth);
    renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.paddingRight).toBe('8px');
  });

  it('keeps the page locked until the last nested modal closes and restores its styles', () => {
    document.documentElement.style.scrollbarGutter = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.setProperty('overscroll-behavior-y', 'contain');
    const first = renderHook(() => useBodyScrollLock(true));
    const second = renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.paddingRight).toBe('23px');
    first.unmount();
    expect(document.body.dataset.scrollLocked).toBe('true');
    expect(window.history.scrollRestoration).toBe('manual');

    second.unmount();
    vi.runAllTimers();
    expect(document.body.dataset.scrollLocked).toBeUndefined();
    expect(document.body.style.paddingRight).toBe('8px');
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(document.documentElement.style.getPropertyValue('overscroll-behavior-y')).toBe('contain');
    expect(window.history.scrollRestoration).toBe('auto');
  });
});
