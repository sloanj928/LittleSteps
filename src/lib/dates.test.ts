import { describe, expect, it } from 'vitest';
import { addMonths, ageOrigin, formatAge, formatEntryDate, isIsoDate, monthsAndDays, seasonDate } from './dates';

describe('date-only arithmetic', () => {
  it('validates real calendar days only', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('2024-13-01')).toBe(false);
  });

  it('clamps month addition to the month end', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-11-15', 3)).toBe('2026-02-15');
  });

  it('counts months and leftover days', () => {
    expect(monthsAndDays('2025-01-31', '2025-03-01')).toEqual({ months: 1, days: 1 });
    expect(monthsAndDays('2025-03-10', '2025-10-12')).toEqual({ months: 7, days: 2 });
  });
});

describe('formatAge', () => {
  it('reads like a parent would say it', () => {
    expect(formatAge('2025-03-10', '2025-03-10')).toBe('Day one');
    expect(formatAge('2025-03-10', '2025-03-22')).toBe('12 days');
    expect(formatAge('2025-03-10', '2025-10-12')).toBe('7 months, 2 days');
    expect(formatAge('2025-03-10', '2025-04-10')).toBe('1 month');
    expect(formatAge('2023-01-05', '2025-04-20')).toBe('2 years, 3 months');
  });

  it('is approximate for approximate dates and silent for unknown ones', () => {
    expect(formatAge('2025-03-10', '2025-10-01', 'month')).toBe('about 6 months');
    expect(formatAge('2025-03-10', '2025-10-01', 'unknown')).toBeNull();
  });
});

describe('corrected age', () => {
  const preemie = { birthDate: '2025-01-01', dueDate: '2025-03-01', correctedAge: true };
  it('counts from the due date until two years', () => {
    expect(ageOrigin(preemie, '2025-06-01')).toBe('2025-03-01');
    expect(ageOrigin(preemie, '2027-01-02')).toBe('2025-01-01');
  });
  it('is ignored when switched off or without a due date', () => {
    expect(ageOrigin({ ...preemie, correctedAge: false }, '2025-06-01')).toBe('2025-01-01');
    expect(ageOrigin({ ...preemie, dueDate: null }, '2025-06-01')).toBe('2025-01-01');
  });
});

describe('approximate dates', () => {
  it('display at their own precision', () => {
    expect(formatEntryDate('2026-04-01', 'season')).toBe('Spring 2026');
    expect(formatEntryDate('2026-03-01', 'month')).toBe('March 2026');
    expect(formatEntryDate(null, 'unknown')).toBe('Date not remembered');
    expect(formatEntryDate('2026-03-04', 'day')).toBe('Mar 4, 2026');
  });
  it('sort a season between its months', () => {
    expect(seasonDate(2026, 'spring') > '2026-03-31').toBe(true);
    expect(seasonDate(2026, 'spring') < '2026-05-01').toBe(true);
  });
});
