'use client';

import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { formatEntryDate } from '@/lib/dates';
import type { Baby, Entry } from '@/lib/types';
import { useTokens } from '../Providers';
import { ageAt, KINDS, REACTIONS } from './kinds';

/** The words-and-icon badge for a flagged food. Never colour alone. */
export function AllergyBadge() {
  const { ls } = useTokens();
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', alignSelf: 'flex-start', px: 1, py: 0.25, borderRadius: 2, bgcolor: ls.cautionContainer, color: ls.onCautionContainer }}>
      <WarningIcon fontSize="small" />
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        Possible allergy
      </Typography>
    </Stack>
  );
}

/** One entry in a list: what it was, when, how old the baby was. Opens the entry. */
export function EntryRow({ baby, entry }: { baby: Baby; entry: Entry }) {
  const { ls } = useTokens();
  const { Icon } = KINDS[entry.kind];
  const reaction = entry.reaction ? REACTIONS[entry.reaction] : null;
  const age = ageAt(baby, entry.date, entry.datePrecision);
  return (
    <ListItemButton component={Link} href={`/entry/${entry.id}`} sx={{ borderRadius: 4, gap: 2, px: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: ls.primaryContainer, color: ls.onPrimaryContainer, flexShrink: 0, mt: 0.25 }} aria-hidden>
        {reaction ? <reaction.Icon /> : <Icon />}
      </Box>
      <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.25}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          <span className="sr-only">{KINDS[entry.kind].label}: </span>
          {entry.title}
        </Typography>
        <Typography color="text.secondary">
          {[reaction?.label, formatEntryDate(entry.date, entry.datePrecision), age].filter(Boolean).join(' · ')}
        </Typography>
        {entry.allergyFlag && <AllergyBadge />}
      </Stack>
    </ListItemButton>
  );
}
