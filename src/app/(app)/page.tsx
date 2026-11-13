'use client';

import CompareIcon from '@mui/icons-material/CompareArrows';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { ageInMonths, ageOrigin, formatAge, localToday } from '@/lib/dates';
import { formatWeight, growthSeries } from '@/lib/growth/insights';
import { pickNudge } from '@/lib/milestones';
import type { BabyBundle } from '@/lib/types';
import { api } from '@/ui/api';
import { useApp, type BabyInHousehold } from '@/ui/app/AppShell';
import { LoadError, Loading } from '@/ui/app/states';
import { useEntriesByKind } from '@/ui/app/useBabyData';
import { useToast, useTokens } from '@/ui/Providers';
import { useBabyBundle, useRefreshBaby } from '@/ui/queries';
import { Display } from '@/ui/themes/Display';
import { firstsSummary, foodsByGroup, foodsSummary, growthSummary, wordsSummary } from '@/ui/themes/summaries';

function Tile({ value, label, href }: { value: string; label: string; href: string }) {
  const { ls } = useTokens();
  return (
    <ButtonBase component={Link} href={href} sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2, borderRadius: 5, bgcolor: ls.surfaceContainer, fontFamily: 'inherit', textAlign: 'left', minHeight: 88 }}>
      <Typography variant="h5" component="span" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
      <Typography color="text.secondary">{label}</Typography>
    </ButtonBase>
  );
}

