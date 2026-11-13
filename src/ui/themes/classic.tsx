'use client';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CHART_PERCENTILES, curvePoints, referenceMaxMonths } from '@/lib/growth/percentiles';
import { EntryRow } from '../app/EntryRow';
import { useTokens } from '../Providers';
import type { DisplayTheme, EntriesSlotProps, GrowthSlotProps, SiblingsSlotProps } from './types';

// Classic is the plain view: a percentile chart and readable lists. It is
// also the "Data" view every illustrated theme can flip to.

const W = 340;
const H = 250;
const M = { left: 40, right: 26, top: 10, bottom: 34 };
// Measurements further apart than this are joined by a dotted line: the
// chart shouldn't imply it knows what happened in between.
const GAP_MONTHS = 4;
const COMPACT_ROWS = 3;

function niceTicks(lo: number, hi: number, target: number): number[] {
  const raw = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function ageTicks(xMax: number): number[] {
  const step = xMax <= 12 ? 2 : xMax <= 24 ? 3 : xMax <= 60 ? 6 : 12;
  return Array.from({ length: Math.floor(xMax / step) + 1 }, (_, i) => i * step);
}

function Axes({ xMax, x, yTicks, y, yLabel }: { xMax: number; x: (v: number) => number; yTicks: number[]; y: (v: number) => number; yLabel: (v: number) => string }) {
  const { ls } = useTokens();
  const text = { fontSize: 11, fill: ls.onSurfaceVariant, fontFamily: 'inherit' };
  return (
    <g>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={ls.outlineVariant} strokeWidth={1} />
          <text x={M.left - 6} y={y(t) + 4} textAnchor="end" style={text}>
            {yLabel(t)}
          </text>
        </g>
      ))}
      {ageTicks(xMax).map((t) => (
        <text key={t} x={x(t)} y={H - M.bottom + 15} textAnchor="middle" style={text}>
          {t}
        </text>
      ))}
      <text x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle" style={text}>
        Age in months
      </text>
    </g>
  );
}

