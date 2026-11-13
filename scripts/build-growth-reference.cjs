// Converts the WHO (0-24 mo) and CDC (24+ mo) LMS CSVs into one compact JSON.
const fs = require('fs'), path = require('path');
const [dir, out, fixtures] = process.argv.slice(2);
const rows = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
const r = (x, d = 6) => Number(Number(x).toPrecision(d));
const who = (f) => rows(f).map(c => [r(c[0]), r(c[1]), r(c[2]), r(c[3])]);
// Keeps the last row at or below `from` too: hcageinf has rows at 23.5 and
// 24.5, and without 23.5 an age of exactly 24 months would fall off the table.
const cdc = (f, sex, from, to) => {
  const all = rows(f).filter(c => c[0] === sex && +c[1] <= to);
  const start = all.reduce((i, c, j) => (+c[1] <= from ? j : i), 0);
  return all.slice(start).map(c => [r(c[1]), r(c[2], 8), r(c[3], 8), r(c[4], 8)]);
};
const ref = {
  who: {
    male: { weight: who('who-boys-wfa.csv'), length: who('who-boys-lfa.csv'), head: who('who-boys-hc.csv') },
    female: { weight: who('who-girls-wfa.csv'), length: who('who-girls-lfa.csv'), head: who('who-girls-hc.csv') },
  },
  cdc: {
    male: { weight: cdc('wtage.csv', '1', 24, 240), length: cdc('statage.csv', '1', 24, 240), head: cdc('hcageinf.csv', '1', 24, 36) },
    female: { weight: cdc('wtage.csv', '2', 24, 240), length: cdc('statage.csv', '2', 24, 240), head: cdc('hcageinf.csv', '2', 24, 36) },
  },
};
fs.writeFileSync(out, JSON.stringify(ref));
// Published percentile values, used by tests to check the LMS math against the source.
const fx = [];
const whoP = (f, sex, measure) => rows(f).filter(c => [0, 6, 12, 23].includes(+c[0])).forEach(c => fx.push({ source: 'who', sex, measure, ageMonths: +c[0], p5: +c[5], p50: +c[8], p95: +c[11] }));
whoP('who-boys-wfa.csv', 'male', 'weight'); whoP('who-girls-lfa.csv', 'female', 'length'); whoP('who-boys-hc.csv', 'male', 'head');
const cdcP = (f, sexCode, sex, measure, ages) => rows(f).filter(c => c[0] === sexCode && ages.includes(+c[1])).forEach(c => fx.push({ source: 'cdc', sex, measure, ageMonths: +c[1], p5: +c[6], p50: +c[9], p95: +c[12] }));
cdcP('wtage.csv', '2', 'female', 'weight', [36.5, 60.5]); cdcP('hcageinf.csv', '1', 'male', 'head', [24.5, 35.5]); cdcP('statage.csv', '1', 'male', 'length', [30.5, 48.5]);
fs.writeFileSync(fixtures, JSON.stringify(fx, null, 1));
console.log('ok', fs.statSync(out).size, fx.length);
