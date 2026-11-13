'use client';

import Stack from '@mui/material/Stack';
import type { CSSProperties } from 'react';
import { formatMeasure, formatWeight, type GrowthPoint } from '@/lib/growth/insights';
import { useTokens } from '../Providers';
import { SiblingLegend } from './classic';
import { svgProps, W, wobble } from './drawing';
import { f1, makeRings, radiusScale, RingDiagram, ringPath, ringPoint, TAU, useFreshPoints, type RingFrame } from './kit';
import { shortAge } from './summaries';
import type { GrowthSlotProps, SiblingsSlotProps } from './types';

// The Nursery Shelf's head and weight drawings. Length stays a doorframe
// (nursery.tsx); a head is measured around, so it grows rings like a tree,
// and a weight is read off a scale.

const H = 300;

// --- Tree rings (head) ---------------------------------------------------------

// Sized so the widest lobe and its bark clear both the left edge and the labels.
const TREE = { cx: 112, cy: 150, rOut: 90, rIn: 22, bark: 9 };
/**
 * One cross-section: bark, then each reading as a band of wood from the
 * outside in, alternating light and dark like early and late wood, with a
 * drying crack for character. The outermost ring is the newest growth, and
 * when it's new it grows out from under the bark.
 */
export function Trunk({ trunk, points, radius, freshId }: { trunk: RingFrame; points: GrowthPoint[]; radius: (v: number) => number; freshId?: string }) {
  const { art } = useTokens();
  const rings = [...points].sort((a, b) => b.value - a.value);
  const outer = rings[0];
  const barkPath = ringPath(trunk, trunk.rOut + TREE.bark * (trunk.rOut / TREE.rOut), 'bark');
  const crackA = wobble(`${trunk.cx}:crack`) * Math.PI;
  const [kx, ky] = ringPoint(trunk, trunk.rOut + 2, crackA, 'bark');
  const [jx, jy] = ringPoint(trunk, trunk.rOut * 0.45, crackA + 0.05, 'bark');
  const band = (p: GrowthPoint, i: number) => <path key={p.id} d={ringPath(trunk, radius(p.value), p.id)} fill={i % 2 ? art.woodLight : art.wood} stroke={art.woodDark} strokeWidth={p === outer ? 1.8 : 1.2} />;
  const growing = outer && outer.id === freshId;
  const origin: CSSProperties = { transformOrigin: `${trunk.cx}px ${trunk.cy}px` };
  return (
    <g>
      <g className={growing ? 'ls-grow' : undefined} style={growing ? origin : undefined}>
        <path d={barkPath} fill={art.bark} />
        {Array.from({ length: 56 }, (_, i) => {
          const a = (i / 56) * TAU + wobble(`b${i}`) * 0.04;
          const [x1, y1] = ringPoint(trunk, trunk.rOut + 2, a, 'bark');
          const [x2, y2] = ringPoint(trunk, trunk.rOut + TREE.bark * 0.8 * (trunk.rOut / TREE.rOut), a, 'bark');
          return <line key={i} x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke={art.woodDark} strokeWidth={1.2} opacity={0.55} />;
        })}
        {outer ? band(outer, 0) : <path d={ringPath(trunk, trunk.rOut, 'empty')} fill={art.wood} />}
      </g>
      {rings.slice(1).map((p, i) => band(p, i + 1))}
      <path d={`M${f1(kx)},${f1(ky)} L${f1(jx)},${f1(jy)}`} stroke={art.bark} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
      <circle cx={f1(trunk.core.x)} cy={f1(trunk.core.y)} r={2.5} fill={art.woodDark} />
    </g>
  );
}