/** "Coming up": at most one gentle question about a first that many babies reach around this age. */
function Nudge({ baby, bundle, loggedKeys }: { baby: BabyInHousehold; bundle: BabyBundle; loggedKeys: ReadonlySet<string> }) {
  const { me, canEdit, openAdd } = useApp();
  const { ls } = useTokens();
  const toast = useToast();
  const refresh = useRefreshBaby(baby.id);
  const today = localToday();
  const nudge = pickNudge({ ageMonths: ageInMonths(ageOrigin(baby, today), today), loggedKeys, statuses: bundle.statuses, enabled: me.user.nudgesEnabled, today });
  // Answering is an edit, so view-only members aren't asked.
  if (!nudge || !canEdit) return null;

  const answer = async (action: 'not_yet' | 'snooze' | 'hide', done: string) => {
    try {
      await api(`/api/babies/${baby.id}/milestones/${nudge.key}`, { method: 'PUT', body: { action, today } });
      await refresh();
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That didn’t save. Please try again.');
    }
  };

  return (
    <Card component="section" aria-label="Coming up" sx={{ p: 2, bgcolor: ls.tertiaryContainer, color: ls.onTertiaryContainer }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" component="h2">
          Coming up
        </Typography>
        <Typography variant="h6" component="p">
          Has {baby.name} {nudge.ask}?
        </Typography>
        <Typography>Many babies do around this age, and plenty take their time. There&apos;s no deadline.</Typography>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" onClick={() => openAdd('first', nudge.key)}>
            Yes, save it
          </Button>
          <Button variant="outlined" color="inherit" onClick={() => answer('not_yet', 'No rush. We’ll ask again in a couple of weeks.')}>
            Not yet
          </Button>
          <Button color="inherit" onClick={() => answer('snooze', 'Snoozed for a week.')}>
            Snooze
          </Button>
          <Button color="inherit" onClick={() => answer('hide', 'We won’t ask about this one again.')}>
            Don&apos;t show again
          </Button>
        </Stack>
        <Typography variant="caption">Every baby is different. This is a reminder to save a memory, not medical advice.</Typography>
      </Stack>
    </Card>
  );
}

export default function HomePage() {
  const { baby, babies, household, canEdit, selectBaby, openAdd } = useApp();
  const { data: bundle, error, refetch } = useBabyBundle(baby?.id);
  const { firsts, foods, words, loggedKeys } = useEntriesByKind(bundle);
  const { ls } = useTokens();

  if (!baby) {
    const owner = household?.role === 'owner';
    return (
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 8 }}>
        <Typography variant="h5" component="h1">
          {household?.name ?? 'Welcome'}
        </Typography>
        <Typography color="text.secondary">{owner ? 'Add your baby to start saving firsts, foods, words and growth.' : 'No baby has been added to this household yet. An owner can add one.'}</Typography>
        {owner && (
          <Button variant="contained" component={Link} href="/baby/new">
            Add a baby
          </Button>
        )}
      </Stack>
    );
  }
  if (!bundle) return error ? <LoadError error={error} onRetry={refetch} /> : <Loading />;

  const today = localToday();
  const origin = ageOrigin(baby, today);
  const weights = growthSeries(baby, bundle.measurements, 'weight');
  const lastWeight = weights[weights.length - 1];
  const foodCount = Object.values(foodsByGroup(foods)).reduce((a, b) => a + b, 0);
  const add = (label: string, kind: Parameters<typeof openAdd>[0]) =>
    canEdit ? (
      <Button variant="outlined" onClick={() => openAdd(kind)}>
        {label}
      </Button>
    ) : undefined;

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          {baby.name}
        </Typography>
        <Typography color="text.secondary">
          {formatAge(baby.birthDate, today)}
          {origin !== baby.birthDate && ` · ${formatAge(origin, today)} corrected`}
        </Typography>
        {babies.length > 1 && (
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, rowGap: 1.5, pt: 1, alignItems: 'center' }} role="group" aria-label="Choose a baby">
            {babies.map((b) => {
              const selected = b.id === baby.id;
              return (
                <Chip
                  key={b.id}
                  label={b.name}
                  clickable
                  aria-pressed={selected}
                  variant={selected ? 'filled' : 'outlined'}
                  sx={selected ? { bgcolor: ls.secondaryContainer, color: ls.onSecondaryContainer, fontWeight: 800, '&:hover': { bgcolor: ls.secondaryContainer } } : undefined}
                  onClick={() => selectBaby(b.id)}
                />
              );
            })}
            <Button component={Link} href="/compare" size="small" startIcon={<CompareIcon />} sx={{ ml: 'auto' }}>
              Compare
            </Button>
          </Stack>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
        <Tile value={String(firsts.length)} label={firsts.length === 1 ? 'first' : 'firsts'} href="/timeline" />
        <Tile value={String(foodCount)} label={foodCount === 1 ? 'food tried' : 'foods tried'} href="/timeline" />
        <Tile value={String(words.length)} label={words.length === 1 ? 'word' : 'words'} href="/timeline" />
        <Tile value={lastWeight ? formatWeight(lastWeight.value) : 'Not yet'} label="latest weight" href="/growth" />
      </Box>

      <Nudge baby={baby} bundle={bundle} loggedKeys={loggedKeys} />

      <Display
        title="Firsts"
        summary={firstsSummary(baby, firsts)}
        render={(t) => <t.Firsts baby={baby} entries={firsts} compact />}
        empty={firsts.length ? undefined : { text: `${baby.name}'s firsts will collect here.`, action: add('Add a first', 'first') }}
      />
      <Display
        chart
        title="Growth"
        summary={growthSummary(baby, 'weight', weights)}
        render={(t) => <t.Growth baby={baby} measure="weight" points={weights} />}
        empty={weights.length ? undefined : { text: 'Add a weight to start the growth chart.', action: add('Add a measurement', 'growth') }}
        header={
          <Button component={Link} href="/growth" size="small">
            Open
          </Button>
        }
      />
      <Display
        title="Foods"
        summary={foodsSummary(baby, foods)}
        render={(t) => <t.Foods baby={baby} entries={foods} compact />}
        empty={foods.length ? undefined : { text: 'Foods tried, and how they went, will collect here.', action: add('Add a food', 'food') }}
      />
      <Display
        title="Words"
        summary={wordsSummary(baby, words)}
        render={(t) => <t.Words baby={baby} entries={words} compact />}
        empty={words.length ? undefined : { text: 'New words will collect here.', action: add('Add a word', 'word') }}
      />
    </Stack>
  );
}
