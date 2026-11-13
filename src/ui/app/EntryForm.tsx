'use client';

import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { EntryKind, FoodGroup, Reaction } from '@/db/schema';
import { formatEntryDate, localToday } from '@/lib/dates';
import { FOOD_GROUP_LABELS, FOOD_SUGGESTIONS, guessFoodGroup } from '@/lib/foods';
import { MILESTONES } from '@/lib/milestones';
import type { Baby, Entry } from '@/lib/types';
import { api } from '../api';
import { FormError, SubmitButton, TextInput } from '../fields';
import { useTokens } from '../Providers';
import { useSubmit } from '../useSubmit';
import { DateField, type DateValue } from './DateField';
import { REACTIONS } from './kinds';

const TITLE_LABEL: Record<EntryKind, string> = { first: 'What happened?', food: 'Food', word: 'Word', note: 'Note' };
const NOTE_TITLE_MAX = 60;

interface Props {
  baby: Baby;
  kind: EntryKind;
  /** Present when editing. */
  entry?: Entry;
  /** Milestone keys already logged, so the library only offers what's left. */
  loggedKeys?: ReadonlySet<string>;
  /** A milestone to start with, when the form is opened from a nudge. */
  initialMilestone?: string;
  onSaved: (entry: Entry) => void;
  onCancel: () => void;
}

