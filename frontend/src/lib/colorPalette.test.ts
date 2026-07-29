import { describe, expect, it } from 'vitest';
import { getBadgeBackgroundColor } from './colorPalette';

describe('getBadgeBackgroundColor', () => {
  it('keeps arbitrary six-digit colors from the color picker', () => {
    expect(getBadgeBackgroundColor('#b079d2')).toBe('#b079d2');
  });

  it('uses the fallback for missing or invalid colors', () => {
    expect(getBadgeBackgroundColor(null)).toBe('#94a3b8');
    expect(getBadgeBackgroundColor('blue', '#64748b')).toBe('#64748b');
  });
});
