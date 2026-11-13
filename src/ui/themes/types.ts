// The contract between the app and a display theme.
//
// A theme is a set of five "slots", one per kind of thing the app shows.
// Each slot is a component handed the same normalized data, so a new theme
// is five drawings and no new data code. Classic's slots double as the
// plain "Data" view that every other theme can flip to.

import type { ComponentType } from 'react';
import type { GrowthPoint } from '@/lib/growth/insights';
import type { Measure } from '@/lib/growth/percentiles';
import type { Baby, Entry, ThemeId } from '@/lib/types';

export interface GrowthSlotProps {
  baby: Baby;
  measure: Measure;
  /** Oldest first. */
  points: GrowthPoint[];
}

export interface EntriesSlotProps {
  baby: Baby;
  /** One kind only, oldest first, undated last. */
  entries: Entry[];
  /** On the home screen a slot gets less room: show the most recent few. */
  compact?: boolean;
}

export interface SiblingSeries {
  baby: Baby;
  points: GrowthPoint[];
}

export interface SiblingsSlotProps {
  measure: Measure;
  /** Two children; the first is drawn solid, the second dashed. */
  series: SiblingSeries[];
}

export interface DisplayTheme {
  id: ThemeId;
  name: string;
  description: string;
  Growth: ComponentType<GrowthSlotProps>;
  Foods: ComponentType<EntriesSlotProps>;
  Words: ComponentType<EntriesSlotProps>;
  Firsts: ComponentType<EntriesSlotProps>;
  Siblings: ComponentType<SiblingsSlotProps>;
}
