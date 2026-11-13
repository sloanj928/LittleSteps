// What the app says about measurements: formatting, the chart series, calm
// captions, and "does this look like a typo?" checks. Nothing here blocks a
// save or gives advice; it describes, and points to the pediatrician.

import { ageInMonths, ageOrigin, formatDate } from '@/lib/dates';
import type { Baby, Measurement } from '@/lib/types';
import { formatPercentile, percentileOf, type Measure } from './percentiles';

export const MEASURES: readonly Measure[] = ['weight', 'length', 'head'];
export const MEASURE_LABELS: Record<Measure, string> = { weight: 'Weight', length: 'Length', head: 'Head' };

export function measureValue(m: Pick<Measurement, 'weightOz' | 'lengthIn' | 'headIn'>, measure: Measure): number | null {
  return measure === 'weight' ? m.weightOz : measure === 'length' ? m.lengthIn : m.headIn;
}

export function formatWeight(oz: number): string {
  let lb = Math.floor(oz / 16);
  let rest = Math.round((oz - lb * 16) * 10) / 10;
  // 15.96 oz rounds to 16.0: carry it, rather than print "7 lb 16 oz".
  if (rest >= 16) {
    lb += 1;
    rest = 0;
  }
  return rest === 0 ? `${lb} lb` : `${lb} lb ${rest} oz`;
}

export function formatMeasure(measure: Measure, value: number): string {
  return measure === 'weight' ? formatWeight(value) : `${Math.round(value * 100) / 100} in`;
}

export interface GrowthPoint {
  id: string;
  date: string;
  ageMonths: number;
  value: number;
  /** Null when sex is unset or the age is outside the reference tables. */
  percentile: number | null;
  z: number | null;
}

/** One measure's readings, oldest first, with age (corrected where it applies) and percentile. */
export function growthSeries(baby: Baby, measurements: readonly Measurement[], measure: Measure): GrowthPoint[] {
  const points: GrowthPoint[] = [];
  for (const m of measurements) {
    const value = measureValue(m, measure);
    if (value == null || m.deletedAt) continue;
    const age = ageInMonths(ageOrigin(baby, m.date), m.date);
    const p = baby.sex && age >= 0 ? percentileOf(baby.sex, measure, age, value) : null;
    points.push({ id: m.id, date: m.date, ageMonths: age, value, percentile: p?.percentile ?? null, z: p?.z ?? null });
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Percentile points a reading may drift between visits and still be called
// "steady". Crossing one of the charts' main curves is about 20 points near
// the middle, and that happens to plenty of healthy babies.
const STEADY_WITHIN = 12;

/** One calm sentence about the trend. Never alarming, never advice. */
export function growthCaption(name: string, measure: Measure, points: readonly GrowthPoint[], hasSex: boolean): string {
  const label = MEASURE_LABELS[measure].toLowerCase();
  if (points.length === 0) return `No ${label} measurements yet.`;
  const last = points[points.length - 1];
  if (!hasSex) return `Latest ${label}: ${formatMeasure(measure, last.value)}.`;
  if (last.percentile == null) return `Latest ${label}: ${formatMeasure(measure, last.value)}. The reference charts don't cover this age.`;
  const now = formatPercentile(last.percentile);
  const earlier = points.slice(0, -1).filter((p) => p.percentile != null).slice(-2);
  if (earlier.length === 0) return `One ${label} measurement so far, around the ${now} percentile.`;
  const change = last.percentile - earlier[0].percentile!;
  if (Math.abs(change) <= STEADY_WITHIN) return `Tracking steadily around the ${now} percentile.`;
  if (change > 0) return `Moving up through the curves, now around the ${now} percentile.`;
  return `Now around the ${now} percentile. Babies often settle onto a new curve; ${name}'s pediatrician can say what's typical.`;
}

export interface MeasurementInput {
  date: string;
  weightOz: number | null;
  lengthIn: number | null;
  headIn: number | null;
}

/**
 * Reasons a measurement might be a typo. The form shows them and lets the
 * parent save anyway: a real baby can be unusual, and a tracker that refuses
 * a true number is worse than one that double-checks.
 */
export function measurementWarnings(baby: Baby, input: MeasurementInput, others: readonly Measurement[], today: string): string[] {
  const out: string[] = [];
  if (input.date < baby.birthDate) out.push(`That date is before ${baby.name} was born.`);
  if (input.date > today) out.push('That date is in the future.');
  const live = others.filter((m) => !m.deletedAt);
  if (live.some((m) => m.date === input.date)) out.push(`There is already a measurement on ${formatDate(input.date)}.`);

  const age = ageInMonths(ageOrigin(baby, input.date), input.date);
  for (const measure of MEASURES) {
    const value = measureValue(input, measure);
    if (value == null) continue;
    const label = MEASURE_LABELS[measure].toLowerCase();
    const p = baby.sex && age >= 0 ? percentileOf(baby.sex, measure, age, value) : null;
    if (p && Math.abs(p.z) > 4) out.push(`${formatMeasure(measure, value)} is far from the usual range for this age. Is the ${label} typed correctly?`);

    const before = live.filter((m) => m.date < input.date && measureValue(m, measure) != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const prev = before ? measureValue(before, measure)! : null;
    if (prev == null) continue;
    if (measure === 'weight' && prev - value > 48) out.push(`That is ${formatWeight(prev - value)} less than the last weight (${formatWeight(prev)}).`);
    if (measure !== 'weight' && prev - value > 0.5) out.push(`That ${label} is smaller than the last one (${formatMeasure(measure, prev)}).`);
  }
  return out;
}
