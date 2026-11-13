'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DAY, formatDate, formatEntryDate } from '@/lib/dates';
import { formatMeasure, MEASURES, measureValue } from '@/lib/growth/insights';
import type { Entry, Measurement } from '@/lib/types';
import { api } from '@/ui/api';
import { useApp } from '@/ui/app/AppShell';
import { Block } from '@/ui/app/JoinOrCreate';
import { KINDS } from '@/ui/app/kinds';
import { LoadError, Loading, PageHeader } from '@/ui/app/states';
import { useToast } from '@/ui/Providers';
import { useRefreshBaby } from '@/ui/queries';

const RECOVERY_DAYS = 30;

function daysLeft(deletedAt: string): string {
  const left = Math.max(0, Math.ceil(RECOVERY_DAYS - (Date.now() - Date.parse(deletedAt)) / DAY));
  return left <= 1 ? 'Erased within a day' : `Erased in ${left} days`;
}

export default function DeletedPage() {
  const { baby, canEdit } = useApp();
  const toast = useToast();
  const client = useQueryClient();
  const refreshBaby = useRefreshBaby(baby?.id);
  const key = ['deleted', baby?.id];
  const { data, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api<{ entries: Entry[]; measurements: Measurement[] }>(`/api/babies/${baby!.id}/deleted`),
    enabled: Boolean(baby) && canEdit,
  });

  const restore = async (path: string) => {
    try {
      await api(path, { method: 'PATCH', body: { restore: true } });
      await Promise.all([client.invalidateQueries({ queryKey: key }), refreshBaby()]);
      toast('Restored.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t restore. Please try again.');
    }
  };

  const header = <PageHeader title="Recently deleted" back="/more" />;
  if (!baby || !canEdit) {
    return (
      <Stack spacing={2}>
        {header}
        <Alert severity="info">{baby ? 'Only people who can edit can restore deleted entries.' : 'There is nothing here yet.'}</Alert>
      </Stack>
    );
  }
  if (!data) {
    return (
      <Stack spacing={2}>
        {header}
        {error ? <LoadError error={error} onRetry={refetch} /> : <Loading />}
      </Stack>
    );
  }
  const empty = data.entries.length + data.measurements.length === 0;

  return (
    <Stack spacing={2}>
      {header}
      <Typography color="text.secondary">
        Deleted entries for {baby.name} stay here for {RECOVERY_DAYS} days, then are erased for good.
      </Typography>
      {empty ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
          Nothing has been deleted recently.
        </Typography>
      ) : (
        <Block title={`Deleted for ${baby.name}`}>
          <Stack spacing={2} divider={<Divider />}>
            {data.entries.map((e) => (
              <Stack key={e.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {KINDS[e.kind].label}: {e.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {formatEntryDate(e.date, e.datePrecision)} · {daysLeft(e.deletedAt!)}
                  </Typography>
                </Stack>
                <Button onClick={() => restore(`/api/entries/${e.id}`)}>Restore</Button>
              </Stack>
            ))}
            {data.measurements.map((m) => (
              <Stack key={m.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Stack sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    Measurement:{' '}
                    {MEASURES.flatMap((k) => {
                      const v = measureValue(m, k);
                      return v == null ? [] : [formatMeasure(k, v)];
                    }).join(' · ')}
                  </Typography>
                  <Typography color="text.secondary">
                    {formatDate(m.date)} · {daysLeft(m.deletedAt!)}
                  </Typography>
                </Stack>
                <Button onClick={() => restore(`/api/measurements/${m.id}`)}>Restore</Button>
              </Stack>
            ))}
          </Stack>
        </Block>
      )}
    </Stack>
  );
}
