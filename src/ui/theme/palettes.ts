// The five colour palettes, as Material 3 tonal roles in light and dark.
//
// Every role is derived from one hue in OKLCH, where equal lightness looks
// equally light whatever the hue. That is what lets all five palettes share
// one set of lightness steps and all pass the same contrast test
// (palettes.test.ts) without hand-tuning fifty hex codes.

import type { PaletteId } from '@/lib/types';

export function oklch(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
  const hex = lin.map((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${hex.join('')}`;
}

export interface Tokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  /** The accent: a second baby's line, highlights. */
  tertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  /** Form errors. A warm clay, not an alarm red: this is a calm app. */
  error: string;
  errorContainer: string;
  onErrorContainer: string;
  /** Allergy flags: amber, always with an icon and the words beside it. */
  caution: string;
  cautionContainer: string;
  onCautionContainer: string;
}

interface Seed {
  name: string;
  hue: number;
  chroma: number;
}

export const PALETTES: Record<PaletteId, Seed> = {
  sage: { name: 'Sage', hue: 165, chroma: 0.075 },
  blush: { name: 'Blush', hue: 12, chroma: 0.095 },
  sky: { name: 'Sky', hue: 245, chroma: 0.09 },
  sand: { name: 'Sand', hue: 72, chroma: 0.075 },
  lavender: { name: 'Lavender', hue: 300, chroma: 0.09 },
};

const CLAY = 35;
const AMBER = 80;

export function tokens(id: PaletteId, mode: 'light' | 'dark'): Tokens {
  const { hue, chroma } = PALETTES[id];
  // The accent sits a third of the wheel away, so it is distinct from the
  // primary in every palette.
  const accent = (hue + 120) % 360;
  if (mode === 'light') {
    return {
      primary: oklch(0.47, chroma, hue),
      onPrimary: '#ffffff',
      primaryContainer: oklch(0.92, chroma * 0.6, hue),
      onPrimaryContainer: oklch(0.27, chroma * 0.8, hue),
      secondaryContainer: oklch(0.9, chroma * 0.45, hue),
      onSecondaryContainer: oklch(0.27, chroma * 0.6, hue),
      tertiary: oklch(0.5, 0.09, accent),
      tertiaryContainer: oklch(0.92, 0.05, accent),
      onTertiaryContainer: oklch(0.28, 0.07, accent),
      // The logo's cream, for every palette: paper, not a tint.
      surface: '#fffdf8',
      surfaceContainerLow: oklch(0.972, chroma * 0.14, hue),
      surfaceContainer: oklch(0.952, chroma * 0.18, hue),
      surfaceContainerHigh: oklch(0.93, chroma * 0.22, hue),
      onSurface: oklch(0.23, 0.015, hue),
      onSurfaceVariant: oklch(0.42, 0.02, hue),
      outline: oklch(0.56, 0.02, hue),
      outlineVariant: oklch(0.86, 0.02, hue),
      error: oklch(0.47, 0.13, CLAY),
      errorContainer: oklch(0.93, 0.04, CLAY),
      onErrorContainer: oklch(0.3, 0.09, CLAY),
      caution: oklch(0.5, 0.1, AMBER),
      cautionContainer: oklch(0.93, 0.07, AMBER),
      onCautionContainer: oklch(0.3, 0.06, AMBER),
    };
  }
  return {
    primary: oklch(0.82, chroma * 0.85, hue),
    onPrimary: oklch(0.25, chroma * 0.7, hue),
    primaryContainer: oklch(0.36, chroma * 0.7, hue),
    onPrimaryContainer: oklch(0.92, chroma * 0.6, hue),
    secondaryContainer: oklch(0.33, chroma * 0.4, hue),
    onSecondaryContainer: oklch(0.92, chroma * 0.4, hue),
    tertiary: oklch(0.82, 0.08, accent),
    tertiaryContainer: oklch(0.36, 0.06, accent),
    onTertiaryContainer: oklch(0.92, 0.05, accent),
    surface: oklch(0.17, 0.008, hue),
    surfaceContainerLow: oklch(0.205, 0.01, hue),
    surfaceContainer: oklch(0.235, 0.012, hue),
    surfaceContainerHigh: oklch(0.27, 0.014, hue),
    onSurface: oklch(0.93, 0.01, hue),
    onSurfaceVariant: oklch(0.8, 0.02, hue),
    outline: oklch(0.62, 0.02, hue),
    outlineVariant: oklch(0.36, 0.02, hue),
    error: oklch(0.82, 0.09, CLAY),
    errorContainer: oklch(0.36, 0.08, CLAY),
    onErrorContainer: oklch(0.92, 0.04, CLAY),
    caution: oklch(0.84, 0.1, AMBER),
    cautionContainer: oklch(0.36, 0.06, AMBER),
    onCautionContainer: oklch(0.93, 0.06, AMBER),
  };
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// --- Artwork -----------------------------------------------------------------

/**
 * Colours of drawn things in the illustrated themes: wood is wood and
 * pencil is pencil under every palette, so these do not follow the hue.
 * They do follow light and dark, so a drawing never glares on a dark screen.
 */
export interface Art {
  wood: string;
  woodDark: string;
  woodLight: string;
  wall: string;
  pencil: string;
  glass: string;
  lid: string;
  fruit: string;
  vegetable: string;
  grain: string;
  protein: string;
  dairy: string;
  other: string;
  /** Text drawn on a jar fill, a block or a ribbon. */
  ink: string;
  /** The tree trunk's outer edge, darker than any ring. */
  bark: string;
  /** The nursery scale: its painted body, its dial face and its needle. */
  enamel: string;
  face: string;
  needle: string;
}

export function artTokens(mode: 'light' | 'dark'): Art {
  if (mode === 'light') {
    return {
      wood: '#d9b88f',
      woodDark: '#a9825a',
      woodLight: '#ecd5b3',
      wall: '#f6efe2',
      pencil: '#4a4038',
      glass: '#8fa3a8',
      lid: '#b9a58c',
      fruit: '#f0a3a0',
      vegetable: '#a8cf9c',
      grain: '#ecd08a',
      protein: '#d9a986',
      dairy: '#b9d6ee',
      other: '#cdc3dd',
      ink: '#33291f',
      bark: '#7a5a3c',
      enamel: '#c9dceb',
      face: '#fffaf0',
      needle: '#c4524a',
    };
  }
  return {
    wood: '#7a5f43',
    woodDark: '#54402c',
    woodLight: '#927557',
    wall: '#2b2925',
    pencil: '#e6dccd',
    glass: '#8a9a9e',
    lid: '#6d5f4e',
    fruit: '#b96f6c',
    vegetable: '#6f9a64',
    grain: '#b09550',
    protein: '#a07552',
    dairy: '#6f93b3',
    other: '#8c80a3',
    ink: '#fbf5ea',
    bark: '#3b2c1e',
    enamel: '#4d6273',
    face: '#35322d',
    needle: '#e07a70',
  };
}
