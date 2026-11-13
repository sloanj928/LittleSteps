'use client';

import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import type { FoodGroup } from '@/db/schema';
import { ageInMonths, ageOrigin, formatEntryDate } from '@/lib/dates';
import { FOOD_GROUP_LABELS } from '@/lib/foods';
import { formatMeasure, type GrowthPoint } from '@/lib/growth/insights';
import type { Measure } from '@/lib/growth/percentiles';
import { useTokens } from '../Providers';
import type { Art } from '../theme/palettes';
import { SiblingLegend } from './classic';
import { foodsByGroup, shortAge } from './summaries';
import type { DisplayTheme, EntriesSlotProps, GrowthSlotProps, SiblingsSlotProps } from './types';

// Nursery Shelf: the record drawn as things in a child's room. Heights are
// pencil marks on a doorframe, foods fill jars, words stack up as alphabet
// blocks, firsts hang as ribbons from a shelf.
//
// Every drawing is original SVG built here from the data. Each is hidden
// from screen readers, which get the same facts as a sentence
// (summaries.ts); anything the picture says by colour or position it also
// says in drawn text.

const W = 340;
const svgProps = { width: '100%', 'aria-hidden': true, style: { display: 'block', fontFamily: 'inherit' } } as const;

// A stable pseudo-random number in [-1, 1] from a string, so hand-drawn
// wobble is the same on every render and on the server.
function wobble(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}

// --- Doorframe ----------------------------------------------------------------

const DOOR_H = 300;
const DOOR_TOP = 26;
const DOOR_BOTTOM = 268;
// Two labels closer than this would overlap; the older one goes unlabelled.
const LABEL_GAP = 17;

function Jamb({ x, width }: { x: number; width: number }) {
  const { art } = useTokens();
  return (
    <g>
      <rect x={0} y={0} width={W} height={DOOR_H} rx={18} fill={art.wall} />
      <rect x={x} y={0} width={width} height={DOOR_H} fill={art.wood} />
      <rect x={x} y={0} width={7} height={DOOR_H} fill={art.woodLight} />
      <rect x={x + width - 5} y={0} width={5} height={DOOR_H} fill={art.woodDark} />
      {[0.3, 0.55, 0.78].map((f) => (
        <path key={f} d={`M${x + width * f},0 q4,${DOOR_H / 2} -2,${DOOR_H}`} stroke={art.woodDark} strokeWidth={1} fill="none" opacity={0.25} />
      ))}
      <rect x={0} y={DOOR_H - 16} width={W} height={16} fill={art.woodLight} />
      <rect x={0} y={DOOR_H - 17} width={W} height={2} fill={art.woodDark} opacity={0.5} />
    </g>
  );
}

/** Maps values to heights on the frame, taller is higher, with room above and below. */
function heightScale(values: number[]) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || 1;
  return (v: number) => DOOR_BOTTOM - ((v - (lo - pad)) / (hi - lo + pad * 2)) * (DOOR_BOTTOM - DOOR_TOP);
}

/** Newest first, a mark gets a label only if it clears the labels already placed. */
function labelled(points: GrowthPoint[], y: (v: number) => number): Set<string> {
  const placed: number[] = [];
  const ids = new Set<string>();
  for (const p of [...points].reverse()) {
    const at = y(p.value);
    if (placed.every((other) => Math.abs(other - at) >= LABEL_GAP)) {
      placed.push(at);
      ids.add(p.id);
    }
  }
  return ids;
}

interface MarksProps {
  points: GrowthPoint[];
  measure: Measure;
  y: (v: number) => number;
  /** The mark runs from x1 to x2 on the wood; its label sits outside at labelX. */
  x1: number;
  x2: number;
  labelX: number;
  anchor: 'start' | 'end';
  dashed?: boolean;
  color: string;
}