/** Add or edit a first, food, word or note. One form, because they share most of their fields. */
export function EntryForm({ baby, kind, entry, loggedKeys, initialMilestone, onSaved, onCancel }: Props) {
  const { ls } = useTokens();
  const start = MILESTONES.find((m) => m.key === initialMilestone);
  const [title, setTitle] = useState(entry?.title ?? start?.label ?? '');
  const [milestoneKey, setMilestoneKey] = useState<string | null>(entry?.milestoneKey ?? start?.key ?? null);
  const [when, setWhen] = useState<DateValue>(entry ? { date: entry.date, precision: entry.datePrecision } : { date: localToday(), precision: 'day' });
  const [reaction, setReaction] = useState<Reaction | null>(entry?.reaction ?? null);
  const [allergyFlag, setAllergyFlag] = useState(entry?.allergyFlag ?? false);
  // Null means "let the app guess from the name".
  const [foodGroup, setFoodGroup] = useState<FoodGroup | null>(entry?.foodGroup ?? null);
  const [note, setNote] = useState(entry?.note ?? '');
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  // The version this edit started from; a conflict replaces it with theirs.
  const [base, setBase] = useState(entry);

  const isNote = kind === 'note';
  const body = () => ({
    kind,
    // A note is just its text; its title is the opening words, for lists.
    title: isNote ? note.trim().split('\n')[0].slice(0, NOTE_TITLE_MAX) : title,
    milestoneKey: kind === 'first' ? milestoneKey : null,
    date: when.date,
    datePrecision: when.precision,
    reaction,
    allergyFlag,
    foodGroup,
    note,
  });

  const form = useSubmit(
    () =>
      base
        ? api<{ entry: Entry }>(`/api/entries/${base.id}`, { method: 'PATCH', body: { ...body(), expectedUpdatedAt: base.updatedAt } })
        : api<{ entry: Entry }>(`/api/babies/${baby.id}/entries`, { method: 'POST', body: { ...body(), confirmDuplicate } }),
    (res) => onSaved(res.entry),
  );

  const existing = form.code === 'DUPLICATE' ? (form.details.existing as Entry) : null;
  const theirs = form.code === 'CONFLICT' ? (form.details.entry as Entry) : null;
  const library = MILESTONES.filter((m) => !loggedKeys?.has(m.key) || m.key === milestoneKey);

  const pickTitle = (value: string) => {
    setTitle(value);
    // Typing over a library first makes it a custom one.
    if (milestoneKey && value !== MILESTONES.find((m) => m.key === milestoneKey)?.label) setMilestoneKey(null);
    setConfirmDuplicate(false);
  };

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={(e) => (e.preventDefault(), void form.run())}>
      {existing ? (
        <Alert severity="info" role="alert" action={null}>
          <strong>{existing.title}</strong> is already saved ({formatEntryDate(existing.date, existing.datePrecision)}). If this is a different moment, you can save it as well.
          <Button
            sx={{ display: 'flex', mt: 1 }}
            variant="outlined"
            onClick={() => {
              setConfirmDuplicate(true);
              form.clear();
            }}
          >
            Keep both
          </Button>
        </Alert>
      ) : theirs ? (
        <Alert severity="warning" role="alert">
          {form.error}
          <Typography sx={{ mt: 1 }}>
            Their version: <strong>{theirs.title}</strong>, {formatEntryDate(theirs.date, theirs.datePrecision)}
            {theirs.note ? `. ${theirs.note}` : ''}
          </Typography>
          <Button
            sx={{ display: 'flex', mt: 1 }}
            variant="outlined"
            onClick={() => {
              // Their saved version becomes the base; what was typed here stays in the fields to compare and re-save.
              setBase(theirs);
              form.clear();
            }}
          >
            Keep my changes and save over theirs
          </Button>
        </Alert>
      ) : (
        <FormError message={form.error} />
      )}
      {confirmDuplicate && !existing && <Alert severity="info">Saving this as a second entry.</Alert>}

      {kind === 'first' && (
        <Stack spacing={1}>
          <Typography variant="subtitle2" id="library-label">
            Pick one, or write your own
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, rowGap: 1.5 }} role="group" aria-labelledby="library-label">
            {library.map((m) => {
              const selected = milestoneKey === m.key;
              return (
                <Chip
                  key={m.key}
                  label={m.label}
                  clickable
                  aria-pressed={selected}
                  variant={selected ? 'filled' : 'outlined'}
                  // Selection shows as a filled chip with a heavier label, not by colour alone.
                  sx={selected ? { bgcolor: ls.secondaryContainer, color: ls.onSecondaryContainer, fontWeight: 800, '&:hover': { bgcolor: ls.secondaryContainer } } : undefined}
                  onClick={() => {
                    setMilestoneKey(selected ? null : m.key);
                    setTitle(selected ? '' : m.label);
                    setConfirmDuplicate(false);
                  }}
                />
              );
            })}
          </Stack>
        </Stack>
      )}

      {kind === 'food' ? (
        <Autocomplete
          freeSolo
          options={FOOD_SUGGESTIONS}
          inputValue={title}
          onInputChange={(_, value) => pickTitle(value)}
          renderInput={(params) => <TextField {...params} label={TITLE_LABEL.food} error={Boolean(form.fields.title)} helperText={form.fields.title} />}
        />
      ) : (
        !isNote && <TextInput label={TITLE_LABEL[kind]} value={title} onChange={pickTitle} problem={form.fields.title} slotProps={{ htmlInput: { maxLength: 120 } }} />
      )}

      {kind === 'food' && (
        <>
          <Stack spacing={1}>
            <Typography variant="subtitle2" id="reaction-label">
              How did it go?
            </Typography>
            <ToggleButtonGroup exclusive fullWidth value={reaction} onChange={(_, r: Reaction | null) => setReaction(r)} aria-labelledby="reaction-label">
              {(Object.keys(REACTIONS) as Reaction[]).map((r) => {
                const { label, Icon } = REACTIONS[r];
                return (
                  <ToggleButton key={r} value={r} sx={{ flexDirection: 'column', gap: 0.5, lineHeight: 1.2, py: 1 }}>
                    <Icon />
                    {label}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          </Stack>
          <TextField select label="Food group" value={foodGroup ?? guessFoodGroup(title)} onChange={(e) => setFoodGroup(e.target.value as FoodGroup)}>
            {(Object.keys(FOOD_GROUP_LABELS) as FoodGroup[]).map((g) => (
              <MenuItem key={g} value={g}>
                {FOOD_GROUP_LABELS[g]}
              </MenuItem>
            ))}
          </TextField>
          <Stack>
            <FormControlLabel
              control={<Checkbox checked={allergyFlag} onChange={(e) => setAllergyFlag(e.target.checked)} />}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <WarningIcon sx={{ color: ls.caution }} />
                  <span>Possible allergic reaction</span>
                </Stack>
              }
            />
            {allergyFlag && (
              <Alert severity="warning" icon={false} sx={{ bgcolor: ls.cautionContainer, color: ls.onCautionContainer }}>
                This is a note for your records, not medical advice. If your baby has trouble breathing, swelling or seems very unwell, call emergency services. Otherwise, tell your pediatrician.
              </Alert>
            )}
          </Stack>
        </>
      )}

      <DateField value={when} onChange={setWhen} minYear={+baby.birthDate.slice(0, 4)} problem={form.fields.date} />

      <TextInput
        label={isNote ? 'Note' : 'Add a note (optional)'}
        value={note}
        onChange={setNote}
        multiline
        minRows={isNote ? 4 : 2}
        problem={form.fields.note ?? (isNote ? form.fields.title : undefined)}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />

      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <SubmitButton busy={form.busy}>{confirmDuplicate ? 'Save as well' : 'Save'}</SubmitButton>
      </Stack>
    </Stack>
  );
}
