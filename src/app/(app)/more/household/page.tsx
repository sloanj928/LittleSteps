'use client';

import CopyIcon from '@mui/icons-material/ContentCopy';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Role } from '@/db/schema';
import type { HouseholdSummary, InviteSummary, Member } from '@/lib/types';
import { api } from '@/ui/api';
import { useApp } from '@/ui/app/AppShell';
import { ConfirmDialog, LoadError, Loading, PageHeader, PasswordDialog } from '@/ui/app/states';
import { Block, JoinOrCreate } from '@/ui/app/JoinOrCreate';
import { SubmitButton, TextInput } from '@/ui/fields';
import { useToast, useTokens } from '@/ui/Providers';
import { useRefreshAll } from '@/ui/queries';
import { useSubmit } from '@/ui/useSubmit';

const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', editor: 'Can add and edit', viewer: 'View only' };
const ROLE_ORDER: Role[] = ['viewer', 'editor', 'owner'];
const day = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Members({ household }: { household: HouseholdSummary }) {
  const { me } = useApp();
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const client = useQueryClient();
  const key = ['members', household.id];
  const { data, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<{ members: Member[] }>(`/api/households/${household.id}/members`) });
  const [promote, setPromote] = useState<Member | null>(null);
  const [remove, setRemove] = useState<Member | null>(null);
  if (!data) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;

  const isOwner = household.role === 'owner';
  const owners = data.members.filter((m) => m.role === 'owner').length;
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: key }), refreshAll()]);
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      await refresh();
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t save. Please try again.');
    }
  };
  const setRole = (m: Member, role: Role, password?: string) => api(`/api/households/${household.id}/members/${m.userId}`, { method: 'PATCH', body: { role, password } });

  return (
    <Stack spacing={2} divider={<Divider />}>
      {data.members.map((m) => {
        const self = m.userId === me.user.id;
        const lastOwner = m.role === 'owner' && owners === 1;
        // An owner sets everyone else's role, and may step down themselves
        // once there is another owner. Nobody demotes another owner.
        const canChange = isOwner && (self ? !lastOwner : m.role !== 'owner');
        return (
          <Stack key={m.userId} spacing={1}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {m.username}
              {self && ' (you)'}
            </Typography>
            {canChange ? (
              <TextField select size="small" label={`Role for ${m.username}`} value={m.role} onChange={(e) => (e.target.value === 'owner' ? setPromote(m) : run(() => setRole(m, e.target.value as Role), 'Role updated.'))}>
                {ROLE_ORDER.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Typography color="text.secondary">
                {ROLE_LABELS[m.role]}
                {lastOwner && self && data.members.length > 1 && '. To step down or leave, make someone else an owner first.'}
              </Typography>
            )}
            {((self && !lastOwner) || (isOwner && !self && m.role !== 'owner')) && (
              <Button sx={{ alignSelf: 'flex-start' }} onClick={() => setRemove(m)}>
                {self ? 'Leave household' : 'Remove'}
              </Button>
            )}
          </Stack>
        );
      })}
      <PasswordDialog
        open={Boolean(promote)}
        title={`Make ${promote?.username} an owner?`}
        confirmLabel="Make owner"
        action={(password) => setRole(promote!, 'owner', password)}
        onClose={() => setPromote(null)}
        onDone={() => {
          void refresh();
          toast('They are now an owner.');
        }}
      >
        <Typography>Owners can invite and remove people, export everything, and delete the household. You stay an owner too, unless you step down afterwards.</Typography>
      </PasswordDialog>
      <ConfirmDialog
        open={Boolean(remove)}
        title={remove?.userId === me.user.id ? `Leave ${household.name}?` : `Remove ${remove?.username}?`}
        confirmLabel={remove?.userId === me.user.id ? 'Leave' : 'Remove'}
        onClose={() => setRemove(null)}
        onConfirm={() => run(() => api(`/api/households/${household.id}/members/${remove!.userId}`, { method: 'DELETE' }), remove!.userId === me.user.id ? 'You left the household.' : 'Removed.')}
      >
        <Typography>Entries they added stay in the household, shown as written by a former member. They would need a new invite code to come back.</Typography>
      </ConfirmDialog>
    </Stack>
  );
}

