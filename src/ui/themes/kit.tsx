"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { CSSProperties, ReactNode } from "react";
import type { FoodGroup } from "@/db/schema";
import { ageInMonths, ageOrigin, formatEntryDate } from "@/lib/dates";
import { FOOD_GROUP_LABELS } from "@/lib/foods";
import { formatMeasure, type GrowthPoint } from "@/lib/growth/insights";
import type { Measure } from "@/lib/growth/percentiles";
import type { Baby } from "@/lib/types";
import { useTokens } from "../Providers";
import { svgProps, W, wobble } from "./drawing";
import { useFresh } from "./fresh";
import { foodsByGroup, shortAge, wordsByLetter } from "./summaries";
import type {
  EntriesSlotProps,
  GrowthSlotProps,
  SiblingsSlotProps,
} from "./types";

// The layouts every illustrated theme shares. A theme decides what a
// reading, a food group, a letter or a first looks like; these decide where
// each goes, what it's labelled, and which one is new (fresh.ts). So a new
// theme is drawings, not layout code, and every theme labels the same facts.

export const TAU = Math.PI * 2;
export const f1 = (n: number) => n.toFixed(1);
const text = (size: number, fill: string, weight = 700): CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  fill,
  fontFamily: "inherit",
});

/** A five-pointed star centred on (cx, cy). */
export function starPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    return `${f1(cx + r * Math.cos(a))},${f1(cy + r * Math.sin(a))}`;
  });
  return `M${pts.join("L")}Z`;
}

/** The growth slot's freshness key, shared by every drawing of one measure so switching theme doesn't replay bounces. */
export function useFreshPoints(
  baby: Baby,
  measure: Measure,
  points: GrowthPoint[],
) {
  return useFresh(
    `growth:${measure}:${baby.id}`,
    points.map((p) => p.id),
  );
}

// --- Height marks (length) -----------------------------------------------------

/** Maps values to heights between `bottom` and `top`, taller is higher, with room above and below. */
export function heightScale(values: number[], top: number, bottom: number) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || 1;
  return (v: number) =>
    bottom - ((v - (lo - pad)) / (hi - lo + pad * 2)) * (bottom - top);
}

// Two labels closer than this would overlap; the older one goes unlabelled.
const LABEL_GAP = 17;

