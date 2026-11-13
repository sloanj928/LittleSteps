'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useState, useSyncExternalStore } from 'react';
import { formatDate } from '@/lib/dates';
import { formatMeasure, growthCaption, growthSeries, MEASURE_LABELS, MEASURES, measureValue } from '@/lib/growth/insights';
import { formatPercentile, type Measure, type Sex } from '@/lib/growth/percentiles';
import type { Measurement } from '@/lib/types';
import { api } from '@/ui/api';
import { useApp, type BabyInHousehold } from '@/ui/app/AppShell';
import { ageAt } from '@/ui/app/kinds';
import { MeasurementForm } from '@/ui/app/MeasurementForm';
import { Sheet } from '@/ui/app/QuickAdd';
import { LoadError, Loading, PageHeader } from '@/ui/app/states';
import { useToast } from '@/ui/Providers';
import { useBabyBundle, useRefreshAll, useRefreshBaby } from '@/ui/queries';
import { Display } from '@/ui/themes/Display';
import { growthSummary } from '@/ui/themes/summaries';

// "Not now" on the sex question is remembered on this device, per baby.
const DISMISS_EVENT = 'ls-sex-prompt';
const dismissKey = (babyId: string) => `ls-sex-prompt-dismissed:${babyId}`;
const subscribeDismissed = (onChange: () => void) => {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
};

/** Asked once, with the reason: percentile curves differ for boys and girls, and that is its only use. */
function SexPrompt({ baby }: { baby: BabyInHousehold }) {
  const toast = useToast();
  const refresh = useRefreshAll();
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    () => localStorage.getItem(dismissKey(baby.id)) === '1',
    () => true,
  );
  if (baby.sex || dismissed) return null;
  const owner = baby.role === 'owner';
  const save = async (sex: Sex) => {
    try {
      await api(`/api/babies/${baby.id}`, { method: 'PATCH', body: { name: baby.name, birthDate: baby.birthDate, sex, dueDate: baby.dueDate, correctedAge: baby.correctedAge } });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t save. Please try again.');
    }
  };
  return (
    <Alert severity="info" icon={false}>
      <Stack spacing={1.5}>
        <Typography>
          <strong>Want percentile curves?</strong> The WHO and CDC growth charts are different for boys and girls, so the app needs to know which chart to draw. That is the only thing it is used for.
        </Typography>
        {owner ? (
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" onClick={() => save('female')}>
              Girl&apos;s chart
            </Button>
            <Button variant="outlined" onClick={() => save('male')}>
              Boy&apos;s chart
            </Button>
            <Button
              onClick={() => {
                localStorage.setItem(dismissKey(baby.id), '1');
                window.dispatchEvent(new Event(DISMISS_EVENT));
              }}
            >
              Not now
            </Button>
          </Stack>
        ) : (
          <Typography>A household owner can set this in {baby.name}&apos;s profile.</Typography>
        )}
      </Stack>
    </Alert>
  );
}

export default function GrowthPage() {
  const { baby, canEdit, openAdd } = useApp();
  const toast = useToast();
  const { data: bundle, error, refetch } = useBabyBundle(baby?.id);
  const refresh = useRefreshBaby(baby?.id);
  const [measure, setMeasure] = useState<Measure>('weight');
  const [editing, setEditing] = useState<Measurement | null>(null);

  if (!baby) return <PageHeader title="Growth" />;
  if (!bundle) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;

  const points = growthSeries(baby, bundle.measurements, measure);
  const pointById = new Map(points.map((p) => [p.id, p]));
  const newestFirst = [...bundle.measurements].reverse();

  const remove = async (m: Measurement) => {
    setEditing(null);
    try {
      await api(`/api/measurements/${m.id}`, { method: 'DELETE' });
      await refresh();
      toast({
        message: 'Measurement deleted.',
        action: {
          label: 'Undo',
          run: () => {
            void api(`/api/measurements/${m.id}`, { method: 'PATCH', body: { restore: true } }).then(refresh, () => toast('Could not undo. It is still in Recently deleted.'));
          },
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t delete. Please try again.');
    }
  };

  return (
    <Stack spacing={2}>
      <PageHeader title="Growth" />
      <Tabs value={measure} onChange={(_, m: Measure) => setMeasure(m)} variant="fullWidth" aria-label="Measurement">
        {MEASURES.map((m) => (
          <Tab key={m} value={m} label={MEASURE_LABELS[m]} />
        ))}
      </Tabs>
      <SexPrompt baby={baby} />
      <Display
        chart
        title={`${MEASURE_LABELS[measure]} over time`}
        summary={growthSummary(baby, measure, points)}
        render={(t) => <t.Growth baby={baby} measure={measure} points={points} />}
        empty={
          points.length
            ? undefined
            : {
                text: `No ${MEASURE_LABELS[measure].toLowerCase()} measurements yet.`,
                action: canEdit ? (
                  <Button variant="outlined" onClick={() => openAdd('growth')}>
                    Add a measurement
                  </Button>
                ) : undefined,
              }
        }
      >
        {points.length > 0 && <Typography>{growthCaption(baby.name, measure, points, Boolean(baby.sex))}</Typography>}
      </Display>

      {newestFirst.length > 0 && (
        <Card component="section" aria-label="All measurements" sx={{ p: 1 }}>
          <Typography variant="h6" component="h2" sx={{ px: 1, pt: 1 }}>
            All measurements
          </Typography>
          <List disablePadding>
            {newestFirst.map((m) => {
              const p = pointById.get(m.id);
              const values = MEASURES.flatMap((k) => {
                const v = measureValue(m, k);
                return v == null ? [] : [formatMeasure(k, v)];
              }).join(' · ');
              const body = (
                <Stack spacing={0.25}>
                  <Typography sx={{ fontWeight: 700 }}>{values}</Typography>
                  <Typography color="text.secondary">
                    {[formatDate(m.date), ageAt(baby, m.date), p?.percentile != null ? `${formatPercentile(p.percentile)} percentile for ${MEASURE_LABELS[measure].toLowerCase()}` : null].filter(Boolean).join(' · ')}
                  </Typography>
                  {m.note && <Typography color="text.secondary">{m.note}</Typography>}
                </Stack>
              );
              return canEdit ? (
                <li key={m.id}>
                  <ListItemButton onClick={() => setEditing(m)} sx={{ borderRadius: 4 }} aria-label={`Edit measurement from ${formatDate(m.date)}`}>
                    {body}
                  </ListItemButton>
                </li>
              ) : (
                <ListItem key={m.id}>{body}</ListItem>
              );
            })}
          </List>
        </Card>
      )}

      <Typography variant="caption" color="text.secondary">
        Curves are the WHO growth standards up to age 2 and the CDC growth charts from 2, at the 3rd, 15th, 50th, 85th and 97th percentiles. A percentile describes size compared with other children; it is not a score. For questions about {baby.name}&apos;s growth, talk
        with your pediatrician.
      </Typography>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit measurement">
        {editing && (
          <MeasurementForm
            key={editing.id}
            baby={baby}
            measurement={editing}
            others={bundle.measurements}
            onCancel={() => setEditing(null)}
            onDelete={() => remove(editing)}
            onSaved={() => {
              setEditing(null);
              void refresh();
              toast('Measurement saved.');
            }}
          />
        )}
      </Sheet>
    </Stack>
  );
}
