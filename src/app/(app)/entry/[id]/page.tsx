'use client';

import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatEntryDate } from '@/lib/dates';
import { FOOD_GROUP_LABELS } from '@/lib/foods';
import type { Entry } from '@/lib/types';
import { api } from '@/ui/api';
import { EntryForm } from '@/ui/app/EntryForm';
import { AllergyBadge } from '@/ui/app/EntryRow';
import { ageAt, authorOf, KINDS, REACTIONS } from '@/ui/app/kinds';
import { Sheet } from '@/ui/app/QuickAdd';
import { LoadError, Loading, PageHeader } from '@/ui/app/states';
import { useToast } from '@/ui/Providers';
import { useBabyBundle, useRefreshBaby } from '@/ui/queries';

interface HistoryRow {
  id: string;
  changedAt: string;
  changedBy: string;
  beforeJson: string;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const client = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ['entry', id], queryFn: () => api<{ entry: Entry; history: HistoryRow[] }>(`/api/entries/${id}`) });
  const { data: bundle } = useBabyBundle(data?.entry.babyId);
  const refreshBaby = useRefreshBaby(data?.entry.babyId);
  const [editing, setEditing] = useState(false);

  if (!data || !bundle) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;
  const { entry, history } = data;
  const { baby, people } = bundle;
  const canEdit = bundle.role !== 'viewer';
  const kind = KINDS[entry.kind];
  const reaction = entry.reaction ? REACTIONS[entry.reaction] : null;
  const age = ageAt(baby, entry.date, entry.datePrecision);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['entry', id] }), refreshBaby()]);

  const remove = async () => {
    try {
      await api(`/api/entries/${id}`, { method: 'DELETE' });
      await refreshBaby();
      toast({
        message: `${kind.label} deleted.`,
        action: {
          label: 'Undo',
          run: () => {
            void api(`/api/entries/${id}`, { method: 'PATCH', body: { restore: true } }).then(refreshBaby, () => toast('Could not undo. It is still in Recently deleted.'));
          },
        },
      });
      router.push('/timeline');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t delete. Please try again.');
    }
  };

  const revert = async (historyId: string) => {
    try {
      await api(`/api/entries/${id}`, { method: 'PATCH', body: { revertTo: historyId } });
      await refresh();
      toast('Earlier version restored.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t restore. Please try again.');
    }
  };

  return (
    <Stack spacing={2}>
      <PageHeader title={kind.label} back="/timeline" />
      <Card sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          {entry.kind !== 'note' && (
            <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
              {entry.title}
            </Typography>
          )}
          <Typography color="text.secondary">
            {[formatEntryDate(entry.date, entry.datePrecision), age ? `${baby.name} was ${age}` : null].filter(Boolean).join(' · ')}
          </Typography>
          {reaction && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <reaction.Icon />
              <Typography>{reaction.label}</Typography>
            </Stack>
          )}
          {entry.foodGroup && <Typography color="text.secondary">Food group: {FOOD_GROUP_LABELS[entry.foodGroup]}</Typography>}
          {entry.allergyFlag && <AllergyBadge />}
          {entry.note && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.note}</Typography>}
          <Divider />
          <Typography color="text.secondary">
            Added by {authorOf(people, entry.createdBy)} on {when(entry.createdAt)}
          </Typography>
          {canEdit && (
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button color="error" startIcon={<DeleteIcon />} onClick={remove}>
                Delete
              </Button>
            </Stack>
          )}
        </Stack>
      </Card>

      {history.length > 0 && (
        <Card component="section" aria-label="Edit history" sx={{ p: 2.5 }}>
          <Stack spacing={2} divider={<Divider />}>
            <Typography variant="h6" component="h2">
              Edit history
            </Typography>
            {history.map((h) => {
              const before = JSON.parse(h.beforeJson) as Pick<Entry, 'title' | 'date' | 'datePrecision' | 'note'>;
              return (
                <Stack key={h.id} spacing={0.5}>
                  <Typography color="text.secondary">
                    Changed by {h.changedBy} on {when(h.changedAt)}. Before that:
                  </Typography>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{before.title}</Typography>
                  <Typography color="text.secondary">{formatEntryDate(before.date, before.datePrecision)}</Typography>
                  {before.note && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{before.note}</Typography>}
                  {canEdit && (
                    <Button variant="outlined" sx={{ alignSelf: 'flex-start', mt: 1 }} onClick={() => revert(h.id)}>
                      Restore this version
                    </Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Card>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title={`Edit ${kind.label.toLowerCase()}`}>
        {editing && (
          <EntryForm
            baby={baby}
            kind={entry.kind}
            entry={entry}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void refresh();
              toast('Saved.');
            }}
          />
        )}
      </Sheet>
    </Stack>
  );
}
