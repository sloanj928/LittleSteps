'use client';

import BackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { messageOf } from '../api';
import { FormError, PasswordInput, SubmitButton } from '../fields';
import { useSubmit } from '../useSubmit';

export function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}

/** A failed load is shown as a failure with a way to retry, never as an empty list. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }} role="alert">
      <Typography variant="h6" component="p">
        This didn&apos;t load
      </Typography>
      <Typography color="text.secondary">{messageOf(error)}</Typography>
      <Button variant="contained" onClick={onRetry}>
        Try again
      </Button>
    </Stack>
  );
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2, minHeight: 48 }}>
      {back && (
        <IconButton component={Link} href={back} aria-label="Back" edge="start">
          <BackIcon />
        </IconButton>
      )}
      <Typography variant="h4" component="h1" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
        {title}
      </Typography>
      {action}
    </Stack>
  );
}

interface PasswordDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Runs with the password just entered; a thrown ApiFailure is shown in the dialog. */
  action: (password: string) => Promise<unknown>;
  onClose: () => void;
  onDone?: () => void;
}

/** Sensitive actions ask for the password again, so an unlocked phone left on a table can't do them. */
export function PasswordDialog({ open, title, children, confirmLabel, danger, action, onClose, onDone }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const close = () => {
    setPassword('');
    onClose();
  };
  const form = useSubmit(
    () => action(password),
    () => {
      close();
      onDone?.();
    },
  );
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <Box component="form" noValidate onSubmit={(e) => (e.preventDefault(), void form.run())}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {children}
            <FormError message={form.error} />
            <PasswordInput label="Your password" value={password} onChange={setPassword} problem={form.fields.password} autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={close}>Cancel</Button>
          <SubmitButton busy={form.busy} size="medium" color={danger ? 'error' : 'primary'}>
            {confirmLabel}
          </SubmitButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** A plain "are you sure?" for actions that can be undone or are low-stakes. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; children?: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      {children && <DialogContent>{children}</DialogContent>}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
