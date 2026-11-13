import { describe, expect, it } from 'vitest';
import { PALETTE_IDS } from '@/lib/types';
import { contrast, oklch, tokens, type Tokens } from './palettes';

// Text on its background, in every palette and both modes. 4.5:1 is WCAG AA
// for body text; outlines and large marks need 3:1.
const TEXT_PAIRS: [keyof Tokens, keyof Tokens][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onSurface', 'surface'],
  ['onSurface', 'surfaceContainerHigh'],
  ['onSurfaceVariant', 'surface'],
  ['onSurfaceVariant', 'surfaceContainerHigh'],
  ['primary', 'surface'],
  ['primary', 'surfaceContainerHigh'],
  ['tertiary', 'surface'],
  ['error', 'surface'],
  ['onErrorContainer', 'errorContainer'],
  ['caution', 'surface'],
  ['onCautionContainer', 'cautionContainer'],
];

describe('palettes', () => {
  it('converts OKLCH to sRGB', () => {
    expect(oklch(1, 0, 0)).toBe('#ffffff');
    expect(oklch(0, 0, 0)).toBe('#000000');
    // The reference value for sRGB red in OKLCH.
    expect(oklch(0.62796, 0.25768, 29.234)).toBe('#ff0000');
  });

  for (const id of PALETTE_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${id} ${mode}: text is readable on its background`, () => {
        const t = tokens(id, mode);
        for (const [fg, bg] of TEXT_PAIRS) {
          expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(t.outline, t.surface), 'outline on surface').toBeGreaterThanOrEqual(3);
      });
    }
  }
});