/** A baby's measurements over the WHO/CDC percentile curves, drawn as a soft band with the median marked. */
function PercentileChart({ baby, measure, points }: GrowthSlotProps) {
  const { ls } = useTokens();
  if (!points.length) return null;
  const lastAge = points[points.length - 1].ageMonths;
  const xMax = Math.max(6, Math.ceil((lastAge + 1) / 3) * 3);
  const curveMax = Math.min(xMax, referenceMaxMonths(measure));
  const curves = baby.sex ? CHART_PERCENTILES.map((p) => ({ p, pts: curvePoints(baby.sex!, measure, 0, curveMax, p, xMax > 36 ? 1 : 0.5) })) : [];

  const values = [...points.map((p) => p.value), ...curves.flatMap((c) => c.pts.map((pt) => pt.value))];
  const span = Math.max(...values) - Math.min(...values) || 1;
  const yLo = Math.max(0, Math.min(...values) - span * 0.06);
  const yHi = Math.max(...values) + span * 0.06;
  const x = (age: number) => M.left + (Math.max(0, age) / xMax) * (W - M.left - M.right);
  const y = (v: number) => H - M.bottom - ((v - yLo) / (yHi - yLo)) * (H - M.top - M.bottom);
  const line = (pts: { ageMonths: number; value: number }[]) => pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.ageMonths).toFixed(1)},${y(pt.value).toFixed(1)}`).join(' ');
  const band = (lo: number, hi: number) => {
    const a = curves.find((c) => c.p === lo)!.pts;
    const b = curves.find((c) => c.p === hi)!.pts;
    return `${line(a)} ${[...b].reverse().map((pt) => `L${x(pt.ageMonths).toFixed(1)},${y(pt.value).toFixed(1)}`).join(' ')} Z`;
  };
  // Weight is stored in ounces and read in pounds.
  const scale = measure === 'weight' ? 16 : 1;
  const yTicks = niceTicks(yLo / scale, yHi / scale, 4).map((t) => t * scale);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden style={{ display: 'block', fontFamily: 'inherit' }}>
      <Axes xMax={xMax} x={x} y={y} yTicks={yTicks} yLabel={(t) => `${Math.round((t / scale) * 10) / 10}${measure === 'weight' ? ' lb' : '"'}`} />
      {curves.length > 0 && (
        <g>
          <path d={band(3, 97)} fill={ls.primary} opacity={0.1} />
          <path d={band(15, 85)} fill={ls.primary} opacity={0.12} />
          <path d={line(curves.find((c) => c.p === 50)!.pts)} fill="none" stroke={ls.primary} strokeWidth={1.25} strokeDasharray="5 4" opacity={0.7} />
          {curves.map(({ p, pts }) => (
            <text key={p} x={W - M.right + 4} y={y(pts[pts.length - 1].value) + 4} style={{ fontSize: 10, fill: ls.onSurfaceVariant, fontFamily: 'inherit' }}>
              {p}
            </text>
          ))}
        </g>
      )}
      {points.slice(1).map((pt, i) => {
        const prev = points[i];
        const gap = pt.ageMonths - prev.ageMonths > GAP_MONTHS;
        return <line key={pt.id} x1={x(prev.ageMonths)} y1={y(prev.value)} x2={x(pt.ageMonths)} y2={y(pt.value)} stroke={ls.primary} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={gap ? '1 6' : undefined} />;
      })}
      {points.map((pt) => (
        <circle key={pt.id} cx={x(pt.ageMonths)} cy={y(pt.value)} r={4.5} fill={ls.primary} stroke={ls.surfaceContainerLow} strokeWidth={2} />
      ))}
    </svg>
  );
}

// The two children are told apart by line style and marker shape first
// (solid with dots, dashed with squares) and colour second.
function seriesStyle(i: number, ls: ReturnType<typeof useTokens>['ls']) {
  return i === 0 ? { color: ls.primary, dash: undefined, square: false } : { color: ls.tertiary, dash: '6 5', square: true };
}

export function SiblingLegend({ names }: { names: string[] }) {
  const { ls } = useTokens();
  return (
    <Stack direction="row" spacing={3} sx={{ justifyContent: 'center', flexWrap: 'wrap' }} aria-hidden>
      {names.map((name, i) => {
        const s = seriesStyle(i, ls);
        return (
          <Stack key={name} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <svg width={36} height={12}>
              <line x1={2} x2={34} y1={6} y2={6} stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} strokeLinecap="round" />
              {s.square ? <rect x={14} y={2} width={8} height={8} fill={s.color} /> : <circle cx={18} cy={6} r={4} fill={s.color} />}
            </svg>
            <Typography>{name}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Two children's percentiles by age on one chart: the fair comparison, since raw sizes differ by age and sex. */
function SiblingChart({ series }: SiblingsSlotProps) {
  const { ls } = useTokens();
  const all = series.flatMap((s) => s.points.filter((p) => p.percentile != null));
  if (!all.length) return null;
  const xMax = Math.max(6, Math.ceil((Math.max(...all.map((p) => p.ageMonths)) + 1) / 3) * 3);
  const x = (age: number) => M.left + (Math.max(0, age) / xMax) * (W - M.left - M.right);
  const y = (pct: number) => H - M.bottom - (pct / 100) * (H - M.top - M.bottom);
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden style={{ display: 'block', fontFamily: 'inherit' }}>
        <Axes xMax={xMax} x={x} y={y} yTicks={[...CHART_PERCENTILES]} yLabel={(t) => `${t}`} />
        {series.map(({ baby, points }, i) => {
          const s = seriesStyle(i, ls);
          const pts = points.filter((p) => p.percentile != null);
          return (
            <g key={baby.id}>
              <path d={pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.ageMonths).toFixed(1)},${y(p.percentile!).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p) => (s.square ? <rect key={p.id} x={x(p.ageMonths) - 4} y={y(p.percentile!) - 4} width={8} height={8} fill={s.color} /> : <circle key={p.id} cx={x(p.ageMonths)} cy={y(p.percentile!)} r={4.5} fill={s.color} />))}
            </g>
          );
        })}
      </svg>
      <SiblingLegend names={series.map((s) => s.baby.name)} />
      <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
        Percentile at each age
      </Typography>
    </Stack>
  );
}

function EntryList({ baby, entries, compact }: EntriesSlotProps) {
  if (!entries.length) return null;
  const newestFirst = [...entries].reverse();
  const shown = compact ? newestFirst.slice(0, COMPACT_ROWS) : newestFirst;
  return (
    <List disablePadding>
      {shown.map((e) => (
        <li key={e.id}>
          <EntryRow baby={baby} entry={e} />
        </li>
      ))}
    </List>
  );
}

function WordsList({ baby, entries, compact }: EntriesSlotProps) {
  const [query, setQuery] = useState('');
  if (!entries.length) return null;
  if (compact) return <EntryList baby={baby} entries={entries} compact />;
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => e.title.toLowerCase().includes(q)).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <Stack spacing={1}>
      <TextField size="small" label="Search words" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Box role="status" className="sr-only">
        {shown.length} of {entries.length} words shown
      </Box>
      {shown.length ? <EntryList baby={baby} entries={[...shown].reverse()} /> : <Typography color="text.secondary">No words match &ldquo;{query}&rdquo;.</Typography>}
    </Stack>
  );
}

export const classicTheme: DisplayTheme = {
  id: 'classic',
  name: 'Classic',
  description: 'Clean charts and lists.',
  Growth: PercentileChart,
  Foods: EntryList,
  Words: WordsList,
  Firsts: EntryList,
  Siblings: SiblingChart,
};
