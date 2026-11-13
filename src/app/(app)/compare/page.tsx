'use client';

import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { growthSeries, MEASURE_LABELS, MEASURES } from '@/lib/growth/insights';
import type { Measure } from '@/lib/growth/percentiles';
import { useApp } from '@/ui/app/AppShell';
import { LoadError, Loading, PageHeader } from '@/ui/app/states';
import { useBabyBundle } from '@/ui/queries';
import { Display } from '@/ui/themes/Display';
import { siblingsSummary } from '@/ui/themes/summaries';

/** Two children side by side, by age. Percentiles make children of different ages and sexes comparable. */
export default function ComparePage() {
  const { babies, baby } = useApp();
  const [aId, setAId] = useState(baby?.id ?? '');
  const [bId, setBId] = useState(babies.find((b) => b.id !== baby?.id)?.id ?? '');
  const [measure, setMeasure] = useState<Measure>('weight');
  const a = babies.find((b) => b.id === aId);
  const b = babies.find((x) => x.id === bId);
  const qa = useBabyBundle(a?.id);
  const qb = useBabyBundle(b?.id);

  if (babies.length < 2) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Compare" back="/" />
        <Alert severity="info">Comparing needs two children. Add another from More.</Alert>
      </Stack>
    );
  }
  const picker = (label: string, value: string, set: (id: string) => void, other: string) => (
    <TextField select label={label} value={value} onChange={(e) => set(e.target.value)}>
      {babies
        .filter((x) => x.id !== other)
        .map((x) => (
          <MenuItem key={x.id} value={x.id}>
            {x.name}
          </MenuItem>
        ))}
    </TextField>
  );
  const error = qa.error ?? qb.error;
  const ready = a && b && qa.data && qb.data;
  const series = ready ? [a, b].map((child, i) => ({ baby: child, points: growthSeries(child, (i === 0 ? qa.data! : qb.data!).measurements, measure) })) : [];
  const missingSex = [a, b].filter((child) => child && !child.sex).map((child) => child!.name);
  const anyPoints = series.some((s) => s.points.some((p) => p.percentile != null));

  return (
    <Stack spacing={2}>
      <PageHeader title="Compare" back="/" />
      <Stack direction="row" spacing={1.5}>
        {picker('First (solid)', aId, setAId, bId)}
        {picker('Second (dashed)', bId, setBId, aId)}
      </Stack>
      <Tabs value={measure} onChange={(_, m: Measure) => setMeasure(m)} variant="fullWidth" aria-label="Measurement">
        {MEASURES.map((m) => (
          <Tab key={m} value={m} label={MEASURE_LABELS[m]} />
        ))}
      </Tabs>
      {missingSex.length > 0 && <Alert severity="info">Percentiles need a growth chart chosen for {missingSex.join(' and ')}. An owner can set it in the profile under More.</Alert>}
      {!ready ? (
        error ? (
          <LoadError error={error} onRetry={() => (qa.refetch(), qb.refetch())} />
        ) : (
          <Loading />
        )
      ) : (
        <Display chart title={`${MEASURE_LABELS[measure]} by age`} summary={siblingsSummary(measure, series)} render={(t) => <t.Siblings measure={measure} series={series} />} empty={anyPoints ? undefined : { text: 'Once both have measurements, they will appear here side by side.' }} />
      )}
      <Typography variant="caption" color="text.secondary">
        Every child grows on their own curve. Two siblings on different percentiles is ordinary.
      </Typography>
    </Stack>
  );
}
