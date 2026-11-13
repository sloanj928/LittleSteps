import { describe, expect, it } from 'vitest';
import fixtures from './reference.fixtures.json';
import { curveValue, formatPercentile, fromMetric, normalCdf, normalQuantile, percentileOf, toMetric, type Measure, type Sex } from './percentiles';

// Each fixture is a published 5th/50th/95th value from the WHO or CDC CSV.
// The LMS math must land on it: a wrong formula, a swapped L sign or a
// unit slip would put parents on the wrong curve.
describe('LMS percentiles match the published tables', () => {
  for (const f of fixtures as { source: string; sex: Sex; measure: Measure; ageMonths: number; p5: number; p50: number; p95: number }[]) {
    it(`${f.source} ${f.sex} ${f.measure} at ${f.ageMonths} mo`, () => {
      for (const [p, metric] of [[5, f.p5], [50, f.p50], [95, f.p95]] as const) {
        const imperial = fromMetric(f.measure, metric);
        expect(curveValue(f.sex, f.measure, f.ageMonths, p)).toBeCloseTo(imperial, 2);
        expect(percentileOf(f.sex, f.measure, f.ageMonths, imperial)!.percentile).toBeCloseTo(p, 1);
      }
    });
  }
});

describe('percentile helpers', () => {
  it('converts units both ways', () => {
    expect(toMetric('weight', 16)).toBeCloseTo(0.45359, 4);
    expect(toMetric('length', 10)).toBeCloseTo(25.4, 6);
    expect(fromMetric('weight', toMetric('weight', 123))).toBeCloseTo(123, 9);
  });

  it('normal CDF and quantile invert each other', () => {
    for (const p of [0.03, 0.15, 0.5, 0.85, 0.97, 0.001]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
  });

  it('switches from WHO to CDC at two years', () => {
    // Just below 24 months reads the WHO table; at 24 the CDC one. The medians
    // are close but not equal, which is how we know the switch happened.
    const who = curveValue('male', 'weight', 23.999, 50)!;
    const cdc = curveValue('male', 'weight', 24, 50)!;
    expect(Math.abs(who - cdc)).toBeGreaterThan(0.1);
    expect(Math.abs(who - cdc)).toBeLessThan(24);
  });

  it('has no reference outside the tables', () => {
    expect(percentileOf('female', 'head', 40, 19)).toBeNull();
    expect(percentileOf('female', 'weight', -1, 100)).toBeNull();
    expect(percentileOf('female', 'weight', 3, 0)).toBeNull();
  });

  it('formats percentiles without 0th or 100th', () => {
    expect(formatPercentile(0.2)).toBe('1st');
    expect(formatPercentile(99.9)).toBe('99th');
    expect(formatPercentile(12)).toBe('12th');
    expect(formatPercentile(22.4)).toBe('22nd');
    expect(formatPercentile(43)).toBe('43rd');
  });
});
