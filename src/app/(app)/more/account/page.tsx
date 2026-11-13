'use client';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PASSWORD_MIN, pinProblem } from '@/lib/auth/rules';
import type { SessionSummary } from '@/lib/types';
import { api, reloadAt } from '@/ui/api';
import { Block } from '@/ui/app/JoinOrCreate';
import { LoadError, Loading, PageHeader, PasswordDialog } from '@/ui/app/states';
import { FormError, PasswordInput, PinInput, SubmitButton } from '@/ui/fields';
import { useToast } from '@/ui/Providers';
import { useSubmit } from '@/ui/useSubmit';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "Safari on iPhone" from a user-agent string: enough to recognise a device, no more. */
function deviceName(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'a device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${device}`;
}

function ChangePassword() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const form = useSubmit(
    () => api('/api/me/password', { method: 'POST', body: { password, newPassword } }),
    () => {
      setPassword('');
      setNewPassword('');
      toast('Password changed. Other devices were signed out.');
    },
  );
  return (
    <Stack component="form" spacing={2} noValidate onSubmit={(e) => (e.preventDefault(), void form.run())}>
      <FormError message={form.error} />
      <PasswordInput label="Current password" value={password} onChange={setPassword} problem={form.fields.password} />
      <PasswordInput isNew label="New password" value={newPassword} onChange={setNewPassword} problem={form.fields.newPassword} helperText={`At least ${PASSWORD_MIN} characters.`} />
      <SubmitButton busy={form.busy} sx={{ alignSelf: 'flex-start' }}>
        Change password
      </SubmitButton>
    </Stack>
  );
}

function ChangePin() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [again, setAgain] = useState('');
  const [checked, setChecked] = useState(false);
  const local = pinProblem(newPin) ?? (newPin === again ? null : "The two PINs don't match.");
  const form = useSubmit(
    () => api('/api/me/pin', { method: 'POST', body: { password, newPin } }),
    () => {
      setPassword('');
      setNewPin('');
      setAgain('');
      setChecked(false);
      toast('PIN changed.');
    },
  );
  return (
    <Stack
      component="form"
      spacing={2}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
        if (!local) void form.run();
      }}
    >
      <Typography color="text.secondary">Your PIN resets a forgotten password. It is never used to sign in.</Typography>
      <FormError message={form.error} />
      <PasswordInput label="Current password" value={password} onChange={setPassword} problem={form.fields.password} />
      <PinInput label="New 6-digit PIN" value={newPin} onChange={setNewPin} problem={form.fields.newPin ?? (checked && pinProblem(newPin) ? pinProblem(newPin)! : undefined)} />
      <PinInput label="New PIN again" value={again} onChange={setAgain} problem={checked && newPin !== again ? "The two PINs don't match." : undefined} />
      <SubmitButton busy={form.busy} sx={{ alignSelf: 'flex-start' }}>
        Change PIN
      </SubmitButton>
    </Stack>
  );
}

function Devices() {
  const toast = useToast();
  const client = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ['sessions'], queryFn: () => api<{ sessions: SessionSummary[] }>('/api/me/sessions') });
  if (!data) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      await client.invalidateQueries({ queryKey: ['sessions'] });
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t work. Please try again.');
    }
  };
  return (
    <Stack spacing={2} divider={<Divider />}>
      {data.sessions.map((s) => (
        <Stack key={s.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Stack sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {deviceName(s.userAgent)}
              {s.current && ' (this device)'}
            </Typography>
            <Typography color="text.secondary">Last used {when(s.lastSeenAt)}</Typography>
          </Stack>
          {!s.current && <Button onClick={() => run(() => api(`/api/me/sessions/${s.id}`, { method: 'DELETE' }), 'Signed out that device.')}>Sign out</Button>}
        </Stack>
      ))}
      {data.sessions.length > 1 && (
        <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => run(() => api('/api/me/sessions', { method: 'DELETE' }), 'Signed out every other device.')}>
          Sign out other devices
        </Button>
      )}
    </Stack>
  );
}

export default function AccountPage() {
  const [deleting, setDeleting] = useState(false);
  return (
    <Stack spacing={2}>
      <PageHeader title="Account" back="/more" />
      <Block title="Password">
        <ChangePassword />
      </Block>
      <Block title="Reset PIN">
        <ChangePin />
      </Block>
      <Block title="Signed-in devices">
        <Typography color="text.secondary">A device stays signed in for 30 days after its last use, and never longer than 90 days.</Typography>
        <Devices />
      </Block>
      <Block title="Delete account">
        <Typography color="text.secondary">Your account is deleted after 30 days. Signing in again before then cancels it. A household only you are in is deleted with it; for a shared one, make someone else an owner first.</Typography>
        <Button color="error" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => setDeleting(true)}>
          Delete my account
        </Button>
        <PasswordDialog open={deleting} danger title="Delete your account?" confirmLabel="Delete account" action={(password) => api('/api/me/delete', { method: 'POST', body: { password } })} onClose={() => setDeleting(false)} onDone={() => reloadAt('/signin')}>
          <Typography>You will be signed out everywhere now. In 30 days the account is erased. To change your mind, just sign in again before then.</Typography>
        </PasswordDialog>
      </Block>
    </Stack>
  );
}
