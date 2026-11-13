import { describe, expect, it } from 'vitest';
import { guessFoodGroup } from './foods';
import { formatWeight, growthCaption, growthSeries, measurementWarnings, type GrowthPoint } from './growth/insights';
import { curveValue } from './growth/percentiles';
import { loggedMilestones, pickNudge, type NudgeStatus } from './milestones';
import type { Baby, Measurement } from './types';

const baby: Baby = { id: 'b', householdId: 'h', name: 'June', birthDate: '2026-01-01', sex: 'female', dueDate: null, correctedAge: false, createdAt: '', archivedAt: null };
const NOW = Date.parse('2026-11-12T12:00:00Z');
const nudge = (ageMonths: number, statuses: NudgeStatus[] = [], logged: string[] = []) => pickNudge({ ageMonths, loggedKeys: new Set(logged), statuses, enabled: true, today: '2026-11-12', now: NOW });

describe('nudges', () => {
  it('waits until a window opens, and never asks before it', () => {
    expect(nudge(0.5)).toBeNull();
    expect(nudge(1.2)?.key).toBe('first_smile');
  });

  it('skips what is logged, hidden or still snoozed, and returns once a snooze ends', () => {
    expect(nudge(1.5, [], ['first_smile'])).toBeNull();
    const old = '2026-10-01T00:00:00Z';
    expect(nudge(1.5, [{ milestoneKey: 'first_smile', status: 'hidden', snoozedUntil: null, updatedAt: old }])).toBeNull();
    expect(nudge(1.5, [{ milestoneKey: 'first_smile', status: 'snoozed', snoozedUntil: '2026-11-20', updatedAt: old }])).toBeNull();
    expect(nudge(1.5, [{ milestoneKey: 'first_smile', status: 'snoozed', snoozedUntil: '2026-11-12', updatedAt: old }])?.key).toBe('first_smile');
  });

  it('counts a logged food as solids started, and a logged word as a first word', () => {
    const keys = loggedMilestones([{ kind: 'food', milestoneKey: null }]);
    expect(keys.has('first_solid_food')).toBe(true);
    expect(pickNudge({ ageMonths: 5, loggedKeys: keys, statuses: [], enabled: true, today: '2026-11-12', now: NOW })?.key).not.toBe('first_solid_food');
    expect(loggedMilestones([{ kind: 'word', milestoneKey: null }]).has('first_word')).toBe(true);
  });

  it('stays quiet for a day after any answer, and when switched off', () => {
    expect(nudge(1.5, [{ milestoneKey: 'first_laugh', status: 'not_yet', snoozedUntil: '2026-12-01', updatedAt: '2026-11-12T08:00:00Z' }])).toBeNull();
    expect(pickNudge({ ageMonths: 1.5, loggedKeys: new Set(), statuses: [], enabled: false, today: '2026-11-12' })).toBeNull();
  });

  it('stops asking a few months after a window closes, and never asks about firsts without one', () => {
    expect(nudge(7)?.key).not.toBe('first_smile');
    expect(nudge(40)).toBeNull();
  });
});

describe('food groups', () => {
  it('guesses from the name, plurals and descriptions included', () => {
    expect(guessFoodGroup('Banana')).toBe('fruit');
    expect(guessFoodGroup('mashed bananas')).toBe('fruit');
    expect(guessFoodGroup('Sweet potato')).toBe('vegetable');
    expect(guessFoodGroup('Greek yogurt')).toBe('dairy');
    expect(guessFoodGroup('Moussaka')).toBe('other');
    // A listed mixed dish stays in "other" rather than being filed by its last word.
    expect(guessFoodGroup('Fried rice')).toBe('other');
    expect(guessFoodGroup('Paneer')).toBe('dairy');
    expect(guessFoodGroup('Plantain')).toBe('fruit');
  });
});

describe('growth', () => {
  const m = (date: string, weightOz: number | null, extra: Partial<Measurement> = {}): Measurement => ({ id: date, babyId: 'b', date, weightOz, lengthIn: null, headIn: null, note: null, createdBy: 'u', createdAt: '', updatedAt: '', deletedAt: null, ...extra });

  it('writes weights as pounds and ounces without a 16-ounce remainder', () => {
    expect(formatWeight(120)).toBe('7 lb 8 oz');
    expect(formatWeight(127.97)).toBe('8 lb');
  });

  it('uses corrected age for a preemie', () => {
    const preemie = { ...baby, dueDate: '2026-03-01', correctedAge: true };
    const [point] = growthSeries(preemie, [m('2026-05-01', 160)], 'weight');
    expect(point.ageMonths).toBeCloseTo(61 / 30.4375, 3);
  });

  it('describes a steady trend calmly, and a drop without alarm', () => {
    const pt = (percentile: number): GrowthPoint => ({ id: String(percentile), date: '', ageMonths: 3, value: 200, percentile, z: 0 });
    expect(growthCaption('June', 'weight', [pt(48), pt(50), pt(52)], true)).toMatch(/steadily around the 52nd/);
    const drop = growthCaption('June', 'weight', [pt(70), pt(60), pt(30)], true);
    expect(drop).toMatch(/30th/);
    expect(drop).not.toMatch(/concern|warning|low|worr/i);
  });

  it('double-checks unlikely numbers instead of refusing them', () => {
    const median = curveValue('female', 'weight', 4, 50)!;
    const ok = measurementWarnings(baby, { date: '2026-05-01', weightOz: median, lengthIn: null, headIn: null }, [m('2026-04-01', median - 20)], '2026-11-12');
    expect(ok).toEqual([]);
    const typo = measurementWarnings(baby, { date: '2026-05-01', weightOz: median * 3, lengthIn: null, headIn: null }, [], '2026-11-12');
    expect(typo.join(' ')).toMatch(/usual range/);
    const drop = measurementWarnings(baby, { date: '2026-05-01', weightOz: 100, lengthIn: null, headIn: null }, [m('2026-04-01', 200)], '2026-11-12');
    expect(drop.join(' ')).toMatch(/less than the last weight/);
    const dup = measurementWarnings(baby, { date: '2026-04-01', weightOz: 200, lengthIn: null, headIn: null }, [m('2026-04-01', 200)], '2026-11-12');
    expect(dup.join(' ')).toMatch(/already a measurement/);
  });
});
