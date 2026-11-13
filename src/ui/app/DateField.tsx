'use client';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { DatePrecision } from '@/db/schema';
import { localToday, monthDate, seasonDate, seasonOf, SEASONS, type Season } from '@/lib/dates';

export interface DateValue {
  date: string | null;
  precision: DatePrecision;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PRECISIONS: { value: DatePrecision; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'season', label: 'Season' },
  { value: 'unknown', label: 'Not sure' },
];

/**
 * A date that can be as vague as memory is: an exact day, a month, a season,
 * or "not sure". Months and seasons are stored as a representative day so
 * everything still sorts.
 */
export function DateField({ value, onChange, minYear, problem }: { value: DateValue; onChange: (v: DateValue) => void; minYear: number; problem?: string }) {
  const today = localToday();
  const thisYear = +today.slice(0, 4);
  const base = value.date ?? today;
  const year = +base.slice(0, 4);
  const month = +base.slice(5, 7);
  const years = Array.from({ length: Math.max(1, thisYear - minYear + 1) }, (_, i) => thisYear - i);

  const setPrecision = (precision: DatePrecision | null) => {
    if (!precision) return;
    if (precision === 'unknown') return onChange({ date: null, precision });
    if (precision === 'day') return onChange({ date: value.precision === 'day' && value.date ? value.date : today, precision });
    if (precision === 'month') return onChange({ date: monthDate(year, month), precision });
    onChange({ date: seasonDate(year, seasonOf(monthDate(year, nearestSeasonMonth(month)))), precision });
  };

  return (
    <Stack spacing={1.5}>
      <Typography component="legend" variant="subtitle2">
        When?
      </Typography>
      <ToggleButtonGroup exclusive fullWidth value={value.precision} onChange={(_, p: DatePrecision | null) => setPrecision(p)} aria-label="How exactly do you remember the date?">
        {PRECISIONS.map((p) => (
          <ToggleButton key={p.value} value={p.value}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {value.precision === 'day' && (
        <TextField
          type="date"
          label="Date"
          value={value.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value || null, precision: 'day' })}
          error={Boolean(problem)}
          helperText={problem}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
        />
      )}
      {value.precision === 'month' && (
        <Stack direction="row" spacing={1.5}>
          <TextField select label="Month" value={month} onChange={(e) => onChange({ date: monthDate(year, +e.target.value), precision: 'month' })}>
            {MONTHS.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <YearSelect year={year} years={years} onChange={(y) => onChange({ date: monthDate(y, month), precision: 'month' })} />
        </Stack>
      )}
      {value.precision === 'season' && (
        <Stack direction="row" spacing={1.5}>
          <TextField select label="Season" value={seasonOf(base)} onChange={(e) => onChange({ date: seasonDate(year, e.target.value as Season), precision: 'season' })}>
            {SEASONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <YearSelect year={year} years={years} onChange={(y) => onChange({ date: seasonDate(y, seasonOf(base)), precision: 'season' })} />
        </Stack>
      )}
      {value.precision === 'unknown' && <Typography color="text.secondary">That&apos;s fine. It will be saved without a date, and you can add one later.</Typography>}
      {value.precision !== 'day' && problem && (
        <Typography color="error" role="alert">
          {problem}
        </Typography>
      )}
    </Stack>
  );
}

// Seasons are filed under their middle month (Jan, Apr, Jul, Oct).
function nearestSeasonMonth(month: number): number {
  return month === 12 || month <= 2 ? 1 : month <= 5 ? 4 : month <= 8 ? 7 : 10;
}

function YearSelect({ year, years, onChange }: { year: number; years: number[]; onChange: (year: number) => void }) {
  return (
    <TextField select label="Year" value={years.includes(year) ? year : years[0]} onChange={(e) => onChange(+e.target.value)} sx={{ maxWidth: 140 }}>
      {years.map((y) => (
        <MenuItem key={y} value={y}>
          {y}
        </MenuItem>
      ))}
    </TextField>
  );
}