function PencilMarks({ points, measure, y, x1, x2, labelX, anchor, dashed, color }: MarksProps) {
  const withLabel = labelled(points, y);
  const lastId = points[points.length - 1]?.id;
  return (
    <g>
      {points.map((p) => {
        const at = y(p.value);
        const tilt = wobble(p.id) * 1.5;
        const full = withLabel.has(p.id);
        // An unlabelled mark is a short tick, so it reads as "also measured here".
        const end = full ? x2 : x1 + (x2 - x1) * 0.55;
        return (
          <g key={p.id}>
            <line x1={x1} y1={at - tilt} x2={end} y2={at + tilt} stroke={color} strokeWidth={p.id === lastId ? 2.6 : 1.7} strokeLinecap="round" strokeDasharray={dashed ? '5 4' : undefined} />
            {full && (
              <text x={labelX} y={at + 4} textAnchor={anchor} style={{ fontSize: 12, fill: color, fontWeight: p.id === lastId ? 800 : 600, fontFamily: 'inherit' }}>
                {shortAge(p.ageMonths)} · {formatMeasure(measure, p.value)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Doorframe({ measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const y = points.length ? heightScale(points.map((p) => p.value)) : () => 0;
  return (
    <svg viewBox={`0 0 ${W} ${DOOR_H}`} {...svgProps}>
      <Jamb x={34} width={62} />
      <PencilMarks points={points} measure={measure} y={y} x1={40} x2={92} labelX={106} anchor="start" color={art.pencil} />
    </svg>
  );
}

function SiblingDoorframe({ measure, series }: SiblingsSlotProps) {
  const { ls } = useTokens();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const y = values.length ? heightScale(values) : () => 0;
  const [a, b] = series;
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${DOOR_H}`} {...svgProps}>
        <Jamb x={140} width={60} />
        {a && <PencilMarks points={a.points} measure={measure} y={y} x1={145} x2={169} labelX={134} anchor="end" color={ls.primary} />}
        {b && <PencilMarks points={b.points} measure={measure} y={y} x1={172} x2={196} labelX={206} anchor="start" dashed color={ls.tertiary} />}
      </svg>
      <SiblingLegend names={series.map((s) => s.baby.name)} />
    </Stack>
  );
}

// --- Jars ---------------------------------------------------------------------

const JAR_GROUPS: FoodGroup[] = ['fruit', 'vegetable', 'grain', 'protein', 'dairy', 'other'];
const JAR = { w: 66, h: 74, cellW: W / 3, cellH: 128 };
// A jar is full at this many different foods, or at the fullest jar's count
// if that is higher, so jars fill visibly from the first few foods.
const JAR_FULL_AT = 6;

function Jar({ group, count, fullAt, col, row }: { group: FoodGroup; count: number; fullAt: number; col: number; row: number }) {
  const { art, ls } = useTokens();
  const clip = useId();
  const x = col * JAR.cellW + (JAR.cellW - JAR.w) / 2;
  const y = row * JAR.cellH + 22;
  const level = count ? Math.max(0.14, Math.min(1, count / fullAt)) : 0;
  const top = y + JAR.h - level * (JAR.h - 6);
  return (
    <g>
      <clipPath id={clip}>
        <rect x={x} y={y} width={JAR.w} height={JAR.h} rx={13} />
      </clipPath>
      <rect x={x} y={y} width={JAR.w} height={JAR.h} rx={13} fill={ls.surface} opacity={0.6} />
      {count > 0 && (
        <g clipPath={`url(#${clip})`}>
          <path d={`M${x},${top} q${JAR.w / 4},-5 ${JAR.w / 2},0 t${JAR.w / 2},0 V${y + JAR.h} H${x} Z`} fill={art[group]} />
        </g>
      )}
      <rect x={x} y={y} width={JAR.w} height={JAR.h} rx={13} fill="none" stroke={art.glass} strokeWidth={2} />
      <rect x={x + 9} y={y - 12} width={JAR.w - 18} height={13} rx={4} fill={art.lid} />
      <text x={x + JAR.w / 2} y={y + JAR.h / 2 + 8} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: count ? art.ink : ls.onSurfaceVariant, fontFamily: 'inherit' }}>
        {count}
      </text>
      <text x={x + JAR.w / 2} y={y + JAR.h + 20} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: ls.onSurface, fontFamily: 'inherit' }}>
        {FOOD_GROUP_LABELS[group]}
      </text>
    </g>
  );
}

function Jars({ entries }: EntriesSlotProps) {
  const { ls } = useTokens();
  const groups = foodsByGroup(entries);
  const fullAt = Math.max(JAR_FULL_AT, ...Object.values(groups));
  const flagged = [...new Set(entries.filter((e) => e.allergyFlag).map((e) => e.title))];
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${JAR.cellH * 2}`} {...svgProps}>
        {JAR_GROUPS.map((g, i) => (
          <Jar key={g} group={g} count={groups[g]} fullAt={fullAt} col={i % 3} row={Math.floor(i / 3)} />
        ))}
      </svg>
      {flagged.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1.5, borderRadius: 3, bgcolor: ls.cautionContainer, color: ls.onCautionContainer }} aria-hidden>
          <WarningIcon />
          <Typography>Possible allergy noted: {flagged.join(', ')}</Typography>
        </Stack>
      )}
    </Stack>
  );
}

// --- Alphabet blocks ----------------------------------------------------------

const BLOCK = 44;
const BLOCK_GAP = 6;
// Blocks per row from the floor up: a pile that narrows as it rises and holds
// the whole alphabet plus "#" for words that start with anything else.
const ROWS = [6, 6, 5, 4, 3, 2, 1];
const BLOCK_FILLS: (keyof Art)[] = ['fruit', 'dairy', 'grain', 'vegetable', 'other', 'protein'];

function Blocks({ entries }: EntriesSlotProps) {
  const { art, ls } = useTokens();
  const counts = new Map<string, number>();
  for (const e of entries) {
    const first = e.title.trim()[0]?.toUpperCase() ?? '#';
    const letter = /[A-Z]/.test(first) ? first : '#';
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  const letters = [...counts.keys()].sort();
  const rows: string[][] = [];
  let i = 0;
  for (const capacity of ROWS) {
    if (i >= letters.length) break;
    rows.push(letters.slice(i, i + capacity));
    i += capacity;
  }
  const height = Math.max(1, rows.length) * (BLOCK + BLOCK_GAP) + 34;
  const floor = height - 16;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} {...svgProps}>
      <rect x={0} y={0} width={W} height={height} rx={18} fill={art.wall} />
      <rect x={0} y={floor} width={W} height={16} fill={art.woodLight} />
      {rows.map((row, r) => {
        const width = row.length * BLOCK + (row.length - 1) * BLOCK_GAP;
        const y = floor - (r + 1) * BLOCK - r * BLOCK_GAP;
        return row.map((letter, c) => {
          const x = (W - width) / 2 + c * (BLOCK + BLOCK_GAP);
          const n = counts.get(letter)!;
          const fill = art[BLOCK_FILLS[(letter.charCodeAt(0) + r) % BLOCK_FILLS.length]];
          return (
            <g key={letter} transform={`rotate(${(wobble(letter) * 3).toFixed(2)} ${x + BLOCK / 2} ${y + BLOCK})`}>
              <rect x={x} y={y} width={BLOCK} height={BLOCK} rx={8} fill={fill} />
              <rect x={x + 4} y={y + 4} width={BLOCK - 8} height={BLOCK - 8} rx={5} fill="none" stroke={art.ink} strokeWidth={1} opacity={0.25} />
              <text x={x + BLOCK / 2} y={y + BLOCK / 2 + 9} textAnchor="middle" style={{ fontSize: 25, fontWeight: 800, fill: art.ink, fontFamily: 'inherit' }}>
                {letter}
              </text>
              {n > 1 && (
                <g>
                  <circle cx={x + BLOCK - 5} cy={y + 5} r={10} fill={ls.surface} stroke={art.ink} strokeWidth={1} />
                  <text x={x + BLOCK - 5} y={y + 9} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: ls.onSurface, fontFamily: 'inherit' }}>
                    {n}
                  </text>
                </g>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}

// --- Shelf --------------------------------------------------------------------

const PER_SHELF = 3;
const SHELF_H = 134;
const KEEPSAKE_H = 46;
const RIBBON_FILLS: (keyof Art)[] = ['fruit', 'dairy', 'grain', 'vegetable', 'other', 'protein'];

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function Ribbon({ cx, top, fill, age, title, date }: { cx: number; top: number; fill: string; age: string; title: string; date: string }) {
  const { art, ls } = useTokens();
  const cy = top + 36;
  return (
    <g>
      <line x1={cx} y1={top} x2={cx} y2={cy - 20} stroke={art.woodDark} strokeWidth={1.5} />
      <path d={`M${cx - 12},${cy + 14} l-8,30 l10,-7 l6,9 l4,-28 Z`} fill={fill} />
      <path d={`M${cx + 12},${cy + 14} l8,30 l-10,-7 l-6,9 l-4,-28 Z`} fill={fill} />
      {/* The scalloped edge of a rosette: a ring of small circles around the disc. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={(cx + Math.cos(a) * 21).toFixed(2)} cy={(cy + Math.sin(a) * 21).toFixed(2)} r={6.5} fill={fill} />;
      })}
      <circle cx={cx} cy={cy} r={21} fill={fill} />
      <circle cx={cx} cy={cy} r={16} fill={ls.surface} />
      <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 800, fill: ls.onSurface, fontFamily: 'inherit' }}>
        {age}
      </text>
      <text x={cx} y={top + 100} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 800, fill: ls.onSurface, fontFamily: 'inherit' }}>
        {title}
      </text>
      <text x={cx} y={top + 116} textAnchor="middle" style={{ fontSize: 11.5, fill: ls.onSurfaceVariant, fontFamily: 'inherit' }}>
        {date}
      </text>
    </g>
  );
}

/** A few toys on top of the shelf. Decoration only: they carry no data. */
function Keepsakes({ y }: { y: number }) {
  const { art } = useTokens();
  return (
    <g>
      <rect x={34} y={y - 12} width={46} height={12} rx={2} fill={art.dairy} />
      <rect x={38} y={y - 23} width={40} height={11} rx={2} fill={art.fruit} />
      <rect x={36} y={y - 33} width={36} height={10} rx={2} fill={art.grain} />
      <circle cx={170} cy={y - 15} r={15} fill={art.vegetable} />
      <path d={`M155.5,${y - 19} q14.5,9 29,0`} stroke={art.ink} strokeWidth={1.5} fill="none" opacity={0.35} />
      <rect x={262} y={y - 22} width={22} height={22} rx={4} fill={art.other} />
      <rect x={284} y={y - 22} width={22} height={22} rx={4} fill={art.protein} />
      <rect x={273} y={y - 43} width={22} height={21} rx={4} fill={art.fruit} />
    </g>
  );
}

function Shelf({ baby, entries, compact }: EntriesSlotProps) {
  const { art } = useTokens();
  // The newest ribbons hang first; older ones are counted below and listed in Data.
  const newest = [...entries].reverse();
  const shown = newest.slice(0, compact ? PER_SHELF : PER_SHELF * 3);
  const shelves = Math.max(1, Math.ceil(shown.length / PER_SHELF));
  const height = KEEPSAKE_H + shelves * SHELF_H + 6;
  const cell = (W - 20) / PER_SHELF;
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${height}`} {...svgProps}>
        <rect x={0} y={0} width={W} height={height} rx={18} fill={art.wall} />
        <Keepsakes y={KEEPSAKE_H} />
        {Array.from({ length: shelves }, (_, s) => {
          const y = KEEPSAKE_H + s * SHELF_H;
          return (
            <g key={s}>
              <rect x={10} y={y} width={W - 20} height={11} rx={3} fill={art.wood} />
              <rect x={10} y={y + 8} width={W - 20} height={3} rx={1.5} fill={art.woodDark} />
              {shown.slice(s * PER_SHELF, (s + 1) * PER_SHELF).map((e, i) => (
                <Ribbon
                  key={e.id}
                  cx={10 + cell * (i + 0.5)}
                  top={y + 11}
                  fill={art[RIBBON_FILLS[(s * PER_SHELF + i) % RIBBON_FILLS.length]]}
                  age={e.date ? shortAge(Math.max(0, ageInMonths(ageOrigin(baby, e.date), e.date))) : '?'}
                  title={truncate(e.title, 15)}
                  date={formatEntryDate(e.date, e.datePrecision).replace('Date not remembered', 'Date not sure')}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {entries.length > shown.length && (
        <Typography color="text.secondary" sx={{ textAlign: 'center' }} aria-hidden>
          and {entries.length - shown.length} earlier {entries.length - shown.length === 1 ? 'first' : 'firsts'}
        </Typography>
      )}
    </Stack>
  );
}

export const nurseryTheme: DisplayTheme = {
  id: 'nursery',
  name: 'Nursery Shelf',
  description: 'Pencil marks on the doorframe, jars, blocks and ribbons.',
  Growth: Doorframe,
  Foods: Jars,
  Words: Blocks,
  Firsts: Shelf,
  Siblings: SiblingDoorframe,
};
