// What each display says, in words. A drawing is announced to screen readers
// with these, so a jar of fruit and a list of fruit tell the same story.

import type { FoodGroup } from '@/db/schema';
import { formatEntryDate } from '@/lib/dates';
import { FOOD_GROUP_LABELS } from '@/lib/foods';
import { formatMeasure, growthCaption, MEASURE_LABELS, type GrowthPoint } from '@/lib/growth/insights';
import { formatPercentile, type Measure } from '@/lib/growth/percentiles';
import type { Baby, Entry } from '@/lib/types';
import type { SiblingSeries } from './types';

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function latest(entries: readonly Entry[]): Entry | undefined {
  return [...entries].reverse().find((e) => e.date) ?? entries[entries.length - 1];
}

export function firstsSummary(baby: Baby, firsts: readonly Entry[]): string {
  if (!firsts.length) return `No firsts saved for ${baby.name} yet.`;
  const last = latest(firsts)!;
  return `${count(firsts.length, 'first')} saved for ${baby.name}. Most recent: ${last.title}, ${formatEntryDate(last.date, last.datePrecision)}.`;
}

export function foodsByGroup(foods: readonly Entry[]): Record<FoodGroup, number> {
  const groups: Record<FoodGroup, number> = { fruit: 0, vegetable: 0, grain: 0, protein: 0, dairy: 0, other: 0 };
  // A food tried five times is still one food in the jar.
  const seen = new Set<string>();
  for (const f of foods) {
    const key = f.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    groups[f.foodGroup ?? 'other'] += 1;
  }
  return groups;
}

/**
 * Words by the letter they start with, accents folded so a Polish "Śmieci"
 * or "Żaba" files under S and Z; anything that isn't a letter goes under
 * "#". Also which letters have a word in `fresh`, for the bounce.
 */
export function wordsByLetter(words: readonly Entry[], fresh: ReadonlySet<string> = new Set()) {
  const counts = new Map<string, number>();
  const freshLetters = new Set<string>();
  for (const e of words) {
    const first = (e.title.trim()[0] ?? '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').replace('Ł', 'L');
    const letter = /^[A-Z]$/.test(first) ? first : '#';
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
    if (fresh.has(e.id)) freshLetters.add(letter);
  }
  return { counts, freshLetters };
}

export function foodsSummary(baby: Baby, foods: readonly Entry[]): string {
  if (!foods.length) return `No foods saved for ${baby.name} yet.`;
  const groups = foodsByGroup(foods);
  const total = Object.values(groups).reduce((a, b) => a + b, 0);
  const parts = (Object.keys(groups) as FoodGroup[]).filter((g) => groups[g]).map((g) => `${groups[g]} ${FOOD_GROUP_LABELS[g].toLowerCase()}`);
  const flagged = new Set(foods.filter((f) => f.allergyFlag).map((f) => f.title.trim().toLowerCase())).size;
  return `${baby.name} has tried ${count(total, 'food')}: ${parts.join(', ')}.${flagged ? ` ${count(flagged, 'food')} marked as a possible allergy.` : ''}`;
}

export function wordsSummary(baby: Baby, words: readonly Entry[]): string {
  if (!words.length) return `No words saved for ${baby.name} yet.`;
  return `${baby.name} says ${count(words.length, 'word')}. Latest: ${latest(words)!.title}.`;
}

export function growthSummary(baby: Baby, measure: Measure, points: readonly GrowthPoint[]): string {
  const caption = growthCaption(baby.name, measure, points, Boolean(baby.sex));
  if (!points.length) return caption;
  const last = points[points.length - 1];
  return `${MEASURE_LABELS[measure]} chart for ${baby.name}, ${count(points.length, 'measurement')}. Latest: ${formatMeasure(measure, last.value)}. ${caption}`;
}

export function siblingsSummary(measure: Measure, series: readonly SiblingSeries[]): string {
  const label = MEASURE_LABELS[measure].toLowerCase();
  const parts = series.map(({ baby, points }) => {
    if (!points.length) return `${baby.name} has no ${label} measurements`;
    const last = points[points.length - 1];
    const pct = last.percentile != null ? `, around the ${formatPercentile(last.percentile)} percentile` : '';
    return `${baby.name}: ${count(points.length, 'measurement')}, latest ${formatMeasure(measure, last.value)} at ${shortAge(last.ageMonths)}${pct}`;
  });
  return `${MEASURE_LABELS[measure]} by age. ${parts.join('. ')}.`;
}

/** "3 wk", "7 mo", "2 y 3 mo": an age small enough to pencil beside a mark. */
export function shortAge(ageMonths: number): string {
  if (ageMonths < 1) return `${Math.max(0, Math.round(ageMonths * 4.35))} wk`;
  const whole = Math.round(ageMonths);
  if (whole < 24) return `${whole} mo`;
  const rest = whole % 12;
  return rest ? `${Math.floor(whole / 12)} y ${rest} mo` : `${whole / 12} y`;
}
