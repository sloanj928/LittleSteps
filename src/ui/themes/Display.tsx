'use client';

import PictureIcon from '@mui/icons-material/AutoAwesomeMosaicOutlined';
import DataIcon from '@mui/icons-material/FormatListBulleted';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import type { ThemeId } from '@/lib/types';
import { useApp } from '../app/AppShell';
import { classicTheme } from './classic';
import { gardenTheme } from './garden';
import { nurseryTheme } from './nursery';
import { oceanTheme } from './ocean';
import { spaceTheme } from './space';
import { storybookTheme } from './storybook';
import type { DisplayTheme } from './types';

export const THEMES: Record<ThemeId, DisplayTheme> = { classic: classicTheme, nursery: nurseryTheme, storybook: storybookTheme, garden: gardenTheme, ocean: oceanTheme, space: spaceTheme };

interface Props {
  title: string;
  /** The same facts in a sentence: read out in place of the drawing. */
  summary: string;
  /** Draws the slot from whichever theme is showing: `(t) => <t.Firsts ... />`. */
  render: (theme: DisplayTheme) => ReactNode;
  /** True for the slots Classic draws as a chart (growth, siblings) rather than a list. */
  chart?: boolean;
  /** Shown under an empty display, with the action if there is one. */
  empty?: { text: string; action?: ReactNode };
  /** Extra controls for the header, beside the Data toggle. */
  header?: ReactNode;
  /** A row of controls between the header and the display, such as which measure to show. */
  toolbar?: ReactNode;
  /** Shown under the display, in both views. */
  children?: ReactNode;
}

/**
 * One display card. It draws the user's theme for the slot, and offers a
 * one-tap switch to the plain Data view (Classic's version of the same
 * slot). Whether it opens on the picture or the data is a setting; the
 * switch on each card only lasts until the screen is left.
 */
export function Display({ title, summary, render, chart, empty, header, toolbar, children }: Props) {
  const { me } = useApp();
  const theme = THEMES[me.user.theme] ?? classicTheme;
  const illustrated = theme.id !== 'classic';
  const [asData, setAsData] = useState(me.user.defaultDataView);
  const active = illustrated && !asData ? theme : classicTheme;
  // Classic's lists are real, navigable content. Everything else is a
  // picture, and role="img" would hide a list's links from a screen reader.
  const drawn = active.id !== 'classic' || Boolean(chart);

  return (
    <Card component="section" aria-label={title} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minHeight: 48 }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {header}
          {illustrated && (
            <Button size="small" variant="outlined" aria-pressed={asData} onClick={() => setAsData((v) => !v)} startIcon={asData ? <PictureIcon /> : <DataIcon />} sx={{ px: 2 }}>
              {asData ? 'Picture' : 'Data'}
            </Button>
          )}
        </Stack>
        {toolbar}
        {drawn ? (
          // The drawing itself is aria-hidden; this sentence is what a screen reader hears for it.
          <Box role="img" aria-label={summary}>
            {render(active)}
          </Box>
        ) : (
          render(active)
        )}
        {empty && (
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', py: 1 }}>
            <Typography color="text.secondary">{empty.text}</Typography>
            {empty.action}
          </Stack>
        )}
        {children}
      </Stack>
    </Card>
  );
}
