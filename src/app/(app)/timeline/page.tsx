'use client';

import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/dates';
import { formatMeasure, MEASURES, measureValue } from '@/lib/growth/insights';
import type { Entry, Measurement } from '@/lib/types';
import { useApp } from '@/ui/app/AppShell';
import { EntryRow } from '@/ui/app/EntryRow';
import { ageAt, KINDS } from '@/ui/app/kinds';
import { LoadError, Loading, PageHeader } from '@/ui/app/states';
import { useTokens } from '@/ui/Providers';
import { useBabyBundle } from '@/ui/queries';

type Filter = 'all' | keyof typeof KINDS;
const FILTERS: Filter[] = ['all', 'first', 'food', 'word', 'note', 'growth'];

type Item = { key: string; date: string | null; created: string; text: string } & ({ entry: Entry } | { measurement: Measurement });

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthHeading = (date: string | null) => (date ? `${MONTHS[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}` : 'Date not remembered');

const measurementText = (m: Measurement) =>
  MEASURES.flatMap((k) => {
    const v = measureValue(m, k);
    return v == null ? [] : [formatMeasure(k, v)];
  }).join(' · ');

export default function TimelinePage() {
  const { baby } = useApp();
  const { ls } = useTokens();
  const { data: bundle, error, refetch } = useBabyBundle(baby?.id);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  // Everything saved, newest first, with undated entries gathered at the end.
  const items = useMemo<Item[]>(() => {
    if (!bundle) return [];
    const all: Item[] = [
      ...bundle.entries.map((entry) => ({ key: entry.id, date: entry.date, created: entry.createdAt, text: `${entry.title} ${entry.note ?? ''}`.toLowerCase(), entry })),
      ...bundle.measurements.map((measurement) => ({ key: measurement.id, date: measurement.date, created: measurement.createdAt, text: `measurement ${measurement.note ?? ''}`.toLowerCase(), measurement })),
    ];
    return all.sort((a, b) => {
      if (a.date !== b.date) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? 1 : -1;
      }
      return a.created < b.created ? 1 : -1;
    });
  }, [bundle]);

  if (!baby) return <PageHeader title="Timeline" />;
  if (!bundle) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;

  const q = query.trim().toLowerCase();
  const shown = items.filter((it) => (filter === 'all' || ('entry' in it ? it.entry.kind === filter : filter === 'growth')) && it.text.includes(q));
  const groups = new Map<string, Item[]>();
  for (const it of shown) {
    const heading = monthHeading('entry' in it && it.entry.datePrecision === 'unknown' ? null : it.date);
    groups.set(heading, [...(groups.get(heading) ?? []), it]);
  }
  const GrowthIcon = KINDS.growth.Icon;

  return (
    <Stack spacing={2}>
      <PageHeader title="Timeline" />
      <TextField
        label="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, rowGap: 1.5 }} role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const selected = f === filter;
          return (
            <Chip
              key={f}
              label={f === 'all' ? 'All' : KINDS[f].plural}
              clickable
              aria-pressed={selected}
              variant={selected ? 'filled' : 'outlined'}
              sx={selected ? { bgcolor: ls.secondaryContainer, color: ls.onSecondaryContainer, fontWeight: 800, '&:hover': { bgcolor: ls.secondaryContainer } } : undefined}
              onClick={() => setFilter(f)}
            />
          );
        })}
      </Stack>
      <Box role="status" className="sr-only">
        {shown.length} {shown.length === 1 ? 'entry' : 'entries'} shown
      </Box>

      {items.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
          Nothing saved for {baby.name} yet. Everything you add will appear here, newest first.
        </Typography>
      ) : shown.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
          Nothing matches. Try another filter or search.
        </Typography>
      ) : (
        [...groups].map(([heading, group]) => (
          <Stack key={heading} component="section" aria-label={heading} spacing={0.5}>
            <Typography variant="subtitle2" component="h2" color="text.secondary" sx={{ px: 1.5 }}>
              {heading}
            </Typography>
            <List disablePadding>
              {group.map((it) =>
                'entry' in it ? (
                  <li key={it.key}>
                    <EntryRow baby={baby} entry={it.entry} />
                  </li>
                ) : (
                  <li key={it.key}>
                    <ListItemButton component={Link} href="/growth" sx={{ borderRadius: 4, gap: 2, px: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: ls.tertiaryContainer, color: ls.onTertiaryContainer, flexShrink: 0, mt: 0.25 }} aria-hidden>
                        <GrowthIcon />
                      </Box>
                      <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 700 }}>
                          <span className="sr-only">Measurement: </span>
                          {measurementText(it.measurement)}
                        </Typography>
                        <Typography color="text.secondary">{[formatDate(it.measurement.date), ageAt(baby, it.measurement.date)].filter(Boolean).join(' · ')}</Typography>
                      </Stack>
                    </ListItemButton>
                  </li>
                ),
              )}
            </List>
          </Stack>
        ))
      )}
    </Stack>
  );
}
