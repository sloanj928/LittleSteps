'use client';

import CssBaseline from '@mui/material/CssBaseline';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PALETTE_COOKIE, type PaletteId } from '@/lib/types';
import { ApiFailure } from './api';
import { meQuery } from './queries';
import { buildTheme, lsOf } from './theme/muiTheme';

// --- Toasts ------------------------------------------------------------------

interface Toast {
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<((toast: Toast | string) => void) | null>(null);

/** Shows a short message at the bottom of the screen, optionally with one action ("Undo"). */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <Providers>');
  return show;
}

function Toasts({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number }) | null>(null);
  const show = useCallback((t: Toast | string) => setToast({ ...(typeof t === 'string' ? { message: t } : t), key: Date.now() }), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        // Long enough to read and reach "Undo" with a baby on one arm.
        autoHideDuration={toast?.action ? 8000 : 5000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setToast(null);
        }}
        message={toast?.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // Above the bottom bar and the floating add button (80 + 16 + 64), so a
        // toast never covers the button someone reaches for next.
        sx={{ bottom: { xs: 'calc(172px + env(safe-area-inset-bottom))' } }}
        action={
          toast?.action && (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </Button>
          )
        }
      />
    </ToastContext.Provider>
  );
}

// --- Theme -------------------------------------------------------------------

function rememberPalette(id: PaletteId) {
  document.cookie = `${PALETTE_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function Themed({ initialPalette, children }: { initialPalette: PaletteId; children: ReactNode }) {
  // Reads the cached profile without fetching it: signed-out pages have none
  // and use the cookie's palette; the app shell is what loads it.
  const { data: me } = useQuery({ ...meQuery, enabled: false });
  const palette = me?.user.palette ?? initialPalette;
  const theme = useMemo(() => buildTheme(palette), [palette]);
  useEffect(() => {
    if (me) rememberPalette(me.user.palette);
  }, [me]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/** The design tokens as CSS variables, for drawing code. */
export function useTokens() {
  return lsOf(useTheme());
}

export function Providers({ palette, children }: { palette: PaletteId; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Retry only what a retry can fix: a dropped connection.
            retry: (count, error) => error instanceof ApiFailure && error.status === 0 && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Themed initialPalette={palette}>
        <Toasts>{children}</Toasts>
      </Themed>
    </QueryClientProvider>
  );
}