function Invites({ household }: { household: HouseholdSummary }) {
  const toast = useToast();
  const { ls } = useTokens();
  const client = useQueryClient();
  const key = ['invites', household.id];
  const { data, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<{ invites: InviteSummary[] }>(`/api/households/${household.id}/invites`) });
  const [asking, setAsking] = useState(false);
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: key });

  const revoke = async (id: string) => {
    try {
      await api(`/api/households/${household.id}/invites/${id}`, { method: 'DELETE' });
      await refresh();
      toast('Invite revoked.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t work. Please try again.');
    }
  };
  // Shown in two groups so it reads aloud and copies down easily.
  const spaced = issued ? `${issued.code.slice(0, 4)} ${issued.code.slice(4)}` : '';

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">An invite code lets one person join. It works once and lasts 48 hours. People join as view-only; you can change their role here afterwards.</Typography>
      <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={() => setAsking(true)}>
        Create invite code
      </Button>
      {!data ? (
        error ? (
          <LoadError error={error} onRetry={refetch} />
        ) : (
          <Loading />
        )
      ) : (
        data.invites.map((invite) => (
          <Stack key={invite.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography sx={{ flex: 1 }} color="text.secondary">
              Unused code from {invite.createdBy}, expires {day(invite.expiresAt)}
            </Typography>
            <Button onClick={() => revoke(invite.id)}>Revoke</Button>
          </Stack>
        ))
      )}
      <PasswordDialog
        open={asking}
        title="Create an invite code"
        confirmLabel="Create"
        action={async (password) => setIssued(await api<{ code: string; expiresAt: string }>(`/api/households/${household.id}/invites`, { method: 'POST', body: { password } }))}
        onClose={() => setAsking(false)}
        onDone={() => void refresh()}
      />
      <Dialog open={Boolean(issued)} onClose={() => setIssued(null)} fullWidth maxWidth="xs">
        <DialogTitle>Invite code</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography component="p" aria-label={`Code: ${issued?.code.split('').join(' ')}`} sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.12em', textAlign: 'center', py: 2, borderRadius: 4, bgcolor: ls.surfaceContainerHigh, fontVariantNumeric: 'tabular-nums' }}>
              {spaced}
            </Typography>
            <Alert severity="info">This is the only time the code is shown. Share it with the person you&apos;re inviting; they enter it under More, Household, Join a household.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            startIcon={<CopyIcon />}
            onClick={() => {
              void navigator.clipboard?.writeText(issued!.code).then(
                () => toast('Code copied.'),
                () => toast('Copying is blocked here. Please write the code down.'),
              );
            }}
          >
            Copy
          </Button>
          <Button variant="contained" onClick={() => setIssued(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function Rename({ household }: { household: HouseholdSummary }) {
  const toast = useToast();
  const refresh = useRefreshAll();
  const [name, setName] = useState(household.name);
  const form = useSubmit(
    () => api(`/api/households/${household.id}`, { method: 'PATCH', body: { name } }),
    () => {
      void refresh();
      toast('Household renamed.');
    },
  );
  return (
    <Stack component="form" direction="row" spacing={1.5} noValidate onSubmit={(e) => (e.preventDefault(), void form.run())} sx={{ alignItems: 'flex-start' }}>
      <TextInput label="Household name" value={name} onChange={setName} problem={form.fields.name ?? form.error ?? undefined} slotProps={{ htmlInput: { maxLength: 60 } }} />
      <SubmitButton busy={form.busy} size="medium" disabled={form.busy || name.trim() === household.name}>
        Save
      </SubmitButton>
    </Stack>
  );
}

export default function HouseholdPage() {
  const { me, household: current } = useApp();
  const toast = useToast();
  const refresh = useRefreshAll();
  const [selectedId, setSelectedId] = useState(current?.id ?? '');
  const [deleting, setDeleting] = useState(false);
  const household = me.households.find((h) => h.id === selectedId) ?? me.households[0];

  if (!household) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Household" back="/more" />
        <JoinOrCreate />
      </Stack>
    );
  }
  const isOwner = household.role === 'owner';
  const claim = async () => {
    try {
      await api(`/api/households/${household.id}/members`, { method: 'POST' });
      await refresh();
      toast('You are now the owner.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t work. Please try again.');
    }
  };

  return (
    <Stack spacing={2}>
      <PageHeader title="Household" back="/more" />
      {me.households.length > 1 && (
        <TextField select label="Household" value={household.id} onChange={(e) => setSelectedId(e.target.value)}>
          {me.households.map((h) => (
            <MenuItem key={h.id} value={h.id}>
              {h.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {household.ownerlessSince && (
        <Alert severity="warning" action={<Button onClick={claim}>Become owner</Button>}>
          This household has no owner, because its owner&apos;s account was deleted. If nobody becomes the owner within 30 days of that, the household and its entries are deleted.
        </Alert>
      )}

      <Block title={household.name}>
        {isOwner ? <Rename key={household.id} household={household} /> : <Typography color="text.secondary">Your role: {ROLE_LABELS[household.role]}</Typography>}
      </Block>
      <Block title="Members">
        <Members key={household.id} household={household} />
      </Block>
      {isOwner && (
        <Block title="Invite someone">
          <Invites key={household.id} household={household} />
        </Block>
      )}
      {isOwner && (
        <Block title="Export">
          <Typography color="text.secondary">Download everything this household has saved. JSON has it all in one file; the CSV files open in a spreadsheet.</Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
            {[
              ['json', 'Everything (JSON)'],
              ['entries.csv', 'Entries (CSV)'],
              ['measurements.csv', 'Measurements (CSV)'],
            ].map(([format, label]) => (
              <Button key={format} variant="outlined" component="a" href={`/api/households/${household.id}/export?format=${format}`} download>
                {label}
              </Button>
            ))}
          </Stack>
        </Block>
      )}

      <JoinOrCreate />

      {isOwner && (
        <Block title="Delete this household">
          <Typography color="text.secondary">Removes the household, its babies and every entry for everyone in it. Export first if you want a copy.</Typography>
          <Button color="error" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => setDeleting(true)}>
            Delete household
          </Button>
          <PasswordDialog
            open={deleting}
            danger
            title={`Delete ${household.name}?`}
            confirmLabel="Delete household"
            action={(password) => api(`/api/households/${household.id}`, { method: 'DELETE', body: { password } })}
            onClose={() => setDeleting(false)}
            onDone={() => {
              void refresh();
              toast('Household deleted.');
            }}
          >
            <Typography>This removes it for every member straight away. The data is erased for good after 30 days.</Typography>
          </PasswordDialog>
        </Block>
      )}
    </Stack>
  );
}
