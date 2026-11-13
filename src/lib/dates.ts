// Date-only arithmetic. Every date a parent picks is a 'YYYY-MM-DD' string and
// is handled as a calendar day through Date.UTC, never as a local timestamp,
// so a baby born at 11:58 pm keeps their birthday in every time zone.

import type { DatePrecision } from '@/db/schema';

export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parts(s: IsoDate): [number, number, number] {
  const m = ISO.exec(s);
  if (!m) throw new Error(`Not a date: ${s}`);
  return [+m[1], +m[2], +m[3]];
}

function toUtc(s: IsoDate): number {
  const [y, m, d] = parts(s);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The viewer's own calendar day. Only the browser knows it, so callers on the client pass it on. */
export function localToday(now = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Calendar months, clamped to the month's last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Whole calendar months and leftover days from `from` to `to` (to >= from). */
export function monthsAndDays(from: IsoDate, to: IsoDate): { months: number; days: number } {
  const [y1, m1] = parts(from);
  const [y2, m2] = parts(to);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (addMonths(from, months) > to) months -= 1;
  return { months, days: daysBetween(addMonths(from, months), to) };
}

/** Average month length, as the WHO and CDC tables define age in months. */
export const DAYS_PER_MONTH = 30.4375;

export function ageInMonths(birth: IsoDate, on: IsoDate): number {
  return daysBetween(birth, on) / DAYS_PER_MONTH;
}

export interface AgeBasis {
  birthDate: IsoDate;
  dueDate: IsoDate | null;
  correctedAge: boolean;
}

/** Corrected age stops at two years: by then most preemies have caught up and charts no longer adjust. */
export const CORRECTED_AGE_UNTIL_MONTHS = 24;

/**
 * The date age is counted from. With corrected age on, that is the due date,
 * until the baby is two by the calendar.
 */
export function ageOrigin(basis: AgeBasis, on: IsoDate): IsoDate {
  if (!basis.correctedAge || !basis.dueDate || basis.dueDate <= basis.birthDate) return basis.birthDate;
  return ageInMonths(basis.birthDate, on) < CORRECTED_AGE_UNTIL_MONTHS ? basis.dueDate : basis.birthDate;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "7 months, 2 days", "2 years, 3 months", "12 days". Approximate dates get
 * "about" and no days, since the days would be invented.
 */
export function formatAge(origin: IsoDate, on: IsoDate, precision: DatePrecision = 'day'): string | null {
  if (precision === 'unknown') return null;
  const days = daysBetween(origin, on);
  if (days < 0) {
    // Only reachable with corrected age (before the due date) or a mistyped date.
    return precision === 'day' ? `${plural(-days, 'day')} before due date` : null;
  }
  const { months, days: rest } = monthsAndDays(origin, on);
  const about = precision === 'day' ? '' : 'about ';
  if (months === 0) {
    if (precision !== 'day') return 'about newborn';
    return days === 0 ? 'Day one' : plural(days, 'day');
  }
  if (months < 24) {
    if (precision !== 'day' || rest === 0) return `${about}${plural(months, 'month')}`;
    return `${plural(months, 'month')}, ${plural(rest, 'day')}`;
  }
  const years = Math.floor(months / 12);
  const mo = months % 12;
  return `${about}${plural(years, 'year')}${mo ? `, ${plural(mo, 'month')}` : ''}`;
}

// --- Approximate dates -------------------------------------------------------

export const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
export type Season = (typeof SEASONS)[number];
// Each season is filed under the first day of its middle month, so "Spring
// 2026" sorts between March and May entries rather than at either end.
const SEASON_MONTH: Record<Season, number> = { winter: 1, spring: 4, summer: 7, autumn: 10 };

export function seasonDate(year: number, season: Season): IsoDate {
  return `${year}-${String(SEASON_MONTH[season]).padStart(2, '0')}-01`;
}

export function monthDate(year: number, month: number): IsoDate {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function seasonOf(date: IsoDate): Season {
  const m = parts(date)[1];
  return (Object.entries(SEASON_MONTH).find(([, mo]) => mo === m)?.[0] as Season) ?? 'winter';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(date: IsoDate): string {
  const [y, m, d] = parts(date);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export function formatEntryDate(date: IsoDate | null, precision: DatePrecision): string {
  if (!date || precision === 'unknown') return 'Date not remembered';
  const [y, m] = parts(date);
  if (precision === 'month') return `${MONTHS[m - 1]} ${y}`;
  if (precision === 'season') {
    const s = seasonOf(date);
    return `${s[0].toUpperCase()}${s.slice(1)} ${y}`;
  }
  return formatDate(date);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoPlus(ms: number, from = Date.now()): string {
  return new Date(from + ms).toISOString();
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
