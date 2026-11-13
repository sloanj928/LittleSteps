'use client';

import CheckIcon from '@mui/icons-material/Check';
import ChevronIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAge, localToday } from '@/lib/dates';
import { PALETTE_IDS, THEME_IDS } from '@/lib/types';
import { api, reloadAt } from '@/ui/api';
import { useApp } from '@/ui/app/AppShell';
import { PageHeader } from '@/ui/app/states';
import { useToast, useTokens } from '@/ui/Providers';
import { useSavePrefs } from '@/ui/queries';
import { PALETTES, tokens } from '@/ui/theme/palettes';
import { THEMES } from '@/ui/themes/Display';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title} sx={{ p: 1 }}>
      <Typography variant="subtitle2" component="h2" color="text.secondary" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Card>
  );
}

function NavRow({ href, primary, secondary }: { href: string; primary: string; secondary?: string }) {
  return (
    <li>
      <ListItemButton component={Link} href={href} sx={{ borderRadius: 4 }}>
        <ListItemText primary={primary} secondary={secondary} slotProps={{ primary: { sx: { fontWeight: 700 } } }} />
        <ChevronIcon aria-hidden />
      </ListItemButton>
    </li>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Stack component="label" direction="row" spacing={2} sx={{ alignItems: 'center', px: 2, py: 1, minHeight: 56, cursor: 'pointer' }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
        <Typography color="text.secondary">{hint}</Typography>
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Stack>
  );
}

export default function MorePage() {
  const { me } = useApp();
  const { ls } = useTokens();
  const toast = useToast();
  const prefs = useSavePrefs();
  const save = (change: Parameters<typeof prefs.mutate>[0]) => prefs.mutate(change, { onError: (e) => toast(e.message) });
  const today = localToday();
  const allBabies = me.households.flatMap((h) => h.babies);
  const canAddBaby = me.households.some((h) => h.role === 'owner');

  const signOut = async () => {
    try {
      await api('/api/auth/signout', { method: 'POST' });
      reloadAt('/signin');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not sign out. Please try again.');
    }
  };

  return (
    <Stack spacing={2}>
      <PageHeader title="More" />
      <Typography color="text.secondary">Signed in as {me.user.username}</Typography>

      <Section title="Babies">
        <List disablePadding>
          {allBabies.map((b) => (
            <NavRow key={b.id} href={`/baby/${b.id}`} primary={b.name} secondary={b.archivedAt ? 'Archived' : (formatAge(b.birthDate, today) ?? undefined)} />
          ))}
          {canAddBaby && <NavRow href="/baby/new" primary="Add a baby" />}
        </List>
      </Section>

      <Section title="Household">
        <List disablePadding>
          <NavRow href="/more/household" primary="Household and members" secondary="Members, invite codes, export" />
          <NavRow href="/more/deleted" primary="Recently deleted" secondary="Restore within 30 days" />
        </List>
      </Section>

      <Section title="Appearance">
        <Stack spacing={2} sx={{ px: 2, py: 1 }}>
          <Stack spacing={1} role="radiogroup" aria-label="Theme">
            {THEME_IDS.map((id) => {
              const selected = me.user.theme === id;
              return (
                <ButtonBase
                  key={id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => save({ theme: id })}
                  sx={{ justifyContent: 'flex-start', gap: 1.5, p: 1.5, minHeight: 64, borderRadius: 4, textAlign: 'left', fontFamily: 'inherit', border: 2, borderColor: selected ? ls.primary : ls.outlineVariant }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{THEMES[id].name}</Typography>
                    <Typography color="text.secondary">{THEMES[id].description}</Typography>
                  </Box>
                  {selected && <CheckIcon sx={{ color: ls.primary }} />}
                </ButtonBase>
              );
            })}
          </Stack>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5 }} role="radiogroup" aria-label="Colour palette">
            {PALETTE_IDS.map((id) => {
              const selected = me.user.palette === id;
              // A swatch shows its own palette's colour, whichever one is active.
              const swatch = tokens(id, 'light');
              return (
                <ButtonBase key={id} role="radio" aria-checked={selected} onClick={() => save({ palette: id })} sx={{ flexDirection: 'column', gap: 0.5, p: 0.5, minWidth: 56, borderRadius: 3, fontFamily: 'inherit' }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: swatch.primary, color: swatch.onPrimary, outline: selected ? `3px solid ${ls.onSurface}` : 'none', outlineOffset: 2 }}>
                    {selected && <CheckIcon />}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: selected ? 800 : 600 }}>
                    {PALETTES[id].name}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Stack>
        </Stack>
        <SwitchRow label="Open on the data view" hint="Show lists and charts first, with the pictures one tap away." checked={me.user.defaultDataView} onChange={(on) => save({ defaultDataView: on })} />
        <Typography color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
          Light and dark follow your device&apos;s setting.
        </Typography>
      </Section>

      <Section title="Reminders">
        <SwitchRow label="“Coming up” questions" hint="An occasional, gentle question on the home screen about a first many babies reach around this age." checked={me.user.nudgesEnabled} onChange={(on) => save({ nudgesEnabled: on })} />
      </Section>

      <Section title="Account">
        <List disablePadding>
          <NavRow href="/more/account" primary="Password, PIN and devices" />
          <NavRow href="/support" primary="Contact support" />
          {me.user.isAdmin && <NavRow href="/admin" primary="Admin console" />}
        </List>
        <Box sx={{ p: 1.5 }}>
          <Button variant="outlined" fullWidth onClick={signOut}>
            Sign out
          </Button>
        </Box>
      </Section>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        Little Steps is a keepsake, not a medical tool. For questions about your baby&apos;s health or development, talk with your pediatrician.
      </Typography>
    </Stack>
  );
}
