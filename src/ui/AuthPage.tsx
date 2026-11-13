'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FormEvent, ReactNode } from 'react';
import { Logo } from './Logo';

/** The frame every signed-out screen shares: logo, title, one form. */
export function AuthPage({ title, intro, onSubmit, children, footer }: { title: string; intro?: ReactNode; onSubmit?: () => void; children: ReactNode; footer?: ReactNode }) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };
  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', px: 2, py: 4, pt: 'calc(32px + env(safe-area-inset-top))' }}>
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 420 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Logo size={80} />
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {intro && <Typography color="text.secondary">{intro}</Typography>}
        </Stack>
        <Stack component={onSubmit ? 'form' : 'div'} onSubmit={onSubmit ? submit : undefined} noValidate spacing={2}>
          {children}
        </Stack>
        {footer && (
          <Stack spacing={1} sx={{ alignItems: 'center' }}>
            {footer}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
