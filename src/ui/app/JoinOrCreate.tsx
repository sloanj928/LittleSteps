'use client';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { api } from '../api';
import { FormError, SubmitButton, TextInput } from '../fields';
import { inviteCodeFrom } from '../invite';
import { useToast } from '../Providers';
import { useRefreshAll } from '../queries';
import { useSubmit } from '../useSubmit';

/** A titled card: one topic on a settings screen. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title} sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {children}
      </Stack>
    </Card>
  );
}

/** Join with a code, or start another household: the two ways into one. Also the whole of onboarding. */
export function JoinOrCreate({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const refresh = useRefreshAll();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const join = useSubmit(
    () => api('/api/invites/join', { method: 'POST', body: { code } }),
    async () => {
      setCode('');
      await refresh();
      toast('You joined the household.');
      onDone?.();
    },
  );
  const create = useSubmit(
    () => api('/api/households', { method: 'POST', body: { name } }),
    async () => {
      setName('');
      await refresh();
      toast('Household created.');
      onDone?.();
    },
  );
  return (
    <>
      <Block title="Join a household">
        <Stack component="form" spacing={2} noValidate onSubmit={(e) => (e.preventDefault(), void join.run())}>
          <FormError message={join.error} />
          <TextInput label="Invite code" value={code} onChange={(v) => setCode(v.includes('#') ? inviteCodeFrom(v) : v.toUpperCase())} problem={join.fields.code} autoCapitalize="characters" autoComplete="off" spellCheck={false} helperText="8 letters and numbers, or paste the invite link." />
          <SubmitButton busy={join.busy} sx={{ alignSelf: 'flex-start' }}>
            Join
          </SubmitButton>
        </Stack>
      </Block>
      <Block title="Start a new household">
        <Stack component="form" spacing={2} noValidate onSubmit={(e) => (e.preventDefault(), void create.run())}>
          <FormError message={create.error} />
          <TextInput label="Household name" value={name} onChange={setName} problem={create.fields.name} helperText="For example, your family name." slotProps={{ htmlInput: { maxLength: 60 } }} />
          <SubmitButton busy={create.busy} sx={{ alignSelf: 'flex-start' }}>
            Create
          </SubmitButton>
        </Stack>
      </Block>
    </>
  );
}
