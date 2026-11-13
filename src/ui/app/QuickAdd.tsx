'use client';

import BackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMemo, useState, type ReactNode } from 'react';
import type { EntryKind } from '@/db/schema';
import type { Baby } from '@/lib/types';
import { useToast, useTokens } from '../Providers';
import { useBabyBundle, useRefreshBaby } from '../queries';
import { EntryForm } from './EntryForm';
import { KINDS } from './kinds';
import { MeasurementForm } from './MeasurementForm';

export type AddKind = EntryKind | 'growth';

const ORDER: AddKind[] = ['first', 'food', 'word', 'growth', 'note'];
const HINT: Record<AddKind, string> = {
  first: 'A smile, a step, a haircut',
  food: 'What they tried, and how it went',
  word: 'Something new they said',
  growth: 'Weight, length or head',
  note: 'Anything worth remembering',
};

/** A sheet that rises from the bottom edge, where a thumb already is. */
export function Sheet({ open, onClose, title, onBack, children }: { open: boolean; onClose: () => void; title: string; onBack?: () => void; children: ReactNode }) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { borderRadius: '28px 28px 0 0', maxHeight: '92dvh', maxWidth: 640, mx: 'auto', pb: 'env(safe-area-inset-bottom)' }, 'aria-label': title, role: 'dialog' } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 1, pt: 1.5 }}>
        {onBack ? (
          <IconButton aria-label="Back" onClick={onBack}>
            <BackIcon />
          </IconButton>
        ) : (
          <Box sx={{ width: 48 }} />
        )}
        <Typography variant="h6" component="h2" sx={{ flex: 1, textAlign: 'center' }}>
          {title}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ px: 2.5, pt: 1.5, pb: 3, overflowY: 'auto' }}>{children}</Box>
    </Drawer>
  );
}

/** The floating button's sheet: choose what to add, then fill in one short form. */
export function QuickAdd({ baby, open, initialKind, initialMilestone, onClose }: { baby: Baby; open: boolean; initialKind?: AddKind; initialMilestone?: string; onClose: () => void }) {
  const { ls } = useTokens();
  const toast = useToast();
  const [picked, setPicked] = useState<AddKind | null>(null);
  const kind = picked ?? initialKind ?? null;
  const { data: bundle } = useBabyBundle(baby.id);
  const refresh = useRefreshBaby(baby.id);
  const loggedKeys = useMemo(() => new Set((bundle?.entries ?? []).flatMap((e) => (e.milestoneKey ? [e.milestoneKey] : []))), [bundle]);

  const close = () => {
    setPicked(null);
    onClose();
  };
  const saved = (what: string) => {
    void refresh();
    toast(`${what} saved for ${baby.name}.`);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={kind ? `Add a ${KINDS[kind].label.toLowerCase()}` : `Add for ${baby.name}`} onBack={kind && !initialKind ? () => setPicked(null) : undefined}>
      {!kind && (
        <Stack spacing={1}>
          {ORDER.map((k) => {
            const { label, Icon } = KINDS[k];
            return (
              <ButtonBase
                key={k}
                onClick={() => setPicked(k)}
                sx={{ justifyContent: 'flex-start', gap: 2, p: 1.5, minHeight: 64, borderRadius: 4, bgcolor: ls.surfaceContainer, textAlign: 'left', fontFamily: 'inherit' }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: ls.primaryContainer, color: ls.onPrimaryContainer, flexShrink: 0 }}>
                  <Icon />
                </Box>
                <Box>
                  <Typography variant="subtitle1">{label}</Typography>
                  <Typography color="text.secondary">{HINT[k]}</Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
      )}
      {kind === 'growth' && <MeasurementForm baby={baby} others={bundle?.measurements ?? []} onSaved={() => saved('Measurement')} onCancel={close} />}
      {kind && kind !== 'growth' && <EntryForm key={`${kind}:${initialMilestone ?? ''}`} baby={baby} kind={kind} loggedKeys={loggedKeys} initialMilestone={initialMilestone} onSaved={(e) => saved(e.kind === 'note' ? 'Note' : e.title)} onCancel={close} />}
    </Sheet>
  );
}
