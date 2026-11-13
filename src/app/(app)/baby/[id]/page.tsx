'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDate, localToday } from '@/lib/dates';
import type { Baby } from '@/lib/types';
import { api } from '@/ui/api';
import { useApp } from '@/ui/app/AppShell';
import { ConfirmDialog, PageHeader } from '@/ui/app/states';
import { FormError, SubmitButton, TextInput } from '@/ui/fields';
import { useToast } from '@/ui/Providers';
import { useRefreshAll } from '@/ui/queries';
import { useSubmit } from '@/ui/useSubmit';

type SexChoice = 'female' | 'male' | '';

function BabyForm({ baby, householdId }: { baby?: Baby; householdId: string }) {
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefreshAll();
  const { selectBaby } = useApp();
  const [name, setName] = useState(baby?.name ?? '');
  const [birthDate, setBirthDate] = useState(baby?.birthDate ?? '');
  const [sex, setSex] = useState<SexChoice>(baby?.sex ?? '');
  const [early, setEarly] = useState(Boolean(baby?.dueDate));
  const [dueDate, setDueDate] = useState(baby?.dueDate ?? '');
  const [correctedAge, setCorrectedAge] = useState(baby?.correctedAge ?? true);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const body = { name, birthDate, sex: sex || null, dueDate: early && dueDate ? dueDate : null, correctedAge: early && correctedAge };
  const form = useSubmit(
    () => api<{ id?: string }>(baby ? `/api/babies/${baby.id}` : `/api/households/${householdId}/babies`, { method: baby ? 'PATCH' : 'POST', body }),
    async (res) => {
      await refresh();
      if (res.id) selectBaby(res.id);
      toast(baby ? 'Profile saved.' : `${name} added.`);
      router.push(baby ? '/more' : '/');
    },
  );
  const archive = async (archived: boolean) => {
    try {
      await api(`/api/babies/${baby!.id}`, { method: 'PATCH', body: { archived } });
      await refresh();
      toast(archived ? `${baby!.name}'s profile is archived.` : `${baby!.name}'s profile is back.`);
      router.push('/more');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t save. Please try again.');
    }
  };

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={(e) => (e.preventDefault(), void form.run())}>
      <FormError message={form.error} />
      <TextInput label="Name" value={name} onChange={setName} problem={form.fields.name} slotProps={{ htmlInput: { maxLength: 60 } }} />
      <TextField type="date" label="Birth date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={Boolean(form.fields.birthDate)} helperText={form.fields.birthDate} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: localToday() } }} />
      <TextField select label="Growth chart to use" value={sex} onChange={(e) => setSex(e.target.value as SexChoice)} helperText="Optional. Growth percentiles differ for girls and boys; this is the only thing it is used for." slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">Not set</MenuItem>
        <MenuItem value="female">Girls</MenuItem>
        <MenuItem value="male">Boys</MenuItem>
      </TextField>
      <FormControlLabel control={<Switch checked={early} onChange={(e) => setEarly(e.target.checked)} />} label="Born early (before 37 weeks)" />
      {early && (
        <>
          <TextField type="date" label="Original due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={Boolean(form.fields.dueDate)} helperText={form.fields.dueDate} slotProps={{ inputLabel: { shrink: true } }} />
          <FormControlLabel control={<Switch checked={correctedAge} onChange={(e) => setCorrectedAge(e.target.checked)} />} label="Show corrected age until age 2" />
          <Typography color="text.secondary">Corrected age counts from the due date. Ages, growth percentiles and reminders will use it until the second birthday, and say so.</Typography>
        </>
      )}
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
        {baby && (
          <Button sx={{ mr: 'auto' }} onClick={() => (baby.archivedAt ? archive(false) : setConfirmArchive(true))}>
            {baby.archivedAt ? 'Unarchive' : 'Archive'}
          </Button>
        )}
        <SubmitButton busy={form.busy}>{baby ? 'Save' : 'Add baby'}</SubmitButton>
      </Stack>
      {baby && (
        <ConfirmDialog open={confirmArchive} title={`Archive ${baby.name}'s profile?`} confirmLabel="Archive" onConfirm={() => archive(true)} onClose={() => setConfirmArchive(false)}>
          <Typography>It will be hidden from the app. Nothing is deleted, and an owner can bring it back from More at any time.</Typography>
        </ConfirmDialog>
      )}
    </Stack>
  );
}

export default function BabyPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useApp();
  const owned = me.households.filter((h) => h.role === 'owner');
  const [householdId, setHouseholdId] = useState(owned[0]?.id ?? '');

  if (id === 'new') {
    return (
      <Stack spacing={2}>
        <PageHeader title="Add a baby" back="/more" />
        {owned.length === 0 ? (
          <Alert severity="info">Only a household owner can add a baby.</Alert>
        ) : (
          <>
            {owned.length > 1 && (
              <TextField select label="Household" value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
                {owned.map((h) => (
                  <MenuItem key={h.id} value={h.id}>
                    {h.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <BabyForm key={householdId} householdId={householdId} />
          </>
        )}
      </Stack>
    );
  }

  const household = me.households.find((h) => h.babies.some((b) => b.id === id));
  const baby = household?.babies.find((b) => b.id === id);
  if (!household || !baby) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Profile" back="/more" />
        <Alert severity="info">We couldn&apos;t find that profile.</Alert>
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <PageHeader title={baby.name} back="/more" />
      {household.role === 'owner' ? (
        <BabyForm baby={baby} householdId={household.id} />
      ) : (
        <Stack spacing={1}>
          <Typography>Born {formatDate(baby.birthDate)}</Typography>
          {baby.dueDate && <Typography>Due date {formatDate(baby.dueDate)}</Typography>}
          <Typography color="text.secondary">Only a household owner can change a baby&apos;s profile.</Typography>
        </Stack>
      )}
    </Stack>
  );
}