function TreeRings({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const trunk = makeRings(baby.id, TREE.cx, TREE.cy, TREE.rOut);
  const radius = points.length ? radiusScale(points.map((p) => p.value), TREE.rIn, TREE.rOut) : () => TREE.rOut;
  const lastId = points[points.length - 1]?.id;
  return (
    <RingDiagram frame={trunk} points={points} measure={measure} radius={radius} color={art.pencil} fresh={fresh} background={<rect x={0} y={0} width={W} height={H} rx={18} fill={art.wall} />}>
      <Trunk trunk={trunk} points={points} radius={radius} freshId={lastId && fresh.has(lastId) ? lastId : undefined} />
    </RingDiagram>
  );
}

function SiblingTrees({ measure, series }: SiblingsSlotProps) {
  const { art, ls } = useTokens();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const r = 74;
  const radius = values.length ? radiusScale(values, 18, r) : () => r;
  const colors = [ls.primary, ls.tertiary];
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} 230`} {...svgProps}>
        <rect x={0} y={0} width={W} height={230} rx={18} fill={art.wall} />
        {series.map((s, i) => {
          const cx = i === 0 ? 88 : 252;
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.baby.id}>
              <Trunk trunk={makeRings(s.baby.id, cx, 100, s.points.length ? radius(Math.max(...s.points.map((p) => p.value))) : r)} points={s.points} radius={radius} />
              {last && (
                <text x={cx} y={215} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 800, fill: colors[i], fontFamily: 'inherit' }}>
                  {shortAge(last.ageMonths)} · {formatMeasure(measure, last.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <SiblingLegend names={series.map((s) => s.baby.name)} />
    </Stack>
  );
}

// --- Scale (weight) ------------------------------------------------------------

const DIAL = { cx: 170, cy: 176, r: 100 };
// 240 degrees, not 270: it lifts 0 and the top number clear of the reading under the hub.
const SWEEP = 240;
// Ages pencilled round the rim stay this many degrees apart; older ones go without.
const RIM_LABEL_GAP = 17;

/** The dial runs from 0 to a round number of pounds just past the heaviest reading. */
function dialMax(maxOz: number): number {
  const lb = maxOz / 16;
  const step = 5;
  let top = Math.max(10, Math.ceil(lb / step) * step);
  if (lb > top * 0.94) top += step;
  return top;
}

/** Degrees clockwise from 12 o'clock: 0 lb at the lower left, the top of the dial at the lower right. */
const angleOf = (oz: number, max: number) => -SWEEP / 2 + (Math.min(oz / 16, max) / max) * SWEEP;
function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [DIAL.cx + r * Math.sin(a), DIAL.cy - r * Math.cos(a)];
}

function ScaleBody({ max }: { max: number }) {
  const { art, ls } = useTokens();
  const numberEvery = max <= 15 ? 1 : 5;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} rx={18} fill={art.wall} />
      {/* The pan a baby lies in, on a short post. */}
      <rect x={DIAL.cx - 9} y={30} width={18} height={24} fill={art.lid} />
      <path d={`M40,14 Q${DIAL.cx},48 300,14 L292,30 Q${DIAL.cx},60 48,30 Z`} fill={art.lid} />
      <rect x={14} y={48} width={W - 28} height={H - 56} rx={44} fill={art.enamel} />
      <circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.r + 10} fill={art.lid} />
      <circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.r + 4} fill={art.face} />
      {Array.from({ length: max + 1 }, (_, lb) => {
        const deg = angleOf(lb * 16, max);
        const major = lb % numberEvery === 0;
        const [x1, y1] = polar(deg, DIAL.r);
        const [x2, y2] = polar(deg, DIAL.r - (major ? 13 : 7));
        const [tx, ty] = polar(deg, DIAL.r - 26);
        return (
          <g key={lb}>
            <line x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke={art.pencil} strokeWidth={major ? 2 : 1.1} />
            {major && (
              <text x={f1(tx)} y={f1(ty + 4.5)} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: ls.onSurface, fontFamily: 'inherit' }}>
                {lb}
              </text>
            )}
          </g>
        );
      })}
      <text x={DIAL.cx} y={DIAL.cy - 34} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: ls.onSurfaceVariant, fontFamily: 'inherit' }}>
        lb
      </text>
    </g>
  );
}

/** A tapered needle at `oz`. When `from` is given it swings up from there, overshoots and settles. */
function Needle({ oz, max, color, from, thin }: { oz: number; max: number; color: string; from?: number; thin?: boolean }) {
  const deg = angleOf(oz, max);
  const half = thin ? 2.2 : 3.4;
  const swing = from !== undefined ? deg - angleOf(from, max) : 0;
  const style = { transformOrigin: `${DIAL.cx}px ${DIAL.cy}px`, '--swing-from': `${-swing}deg` } as CSSProperties;
  return (
    <g transform={`rotate(${f1(deg)} ${DIAL.cx} ${DIAL.cy})`}>
      <g className={swing ? 'ls-needle' : undefined} style={swing ? style : undefined}>
        <path d={`M${DIAL.cx - half},${DIAL.cy + 16} L${DIAL.cx},${DIAL.cy - DIAL.r + 10} L${DIAL.cx + half},${DIAL.cy + 16} Z`} fill={color} />
      </g>
    </g>
  );
}

function Hub() {
  const { art } = useTokens();
  return <circle cx={DIAL.cx} cy={DIAL.cy} r={8} fill={art.lid} stroke={art.woodDark} strokeWidth={1.5} />;
}

function ScaleDial({ baby, measure, points }: GrowthSlotProps) {
  const { art, ls } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const max = dialMax(Math.max(160, ...points.map((p) => p.value)));
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  // Earlier readings are pencil ticks on the rim, newest first, each with its age if there's room.
  const placed: number[] = [];
  const earlier = points.slice(0, -1).reverse();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...svgProps}>
      <ScaleBody max={max} />
      {earlier.map((p) => {
        const deg = angleOf(p.value, max);
        const [x1, y1] = polar(deg, DIAL.r + 3);
        const [x2, y2] = polar(deg, DIAL.r - 5);
        const roomy = placed.every((other) => Math.abs(other - deg) >= RIM_LABEL_GAP);
        if (roomy) placed.push(deg);
        const [tx, ty] = polar(deg, DIAL.r + 19);
        const anchor = Math.abs(deg) < 12 ? 'middle' : deg > 0 ? 'start' : 'end';
        return (
          <g key={p.id}>
            <line x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke={art.pencil} strokeWidth={2.2} strokeLinecap="round" opacity={0.75} />
            {roomy && (
              <text x={f1(tx)} y={f1(ty + 4)} textAnchor={anchor} style={{ fontSize: 11.5, fontWeight: 700, fill: art.pencil, fontFamily: 'inherit' }}>
                {shortAge(p.ageMonths)}
              </text>
            )}
          </g>
        );
      })}
      {last && <Needle oz={last.value} max={max} color={art.needle} from={fresh.has(last.id) ? (prev?.value ?? 0) : undefined} />}
      <Hub />
      {last && (
        <g className={fresh.has(last.id) ? 'ls-pop' : undefined} style={{ transformOrigin: '50% 50%' }}>
          <text x={DIAL.cx} y={DIAL.cy + 56} textAnchor="middle" style={{ fontSize: 19, fontWeight: 800, fill: ls.onSurface, fontFamily: 'inherit' }}>
            {formatWeight(last.value)}
          </text>
          <text x={DIAL.cx} y={DIAL.cy + 73} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: ls.onSurfaceVariant, fontFamily: 'inherit' }}>
            at {shortAge(last.ageMonths)}
          </text>
        </g>
      )}
    </svg>
  );
}

function SiblingScale({ series }: SiblingsSlotProps) {
  const { ls } = useTokens();
  const max = dialMax(Math.max(160, ...series.flatMap((s) => s.points.map((p) => p.value))));
  const colors = [ls.primary, ls.tertiary];
  return (
    <Stack spacing={1}>
      <svg viewBox={`0 0 ${W} ${H}`} {...svgProps}>
        <ScaleBody max={max} />
        {series.map((s, i) => {
          const last = s.points[s.points.length - 1];
          return last && <Needle key={s.baby.id} oz={last.value} max={max} color={colors[i]} thin={i === 1} />;
        })}
        <Hub />
        {series.map((s, i) => {
          const last = s.points[s.points.length - 1];
          return (
            last && (
              <text key={s.baby.id} x={DIAL.cx} y={DIAL.cy + 54 + i * 18} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: colors[i], fontFamily: 'inherit' }}>
                {formatWeight(last.value)} at {shortAge(last.ageMonths)}
              </text>
            )
          );
        })}
      </svg>
      <SiblingLegend names={series.map((s) => s.baby.name)} />
    </Stack>
  );
}

export { ScaleDial, SiblingScale, SiblingTrees, TreeRings };
