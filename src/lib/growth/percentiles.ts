// Growth percentiles from the WHO (under 2) and CDC (2 and over) LMS tables.
//
// The tables ship as static JSON (built by scripts/build-growth-reference.cjs
// from the published CSVs), so percentile math needs no database and no
// network. Measurements are stored imperial; they are converted to metric only
// here, for the lookup, and curve values are converted back for drawing.

import reference from './reference.json';

export type Sex = 'male' | 'female';
export type Measure = 'weight' | 'length' | 'head';
type Row = [age: number, L: number, M: number, S: number];
type Table = Record<Sex, Record<Measure, Row[]>>;

const REF = reference as { who: Table; cdc: Table };

/** WHO standards below two years, CDC charts from two, as the AAP and CDC recommend. */
export const WHO_UNTIL_MONTHS = 24;

export const OZ_PER_KG = 35.27396195;
export const CM_PER_IN = 2.54;

/** Imperial value as stored -> the metric value the tables use. */
export function toMetric(measure: Measure, value: number): number {
  return measure === 'weight' ? value / OZ_PER_KG : value * CM_PER_IN;
}

export function fromMetric(measure: Measure, value: number): number {
  return measure === 'weight' ? value * OZ_PER_KG : value / CM_PER_IN;
}

function rowsFor(sex: Sex, measure: Measure, ageMonths: number): Row[] {
  return ageMonths < WHO_UNTIL_MONTHS ? REF.who[sex][measure] : REF.cdc[sex][measure];
}

/** The oldest age each measure has a reference for (CDC head circumference stops at 36 months). */
export function referenceMaxMonths(measure: Measure): number {
  const rows = REF.cdc.male[measure];
  return rows[rows.length - 1][0];
}

/** L, M and S at an age, interpolated linearly between the table's rows; null outside the table. */
export function lmsAt(sex: Sex, measure: Measure, ageMonths: number): { L: number; M: number; S: number } | null {
  if (ageMonths < 0) return null;
  const rows = rowsFor(sex, measure, ageMonths);
  if (ageMonths < rows[0][0] || ageMonths > rows[rows.length - 1][0]) return null;
  const hi = rows.findIndex((r) => r[0] >= ageMonths);
  const up = rows[hi];
  if (up[0] === ageMonths || hi === 0) return { L: up[1], M: up[2], S: up[3] };
  const lo = rows[hi - 1];
  const t = (ageMonths - lo[0]) / (up[0] - lo[0]);
  return { L: lo[1] + (up[1] - lo[1]) * t, M: lo[2] + (up[2] - lo[2]) * t, S: lo[3] + (up[3] - lo[3]) * t };
}

export function zScore(x: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return Math.abs(L) < 1e-9 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
}

export function valueAtZ(z: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

// Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf; error < 1.5e-7, far
// below what a whole-number percentile can show).
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Inverse normal CDF (Acklam's rational approximation), for percentile curves. */
export function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export interface PercentileResult {
  z: number;
  /** 0-100, unrounded. */
  percentile: number;
}

/** Percentile of an imperial measurement at an age, or null where no reference applies. */
export function percentileOf(sex: Sex, measure: Measure, ageMonths: number, imperialValue: number): PercentileResult | null {
  if (!(imperialValue > 0)) return null;
  const lms = lmsAt(sex, measure, ageMonths);
  if (!lms) return null;
  const z = zScore(toMetric(measure, imperialValue), lms);
  return { z, percentile: normalCdf(z) * 100 };
}

/** Imperial value of a percentile curve at an age, or null outside the reference. */
export function curveValue(sex: Sex, measure: Measure, ageMonths: number, percentile: number): number | null {
  const lms = lmsAt(sex, measure, ageMonths);
  if (!lms) return null;
  return fromMetric(measure, valueAtZ(normalQuantile(percentile / 100), lms));
}

/** The curves every chart draws, as a soft band with the median marked. */
export const CHART_PERCENTILES = [3, 15, 50, 85, 97] as const;

export function curvePoints(sex: Sex, measure: Measure, fromMonths: number, toMonths: number, percentile: number, step = 0.5) {
  const out: { ageMonths: number; value: number }[] = [];
  for (let a = Math.max(0, fromMonths); a <= toMonths + 1e-9; a += step) {
    const v = curveValue(sex, measure, a, percentile);
    if (v != null) out.push({ ageMonths: a, value: v });
  }
  return out;
}

/** "about the 45th percentile": whole numbers, kept off 0 and 100, which would read as off the chart. */
export function formatPercentile(p: number): string {
  const n = Math.min(99, Math.max(1, Math.round(p)));
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}
