'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/ui/api';
import { useApp } from '@/ui/app/AppShell';
import { Block } from '@/ui/app/JoinOrCreate';
import { LoadError, Loading, PageHeader, PasswordDialog } from '@/ui/app/states';
import { FormError, SubmitButton, TextInput } from '@/ui/fields';
import { useToast, useTokens } from '@/ui/Providers';
import { useSubmit } from '@/ui/useSubmit';

interface SupportRequest {
  id: string;
  usernameEntered: string;
  note: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

interface FoundUser {
  id: string;
  username: string;
  createdAt: string;
  mustReset: boolean;
  deletionScheduledFor: string | null;
  signInPaused: boolean;
  pinPaused: boolean;
  pinFrozen: boolean;
}

interface AuditRow {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  actor: string;
  target: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Requests() {
  const toast = useToast();
  const client = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ['admin', 'support'], queryFn: () => api<{ requests: SupportRequest[] }>('/api/admin/support') });
  if (!data) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;
  const open = data.requests.filter((r) => r.status === 'open');
  const mark = async (id: string, status: SupportRequest['status']) => {
    try {
      await api('/api/admin/support', { method: 'PATCH', body: { id, status } });
      await client.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t save.');
    }
  };
  if (!open.length) return <Typography color="text.secondary">No open requests.</Typography>;
  return (
    <Stack spacing={2} divider={<Divider />}>
      {open.map((r) => (
        <Stack key={r.id} spacing={1}>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{r.usernameEntered}</Typography>
          <Typography color="text.secondary">{when(r.createdAt)}</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.note}</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => mark(r.id, 'resolved')}>
              Resolved
            </Button>
            <Button onClick={() => mark(r.id, 'dismissed')}>Dismiss</Button>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function Recovery() {
  const { ls } = useTokens();
  const client = useQueryClient();
  const [username, setUsername] = useState('');
  const [found, setFound] = useState<FoundUser | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const lookup = useSubmit(
    () => api<FoundUser>(`/api/admin/users?username=${encodeURIComponent(username)}`),
    (user) => {
      setFound(user);
      setTemp(null);
      void client.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  );
  const state = found ? [found.signInPaused && 'sign-in paused', found.pinPaused && 'PIN reset paused', found.pinFrozen && 'PIN reset frozen', found.mustReset && 'waiting to finish a reset', found.deletionScheduledFor && 'scheduled for deletion'].filter(Boolean) : [];

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">Before issuing a temporary password, confirm who is asking by a channel you trust, such as a phone call or in person. You can&apos;t see anyone&apos;s households or entries.</Typography>
      <Stack component="form" direction="row" spacing={1.5} noValidate onSubmit={(e) => (e.preventDefault(), void lookup.run())} sx={{ alignItems: 'flex-start' }}>
        <TextInput label="Exact username" value={username} onChange={setUsername} autoCapitalize="none" spellCheck={false} />
        <SubmitButton busy={lookup.busy} size="medium">
          Look up
        </SubmitButton>
      </Stack>
      <FormError message={lookup.code === 'NOT_FOUND' ? 'No account with that username.' : lookup.error} />
      {found && (
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 700 }}>{found.username}</Typography>
          <Typography color="text.secondary">
            Created {when(found.createdAt)}. {state.length ? `Currently: ${state.join(', ')}.` : 'No locks.'}
          </Typography>
          <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={() => setConfirming(true)}>
            Issue temporary password
          </Button>
        </Stack>
      )}
      {temp && (
        <Alert severity="success">
          <Typography>Give {found?.username} this one-time password. It is not shown again. At sign-in they will choose a new password and PIN.</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.08em', mt: 1, p: 1.5, borderRadius: 3, bgcolor: ls.surface, textAlign: 'center', overflowWrap: 'anywhere' }}>{temp}</Typography>
        </Alert>
      )}
      <PasswordDialog
        open={confirming}
        title={`Reset ${found?.username}?`}
        confirmLabel="Issue"
        action={async (password) => setTemp((await api<{ tempPassword: string }>(`/api/admin/users/${found!.id}/temp-password`, { method: 'POST', body: { password } })).tempPassword)}
        onClose={() => setConfirming(false)}
        onDone={() => void client.invalidateQueries({ queryKey: ['admin', 'audit'] })}
      >
        <Typography>This signs them out everywhere and unlocks PIN reset. Their old password stops working.</Typography>
      </PasswordDialog>
    </Stack>
  );
}

function Audit() {
  const { data, error, refetch } = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<{ log: AuditRow[] }>('/api/admin/audit') });
  if (!data) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;
  if (!data.log.length) return <Typography color="text.secondary">Nothing logged yet.</Typography>;
  return (
    <Stack spacing={1} divider={<Divider />}>
      {data.log.map((row) => (
        <Typography key={row.id} sx={{ overflowWrap: 'anywhere' }}>
          <strong>{row.actor}</strong> {row.action}
          {row.target ? ` → ${row.target}` : ''} <Typography component="span" color="text.secondary">· {when(row.createdAt)}</Typography>
        </Typography>
      ))}
    </Stack>
  );
}

export default function AdminPage() {
  const { me } = useApp();
  if (!me.user.isAdmin) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Not found" back="/more" />
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <PageHeader title="Admin" back="/more" />
      <Block title="Support requests">
        <Requests />
      </Block>
      <Block title="Account recovery">
        <Recovery />
      </Block>
      <Block title="Audit log">
        <Audit />
      </Block>
    </Stack>
  );
}
