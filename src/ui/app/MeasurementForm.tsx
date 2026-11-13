'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { localToday } from '@/lib/dates';
import { measurementWarnings } from '@/lib/growth/insights';
import type { Baby, Measurement } from '@/lib/types';
import { api } from '../api';
import { FormError, SubmitButton, TextInput } from '../fields';
import { useSubmit } from '../useSubmit';

interface Props {
  baby: Baby;
  measurement?: Measurement;
  /** The baby's other measurements, for the "does this look right?" checks. */
  others: readonly Measurement[];
  onSaved: (measurement: Measurement) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const num = (s: string): number | null => (s.trim() === '' || Number.isNaN(+s) ? null : +s);
const text = (n: number | null | undefined) => (n == null ? '' : String(n));

function Unit({ label, unit, value, onChange, problem }: { label: string; unit: string; value: string; onChange: (v: string) => void; problem?: string }) {
  return (
    <TextInput
      label={label}
      value={value}
      // Digits and one decimal point: a number pad on phones, and no stray letters.
      onChange={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
      problem={problem}
      slotProps={{ htmlInput: { inputMode: 'decimal' }, input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } }}
    />
  );
}

/** Add or edit a weight, length and head measurement. Any one of the three is enough. */
export function MeasurementForm({ baby, measurement, others, onSaved, onCancel, onDelete }: Props) {
  const [date, setDate] = useState(measurement?.date ?? localToday());
  const [lb, setLb] = useState(measurement?.weightOz != null ? String(Math.floor(measurement.weightOz / 16)) : '');
  const [oz, setOz] = useState(measurement?.weightOz != null ? text(Math.round((measurement.weightOz % 16) * 10) / 10) : '');
  const [length, setLength] = useState(text(measurement?.lengthIn));
  const [head, setHead] = useState(text(measurement?.headIn));
  const [note, setNote] = useState(measurement?.note ?? '');
  // The warnings the parent has seen and chosen to save past.
  const [acknowledged, setAcknowledged] = useState<string | null>(null);

  const weightOz = lb === '' && oz === '' ? null : (num(lb) ?? 0) * 16 + (num(oz) ?? 0);
  const input = { date, weightOz, lengthIn: num(length), headIn: num(head) };
  const warnings = measurementWarnings(
    baby,
    input,
    others.filter((m) => m.id !== measurement?.id),
    localToday(),
  );
  const warningKey = warnings.join('|');
  const [showWarnings, setShowWarnings] = useState(false);

  const form = useSubmit(
    () =>
      measurement
        ? api<{ measurement: Measurement }>(`/api/measurements/${measurement.id}`, { method: 'PATCH', body: { ...input, note, expectedUpdatedAt: measurement.updatedAt } })
        : api<{ measurement: Measurement }>(`/api/babies/${baby.id}/measurements`, { method: 'POST', body: { ...input, note } }),
    (res) => onSaved(res.measurement),
  );

  const submit = () => {
    // Unusual numbers get one "is this right?" before saving. They are
    // never refused: a real baby can be unusual.
    if (warnings.length && acknowledged !== warningKey) {
      setShowWarnings(true);
      return;
    }
    void form.run();
  };

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
      <FormError message={form.error} />
      <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} error={Boolean(form.fields.date)} helperText={form.fields.date} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: localToday() } }} />
      <Stack spacing={1}>
        <Typography variant="subtitle2">Weight</Typography>
        <Stack direction="row" spacing={1.5}>
          <Unit label="Pounds" unit="lb" value={lb} onChange={setLb} problem={form.fields.weightOz} />
          <Unit label="Ounces" unit="oz" value={oz} onChange={setOz} />
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1.5}>
        <Unit label="Length" unit="in" value={length} onChange={setLength} problem={form.fields.lengthIn} />
        <Unit label="Head" unit="in" value={head} onChange={setHead} problem={form.fields.headIn} />
      </Stack>
      <TextInput label="Add a note (optional)" value={note} onChange={setNote} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />

      {showWarnings && warnings.length > 0 && acknowledged !== warningKey && (
        <Alert severity="info" role="alert">
          <Typography sx={{ fontWeight: 700 }}>Just checking:</Typography>
          <Stack component="ul" sx={{ pl: 2.5, my: 0.5 }}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </Stack>
          <Button
            sx={{ mt: 1 }}
            variant="outlined"
            onClick={() => {
              setAcknowledged(warningKey);
              void form.run();
            }}
          >
            Yes, save it
          </Button>
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
        {onDelete && (
          <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onCancel}>Cancel</Button>
        <SubmitButton busy={form.busy}>Save</SubmitButton>
      </Stack>
    </Stack>
  );
}
