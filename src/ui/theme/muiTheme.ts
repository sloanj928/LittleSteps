import { createTheme, type Theme } from '@mui/material/styles';
import type { PaletteId } from '@/lib/types';
import { artTokens, tokens, type Art, type Tokens } from './palettes';

declare module '@mui/material/styles' {
  interface Palette {
    ls: Tokens;
    art: Art;
  }
  interface PaletteOptions {
    ls?: Tokens;
    art?: Art;
  }
}

function scheme(id: PaletteId, mode: 'light' | 'dark') {
  const t = tokens(id, mode);
  return {
    palette: {
      primary: { main: t.primary, contrastText: t.onPrimary },
      secondary: { main: t.tertiary, contrastText: mode === 'light' ? '#ffffff' : t.surface },
      error: { main: t.error, contrastText: mode === 'light' ? '#ffffff' : t.surface },
      background: { default: t.surface, paper: t.surfaceContainerLow },
      text: { primary: t.onSurface, secondary: t.onSurfaceVariant },
      divider: t.outlineVariant,
      ls: t,
      art: artTokens(mode),
    },
  };
}

/** The tokens as CSS variables, so they switch with the system's light/dark setting without a re-render. */
export function lsOf(theme: Theme): { ls: Tokens; art: Art } {
  const p = (theme.vars ?? theme).palette as unknown as { ls: Tokens; art: Art };
  return { ls: p.ls, art: p.art };
}

// Smallest comfortable touch target (Material: 48dp).
export const TOUCH = 48;

/**
 * Material 3 on MUI: tonal surfaces instead of shadows, pill buttons, large
 * corner radii. Light and dark both ship as CSS variables and follow the
 * system setting through a media query, so there is no flash on load and
 * nothing to store.
 */
export function buildTheme(id: PaletteId): Theme {
  return createTheme({
    cssVariables: true,
    colorSchemes: { light: scheme(id, 'light'), dark: scheme(id, 'dark') },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: 'var(--font-nunito), system-ui, -apple-system, "Segoe UI", sans-serif',
      // Nothing a parent has to read is under 16px. `caption` (14px) is for
      // chart axes and navigation labels only.
      h4: { fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.2 },
      h5: { fontSize: '1.375rem', fontWeight: 800, lineHeight: 1.25 },
      h6: { fontSize: '1.125rem', fontWeight: 800, lineHeight: 1.3 },
      subtitle1: { fontSize: '1rem', fontWeight: 700 },
      subtitle2: { fontSize: '1rem', fontWeight: 700 },
      body1: { fontSize: '1rem', lineHeight: 1.5 },
      body2: { fontSize: '1rem', lineHeight: 1.5 },
      caption: { fontSize: '0.875rem', lineHeight: 1.4 },
      button: { fontSize: '1rem', fontWeight: 700, textTransform: 'none' },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 999, minHeight: TOUCH, paddingInline: 24 } },
      },
      MuiIconButton: { styleOverrides: { root: { padding: 12 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: ({ theme }) => ({ borderRadius: 24, backgroundColor: lsOf(theme).ls.surfaceContainerLow }) },
      },
      MuiTextField: { defaultProps: { fullWidth: true } },
      MuiFab: {
        styleOverrides: {
          root: ({ theme }) => {
            const { ls } = lsOf(theme);
            return { borderRadius: 16, boxShadow: 'none', backgroundColor: ls.primaryContainer, color: ls.onPrimaryContainer, '&:hover': { backgroundColor: ls.primaryContainer } };
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            height: 36,
            fontSize: '1rem',
            position: 'relative',
            // The chip looks 36px tall; this stretches where it can be tapped to 48.
            '&.MuiChip-clickable::after': { content: '""', position: 'absolute', inset: '-6px 0' },
          },
        },
      },
      MuiListItemButton: { styleOverrides: { root: { minHeight: 56 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
      MuiTab: { styleOverrides: { root: { minHeight: TOUCH, fontSize: '1rem' } } },
      MuiToggleButton: { styleOverrides: { root: { minHeight: TOUCH, textTransform: 'none', fontSize: '1rem' } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 16, fontSize: '1rem' } } },
      MuiFormHelperText: { styleOverrides: { root: { fontSize: '0.875rem' } } },
    },
  });
}