/** Newest first, a mark gets a label only if it clears the labels already placed. */
function labelledMarks(
  points: GrowthPoint[],
  y: (v: number) => number,
): Set<string> {
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

export interface MarksProps {
  points: GrowthPoint[];
  measure: Measure;
  y: (v: number) => number;
  /** The mark runs from x1 to x2; its label sits outside at labelX. */
  x1: number;
  x2: number;
  labelX: number;
  anchor: "start" | "end";
  dashed?: boolean;
  color: string;
  fresh?: ReadonlySet<string>;
}

/** Hand-drawn marks at each reading's height: the newest heaviest, unlabelled ones short, a new one popping in. */
export function PencilMarks({
  points,
  measure,
  y,
  x1,
  x2,
  labelX,
  anchor,
  dashed,
  color,
  fresh,
}: MarksProps) {
  const withLabel = labelledMarks(points, y);
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
          <g key={p.id} className={fresh?.has(p.id) ? "ls-pop" : undefined}>
            <line
              x1={x1}
              y1={at - tilt}
              x2={end}
              y2={at + tilt}
              stroke={color}
              strokeWidth={p.id === lastId ? 2.6 : 1.7}
              strokeLinecap="round"
              strokeDasharray={dashed ? "5 4" : undefined}
            />
            {full && (
              <text
                x={labelX}
                y={at + 4}
                textAnchor={anchor}
                style={text(12, color, p.id === lastId ? 800 : 600)}
              >
                {shortAge(p.ageMonths)} · {formatMeasure(measure, p.value)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// --- Rings (head) --------------------------------------------------------------

type Shape = (a: number) => number;

/** A set of nested, uneven rings: a tree's, an orbit's, a ripple's. */
export interface RingFrame {
  shape: Shape;
  /** Where the smallest ring centres; outer rings drift back to (cx, cy), as a tree's pith sits off centre. */
  core: { x: number; y: number };
  cx: number;
  cy: number;
  rOut: number;
  /** Squash for rings seen at an angle (orbits); 1 is straight down. */
  squash: number;
  /** How uneven each ring is on its own, on top of the shared shape. */
  jitter: number;
}

/**
 * An outline as a multiplier on the radius at each angle: a few slow lobes
 * scaled by `lumpy`, the same for every ring so they nest without crossing.
 * Seeded, so each child's rings keep their shape.
 */
export function makeRings(
  seed: string,
  cx: number,
  cy: number,
  rOut: number,
  { lumpy = 1, squash = 1, offCentre = 0.1, jitter = 0.007 } = {},
): RingFrame {
  const p = [1, 2, 3, 4].map((i) => wobble(`${seed}:${i}`) * Math.PI);
  const shape: Shape = (a) =>
    1 +
    lumpy *
      (0.045 * Math.sin(2 * a + p[0]) +
        0.03 * Math.sin(3 * a + p[1]) +
        0.014 * Math.sin(5 * a + p[2]) +
        0.008 * Math.sin(9 * a + p[3]));
  return {
    shape,
    core: {
      x: cx + wobble(`${seed}:px`) * rOut * offCentre,
      y: cy + wobble(`${seed}:py`) * rOut * offCentre * squash,
    },
    cx,
    cy,
    rOut,
    squash,
    jitter,
  };
}

/** A point on the ring of radius r at angle a, with its own slight unevenness (seeded by `id`). */
export function ringPoint(
  f: RingFrame,
  r: number,
  a: number,
  id: string,
): [number, number] {
  const k = r / f.rOut;
  const x0 = f.core.x + (f.cx - f.core.x) * k;
  const y0 = f.core.y + (f.cy - f.core.y) * k;
  const rr =
    r * (f.shape(a) + f.jitter * Math.sin(7 * a + wobble(id) * Math.PI));
  return [x0 + rr * Math.cos(a), y0 + rr * Math.sin(a) * f.squash];
}

export function ringPath(f: RingFrame, r: number, id: string): string {
  const n = 120;
  const pts = Array.from({ length: n }, (_, i) =>
    ringPoint(f, r, (i / n) * TAU, id),
  );
  return `M${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L")}Z`;
}

/** Radius by value: the smallest reading at rIn, the largest at rOut. */
export function radiusScale(values: number[], rIn: number, rOut: number) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return (v: number) =>
    hi === lo ? rOut : rIn + ((v - lo) / (hi - lo)) * (rOut - rIn);
}

// Labels down the right are this far apart at least; more rings than fit go unlabelled.
const MAX_RING_LABELS = 7;
const RING_H = 300;

/**
 * Rings with a leader from each labelled ring to its age and size down the
 * right. `children` draws the rings themselves from the frame and radius.
 */
export function RingDiagram({
  frame,
  points,
  measure,
  radius,
  color,
  fresh,
  background,
  children,
}: {
  frame: RingFrame;
  points: GrowthPoint[];
  measure: Measure;
  radius: (v: number) => number;
  color: string;
  fresh: ReadonlySet<string>;
  background: ReactNode;
  children: ReactNode;
}) {
  const labelX = 230;
  const labelled =
    points.length <= MAX_RING_LABELS
      ? [...points].reverse()
      : [...points.slice(-(MAX_RING_LABELS - 1)).reverse(), points[0]];
  const lastId = points[points.length - 1]?.id;
  const slot = (i: number) =>
    labelled.length === 1
      ? frame.cy
      : 40 + (i * (RING_H - 80)) / (labelled.length - 1);
  // The largest ring takes the top slot, so leaders don't cross.
  const byValue = [...labelled].sort((a, b) => b.value - a.value);
  return (
    <svg viewBox={`0 0 ${W} ${RING_H}`} {...svgProps}>
      {background}
      {children}
      {byValue.map((p, i) => {
        const y = slot(i);
        const a = Math.atan2(y - frame.cy, labelX - 8 - frame.cx);
        const [x0, y0] = ringPoint(frame, radius(p.value), a, p.id);
        const newest = p.id === lastId;
        return (
          <g key={p.id} className={fresh.has(p.id) ? "ls-pop" : undefined}>
            <line
              x1={f1(x0)}
              y1={f1(y0)}
              x2={labelX - 6}
              y2={f1(y)}
              stroke={color}
              strokeWidth={1}
              opacity={0.7}
            />
            <circle cx={f1(x0)} cy={f1(y0)} r={2.4} fill={color} />
            <text
              x={labelX}
              y={f1(y + 4)}
              style={text(12, color, newest ? 800 : 600)}
            >
              {shortAge(p.ageMonths)} · {formatMeasure(measure, p.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- A row of things, one per reading (weight, head) ----------------------------

const PER_ROW = 5;
const TOKEN_ROW_H = 136;
// Older readings beyond this many rows are counted, not drawn.
const MAX_TOKEN_ROWS = 3;

export interface TokenProps {
  cx: number;
  /** The top of the space the thing may fill: 72px tall, about 60 wide. */
  top: number;
  /** 0 for the smallest reading, 1 for the largest. */
  size: number;
  index: number;
  newest: boolean;
}

/**
 * One drawing per reading in rows of five, smallest to newest, each with its
 * age and value beneath: hats on a rack, moons, pumpkins, boats. `rail`
 * draws what a row hangs from or stands on; `token` draws one reading. A new
 * reading swings in from the top of its space.
 */
export function TokenRows({
  baby,
  measure,
  points,
  background,
  rail,
  token,
  color,
  muted,
}: GrowthSlotProps & {
  background?: (h: number) => ReactNode;
  rail?: (y: number) => ReactNode;
  token: (t: TokenProps) => ReactNode;
  color: string;
  muted: string;
}) {
  const fresh = useFreshPoints(baby, measure, points);
  const shown = points.slice(-PER_ROW * MAX_TOKEN_ROWS);
  const hidden = points.length - shown.length;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const rows = Math.max(1, Math.ceil(shown.length / PER_ROW));
  const height = rows * TOKEN_ROW_H + 10;
  const lastId = points[points.length - 1]?.id;
  const cell = (W - 24) / PER_ROW;
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${height}`} {...svgProps}>
        {background?.(height)}
        {Array.from({ length: rows }, (_, r) => {
          const y = 14 + r * TOKEN_ROW_H;
          return (
            <g key={r}>
              {rail?.(y)}
              {shown.slice(r * PER_ROW, (r + 1) * PER_ROW).map((p, j) => {
                const cx = 12 + cell * (j + 0.5);
                const newest = p.id === lastId;
                const swing = fresh.has(p.id);
                return (
                  <g key={p.id}>
                    <g
                      className={swing ? "ls-swing" : undefined}
                      style={
                        swing
                          ? { transformOrigin: `${cx}px ${y + 14}px` }
                          : undefined
                      }
                    >
                      {token({
                        cx,
                        top: y + 14,
                        size: hi === lo ? 1 : (p.value - lo) / (hi - lo),
                        index: hidden + r * PER_ROW + j,
                        newest,
                      })}
                    </g>
                    <text
                      x={cx}
                      y={y + 102}
                      textAnchor="middle"
                      style={text(12.5, color, newest ? 800 : 700)}
                    >
                      {shortAge(p.ageMonths)}
                    </text>
                    <text
                      x={cx}
                      y={y + 117}
                      textAnchor="middle"
                      style={text(
                        11,
                        newest ? color : muted,
                        newest ? 800 : 500,
                      )}
                    >
                      {formatMeasure(measure, p.value)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hidden > 0 && (
        <Typography
          color="text.secondary"
          sx={{ textAlign: "center" }}
          aria-hidden
        >
          and {hidden} earlier
        </Typography>
      )}
    </Stack>
  );
}

// --- Six food groups -----------------------------------------------------------

export const FOOD_GROUPS_ORDER: FoodGroup[] = [
  "fruit",
  "vegetable",
  "grain",
  "protein",
  "dairy",
  "other",
];
// A group reads as full at this many different foods, or at the fullest group's count if higher.
const FULL_AT = 6;

export interface GroupProps {
  group: FoodGroup;
  count: number;
  /** 0 to 1: how full this group is against the fullest. */
  level: number;
  cx: number;
  /** The top of a 90px-tall space for the drawing; the label goes below it. */
  top: number;
}

/** The food groups in two rows of three, each drawn by the theme with its count, named beneath; a group with a new food hops. */
export function GroupGrid({
  baby,
  entries,
  item,
  background,
  labelColor,
}: EntriesSlotProps & {
  item: (g: GroupProps) => ReactNode;
  background?: (h: number) => ReactNode;
  labelColor: string;
}) {
  const { ls } = useTokens();
  const fresh = useFresh(
    `foods:${baby.id}`,
    entries.map((e) => e.id),
  );
  const hopping = new Set(
    entries.filter((e) => fresh.has(e.id)).map((e) => e.foodGroup ?? "other"),
  );
  const groups = foodsByGroup(entries);
  const fullAt = Math.max(FULL_AT, ...Object.values(groups));
  const flagged = [
    ...new Set(entries.filter((e) => e.allergyFlag).map((e) => e.title)),
  ];
  const cellH = 128;
  const h = cellH * 2;
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${h}`} {...svgProps}>
        {background?.(h)}
        {FOOD_GROUPS_ORDER.map((g, i) => {
          const cx = (i % 3) * (W / 3) + W / 6;
          const top = Math.floor(i / 3) * cellH + 8;
          return (
            <g key={g}>
              <g className={hopping.has(g) ? "ls-hop" : undefined}>
                {item({
                  group: g,
                  count: groups[g],
                  level: groups[g] ? Math.max(0.14, groups[g] / fullAt) : 0,
                  cx,
                  top,
                })}
              </g>
              <text
                x={cx}
                y={top + 110}
                textAnchor="middle"
                style={text(13, labelColor)}
              >
                {FOOD_GROUP_LABELS[g]}
              </text>
            </g>
          );
        })}
      </svg>
      {flagged.length > 0 && (
        <Typography
          sx={{
            p: 1.5,
            borderRadius: 3,
            bgcolor: ls.cautionContainer,
            color: ls.onCautionContainer,
          }}
          aria-hidden
        >
          Possible allergy noted: {flagged.join(", ")}
        </Typography>
      )}
    </Stack>
  );
}

// --- Letters (words) -----------------------------------------------------------

export interface LetterProps {
  letter: string;
  count: number;
  x: number;
  y: number;
  /** The space each letter has: a square this many pixels wide. */
  size: number;
  index: number;
}

/** The total across the top of a words drawing: "1 Word", "42 Words". */
export function WordTotal({
  n,
  y,
  color,
}: {
  n: number;
  y: number;
  color: string;
}) {
  return (
    <text x={W / 2} y={y} textAnchor="middle" style={text(18, color, 800)}>
      {n} {n === 1 ? "Word" : "Words"}
    </text>
  );
}

/** Where the first row of letters starts, below the word total. */
export const LETTER_TOP = 50;

/**
 * One drawing per starting letter, with how many words start with it, in
 * rows across the drawing (`rowSizes` from the top down, or a grid). A
 * letter with a new word drops in.
 */
export function LetterField({
  baby,
  entries,
  item,
  background,
  labelColor,
  size = 44,
  gap = 8,
}: EntriesSlotProps & {
  item: (l: LetterProps) => ReactNode;
  background: (h: number) => ReactNode;
  labelColor: string;
  size?: number;
  gap?: number;
}) {
  const fresh = useFresh(
    `words:${baby.id}`,
    entries.map((e) => e.id),
  );
  const { counts, freshLetters } = wordsByLetter(entries, fresh);
  const letters = [...counts.keys()].sort();
  const perRow = Math.floor((W - 20 + gap) / (size + gap));
  const rows = Math.max(1, Math.ceil(letters.length / perRow));
  const h = rows * (size + gap) + LETTER_TOP + 20;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} {...svgProps}>
      {background(h)}
      <WordTotal n={entries.length} y={32} color={labelColor} />
      {letters.map((letter, i) => {
        const r = Math.floor(i / perRow);
        const inRow = Math.min(perRow, letters.length - r * perRow);
        const rowW = inRow * size + (inRow - 1) * gap;
        const x = (W - rowW) / 2 + (i % perRow) * (size + gap);
        const y = LETTER_TOP + r * (size + gap);
        return (
          <g
            key={letter}
            className={freshLetters.has(letter) ? "ls-drop" : undefined}
          >
            {item({ letter, count: counts.get(letter)!, x, y, size, index: i })}
          </g>
        );
      })}
    </svg>
  );
}

/** The little count bubble on a letter with more than one word. */
export function CountBadge({
  x,
  y,
  n,
  fill,
  ink,
}: {
  x: number;
  y: number;
  n: number;
  fill: string;
  ink: string;
}) {
  if (n < 2) return null;
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill={fill} stroke={ink} strokeWidth={1} />
      <text x={x} y={y + 4} textAnchor="middle" style={text(11, ink, 800)}>
        {n}
      </text>
    </g>
  );
}

// --- Badges (firsts) -----------------------------------------------------------

const PER_BADGE_ROW = 3;
const BADGE_ROW_H = 150;

export interface BadgeProps {
  cx: number;
  /** The top of a 92px-tall space for the badge. */
  top: number;
  age: string;
  index: number;
}

/**
 * The newest firsts as badges in rows of three, each with its title and date
 * beneath; older ones are counted below. A new first swings in.
 */
export function BadgeRows({
  baby,
  entries,
  compact,
  badge,
  background,
  color,
  muted,
}: EntriesSlotProps & {
  badge: (b: BadgeProps) => ReactNode;
  background: (h: number) => ReactNode;
  color: string;
  muted: string;
}) {
  const fresh = useFresh(
    `firsts:${baby.id}`,
    entries.map((e) => e.id),
  );
  const newest = [...entries].reverse();
  const shown = newest.slice(0, compact ? PER_BADGE_ROW : PER_BADGE_ROW * 3);
  const rows = Math.max(1, Math.ceil(shown.length / PER_BADGE_ROW));
  const h = rows * BADGE_ROW_H + 10;
  const cell = (W - 20) / PER_BADGE_ROW;
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${h}`} {...svgProps}>
        {background(h)}
        {shown.map((e, i) => {
          const cx = 10 + cell * ((i % PER_BADGE_ROW) + 0.5);
          const top = 12 + Math.floor(i / PER_BADGE_ROW) * BADGE_ROW_H;
          const swing = fresh.has(e.id);
          const title =
            e.title.length > 15
              ? `${e.title.slice(0, 14).trimEnd()}…`
              : e.title;
          return (
            <g key={e.id}>
              <g
                className={swing ? "ls-swing" : undefined}
                style={
                  swing ? { transformOrigin: `${cx}px ${top}px` } : undefined
                }
              >
                {badge({
                  cx,
                  top,
                  age: e.date
                    ? shortAge(
                        Math.max(
                          0,
                          ageInMonths(ageOrigin(baby, e.date), e.date),
                        ),
                      )
                    : "?",
                  index: i,
                })}
              </g>
              <text
                x={cx}
                y={top + 112}
                textAnchor="middle"
                style={text(12.5, color, 800)}
              >
                {title}
              </text>
              <text
                x={cx}
                y={top + 128}
                textAnchor="middle"
                style={text(11.5, muted, 500)}
              >
                {formatEntryDate(e.date, e.datePrecision).replace(
                  "Date not remembered",
                  "Date not sure",
                )}
              </text>
            </g>
          );
        })}
      </svg>
      {entries.length > shown.length && (
        <Typography
          color="text.secondary"
          sx={{ textAlign: "center" }}
          aria-hidden
        >
          and {entries.length - shown.length} earlier{" "}
          {entries.length - shown.length === 1 ? "first" : "firsts"}
        </Typography>
      )}
    </Stack>
  );
}

// --- Siblings ------------------------------------------------------------------

/**
 * Two children, each with their own drawing under their name, drawn by the
 * theme's own growth slot. Side by side would halve every label; one above
 * the other keeps both readable on a phone.
 */
export function StackedSiblings({
  measure,
  series,
  Growth,
}: SiblingsSlotProps & { Growth: (p: GrowthSlotProps) => ReactNode }) {
  return (
    <Stack spacing={2}>
      {series.map((s) => (
        <Stack key={s.baby.id} spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }} aria-hidden>
            {s.baby.name}
          </Typography>
          {s.points.length ? (
            <Growth baby={s.baby} measure={measure} points={s.points} />
          ) : (
            <Typography color="text.secondary" aria-hidden>
              No measurements yet.
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
