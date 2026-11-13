'use client';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { formatEntryDate } from '@/lib/dates';
import { FOOD_SUGGESTIONS } from '@/lib/foods';
import { nameKey, rankMatches } from '@/lib/match';
import type { Entry } from '@/lib/types';

interface Option {
  name: string;
  /** Set when the name is already on this baby's list. */
  entry?: Entry;
}

const MAX_SHOWN = 8;

/**
 * The name box for a food or word. As the family types, the dropdown shows
 * what's already on the list, close spellings included ("bananna" finds
 * Banana), above common first foods not yet tried. Picking an "already
 * added" name makes the form point at the existing entry rather than save a
 * second one.
 */
export function ListNameField({ kind, label, value, onChange, existing, problem }: { kind: 'food' | 'word'; label: string; value: string; onChange: (value: string) => void; existing: Entry[]; problem?: string }) {
  const options = useMemo<Option[]>(() => {
    const listed = new Set(existing.map((e) => nameKey(e.title)));
    const suggestions = kind === 'food' ? FOOD_SUGGESTIONS.filter((name) => !listed.has(nameKey(name))).map((name) => ({ name })) : [];
    return [...existing.map((entry) => ({ name: entry.title, entry })), ...suggestions];
  }, [existing, kind]);

  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      options={options}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
      // Nothing until a letter is typed: a list of every food would bury the box.
      filterOptions={(opts, { inputValue }) => (inputValue.trim() ? rankMatches(inputValue, opts, (o) => o.name).slice(0, MAX_SHOWN) : [])}
      renderOption={({ key, ...props }, o) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <span>{o.name}</span>
          {o.entry && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              Added{o.entry.date ? ` ${formatEntryDate(o.entry.date, o.entry.datePrecision)}` : ''}
            </Typography>
          )}
        </Box>
      )}
      renderInput={(params) => <TextField {...params} label={label} error={Boolean(problem)} helperText={problem} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, maxLength: 120 } }} />}
    />
  );
}
