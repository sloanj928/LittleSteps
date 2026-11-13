"use client";

import { useTokens } from "../Providers";
import type { Art } from "../theme/palettes";
import { svgProps, W, wobble } from "./drawing";
import {
  BadgeRows,
  CountBadge,
  f1,
  GroupGrid,
  heightScale,
  LetterField,
  makeRings,
  PencilMarks,
  radiusScale,
  RingDiagram,
  ringPath,
  StackedSiblings,
  TokenRows,
  useFreshPoints,
} from "./kit";
import type {
  DisplayTheme,
  EntriesSlotProps,
  GrowthSlotProps,
  SiblingsSlotProps,
} from "./types";

// Ocean: the record by the sea. Length is a lighthouse, weight a little
// boat sitting lower in the water, head size ripples spreading from a
// pebble; foods are fish, words are bubbles, firsts are shells.

const SEA_FILLS: (keyof Art)[] = [
  "fruit",
  "grain",
  "other",
  "protein",
  "dairy",
  "vegetable",
];

/** Water with a few drawn wave lines. */
function Sea({ h }: { h: number }) {
  const { art } = useTokens();
  return (
    <g>
      <rect x={0} y={0} width={W} height={h} rx={18} fill={art.water} />
      {Array.from({ length: Math.floor(h / 46) }, (_, i) => {
        const y = 30 + i * 46 + wobble(`w${i}`) * 6;
        const x = 20 + ((wobble(`wx${i}`) + 1) / 2) * (W - 90);
        return (
          <path
            key={i}
            d={`M${f1(x)},${f1(y)} q8,-5 16,0 t16,0`}
            stroke={art.foam}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
        );
      })}
    </g>
  );
}

// --- Length: a lighthouse ------------------------------------------------------------

const LIGHT = { h: 300, top: 50, bottom: 262, x: 66, w: 44 };

function Lighthouse({ baby, measure, points }: GrowthSlotProps) {
  const { art, ls } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const y = points.length
    ? heightScale(
        points.map((p) => p.value),
        LIGHT.top,
        LIGHT.bottom,
      )
    : () => LIGHT.bottom;
  const last = points[points.length - 1];
  const top = last ? y(last.value) : LIGHT.bottom - 80;
  const lit = last && fresh.has(last.id);
  // The tower narrows as it rises; its top is the latest length.
  const half = (yy: number) =>
    LIGHT.w / 2 - ((LIGHT.bottom - yy) / (LIGHT.bottom - LIGHT.top)) * 8;
  const cx = LIGHT.x + LIGHT.w / 2;
  const stripes = 6;
  return (
    <svg viewBox={`0 0 ${W} ${LIGHT.h}`} {...svgProps}>
      <rect x={0} y={0} width={W} height={LIGHT.h} rx={18} fill={art.sky} />
      <path
        d={`M0,${LIGHT.bottom} H${W} V${LIGHT.h - 18} Q${W},${LIGHT.h} ${W - 18},${LIGHT.h} H18 Q0,${LIGHT.h} 0,${LIGHT.h - 18} Z`}
        fill={art.water}
      />
      <path
        d={`M${cx - 40},${LIGHT.bottom + 6} q10,-16 40,-14 q30,-2 40,14 Z`}
        fill={art.lid}
      />
      {Array.from({ length: stripes }, (_, i) => {
        const y0 = LIGHT.bottom - ((LIGHT.bottom - top) * i) / stripes;
        const y1 = LIGHT.bottom - ((LIGHT.bottom - top) * (i + 1)) / stripes;
        return (
          <path
            key={i}
            d={`M${f1(cx - half(y0))},${f1(y0)} L${f1(cx - half(y1))},${f1(y1)} L${f1(cx + half(y1))},${f1(y1)} L${f1(cx + half(y0))},${f1(y0)} Z`}
            fill={i % 2 ? art.needle : art.onNight}
          />
        );
      })}
      <g
        className={lit ? "ls-grow" : undefined}
        style={lit ? { transformOrigin: `${cx}px ${top}px` } : undefined}
      >
        <circle cx={cx} cy={top - 14} r={22} fill={art.star} opacity={0.35} />
        <rect
          x={cx - 10}
          y={top - 22}
          width={20}
          height={20}
          rx={3}
          fill={art.star}
          stroke={ls.onSurface}
          strokeWidth={1.2}
        />
        <path
          d={`M${cx - 14},${top - 22} L${cx},${top - 34} L${cx + 14},${top - 22} Z`}
          fill={art.needle}
        />
        <rect
          x={cx - 15}
          y={top - 3}
          width={30}
          height={5}
          rx={2}
          fill={ls.onSurface}
        />
      </g>
      <PencilMarks
        points={points}
        measure={measure}
        y={y}
        x1={LIGHT.x + 8}
        x2={LIGHT.x + LIGHT.w - 8}
        labelX={LIGHT.x + LIGHT.w + 12}
        anchor="start"
        color={art.pencil}
        fresh={fresh}
      />
    </svg>
  );
}

// --- Weight: a boat sitting lower in the water -------------------------------------

function Boats(props: GrowthSlotProps) {
  const { art, ls } = useTokens();
  return (
    <TokenRows
      {...props}
      color={ls.onSurface}
      muted={ls.onSurfaceVariant}
      background={(h) => (
        <rect x={0} y={0} width={W} height={h} rx={18} fill={art.sky} />
      )}
      rail={(y) => (
        <rect
          x={12}
          y={y + 62}
          width={W - 24}
          height={26}
          rx={6}
          fill={art.water}
        />
      )}
      token={({ cx, top, size, index }) => {
        // Heavier sits lower: the hull dips further below the waterline.
        const water = top + 48;
        const sink = 3 + size * 12;
        const hullTop = water - 12 + sink;
        return (
          <g>
            <path
              d={`M${cx},${hullTop - 4} V${hullTop - 44} L${cx + 20},${hullTop - 8} Z`}
              fill={art.onNight}
              stroke={art.lid}
              strokeWidth={1}
            />
            <path
              d={`M${cx - 2},${hullTop - 4} V${hullTop - 36} L${cx - 16},${hullTop - 8} Z`}
              fill={art[SEA_FILLS[index % SEA_FILLS.length]]}
            />
            <path
              d={`M${cx - 24},${hullTop} h48 l-8,14 h-32 Z`}
              fill={art.wood}
              stroke={art.woodDark}
              strokeWidth={1}
            />
            {/* The water in front of the hull, so it really sits in it. */}
            <path
              d={`M${cx - 28},${water} q7,-3 14,0 t14,0 t14,0 t14,0 V${water + 18} H${cx - 28} Z`}
              fill={art.water}
              opacity={0.85}
            />
          </g>
        );
      }}
    />
  );
}

// --- Head: ripples from a pebble ---------------------------------------------------

const POND = { cx: 112, cy: 150, rOut: 100, rIn: 18 };

function Ripples({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const frame = makeRings(baby.id, POND.cx, POND.cy, POND.rOut, {
    lumpy: 0.45,
    squash: 0.8,
    offCentre: 0.04,
    jitter: 0.012,
  });
  const radius = points.length
    ? radiusScale(
        points.map((p) => p.value),
        POND.rIn,
        POND.rOut,
      )
    : () => POND.rOut;
  const lastId = points[points.length - 1]?.id;
  return (
    <RingDiagram
      frame={frame}
      points={points}
      measure={measure}
      radius={radius}
      color={art.pencil}
      fresh={fresh}
      background={<Sea h={300} />}
    >
      {points.map((p) => {
        const newest = p.id === lastId;
        const grow = fresh.has(p.id);
        return (
          <path
            key={p.id}
            d={ringPath(frame, radius(p.value), p.id)}
            fill="none"
            stroke={art.foam}
            strokeWidth={newest ? 2.6 : 1.6}
            opacity={newest ? 1 : 0.75}
            className={grow ? "ls-grow" : undefined}
            style={
              grow
                ? { transformOrigin: `${POND.cx}px ${POND.cy}px` }
                : undefined
            }
          />
        );
      })}
      <ellipse
        cx={frame.core.x}
        cy={frame.core.y}
        rx={7}
        ry={5}
        fill={art.lid}
      />
    </RingDiagram>
  );
}

function Growth(props: GrowthSlotProps) {
  if (props.measure === "weight") return <Boats {...props} />;
  if (props.measure === "head") return <Ripples {...props} />;
  return <Lighthouse {...props} />;
}

// --- Foods: fish, longer as each group fills ---------------------------------------

function Foods(props: EntriesSlotProps) {
  const { art } = useTokens();
  return (
    <GroupGrid
      {...props}
      labelColor={art.ink}
      background={(h) => <Sea h={h} />}
      item={({ group, count, level, cx, top }) => {
        const len = count ? 40 + level * 36 : 36;
        const cy = top + 50;
        const fill = count ? art[group] : "none";
        return (
          <g>
            <path
              d={`M${cx + len / 2 - 6},${cy} l14,-12 v24 Z`}
              fill={fill}
              stroke={count ? "none" : art.foam}
              strokeDasharray="3 4"
            />
            <ellipse
              cx={cx - 4}
              cy={cy}
              rx={len / 2}
              ry={len * 0.28}
              fill={fill}
              stroke={count ? "none" : art.foam}
              strokeDasharray="3 4"
            />
            <circle
              cx={cx - len / 2 + 7}
              cy={cy - 3}
              r={2.5}
              fill={art.ink}
              opacity={count ? 0.8 : 0.3}
            />
            <text
              x={cx - 2}
              y={cy + 6}
              textAnchor="middle"
              style={{
                fontSize: 16,
                fontWeight: 800,
                fill: art.ink,
                fontFamily: "inherit",
              }}
            >
              {count}
            </text>
          </g>
        );
      }}
    />
  );
}

// --- Words: a bubble per letter -----------------------------------------------------

function Words(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <LetterField
      {...props}
      labelColor={art.ink}
      background={(h) => <Sea h={h} />}
      item={({ letter, count, x, y, size }) => {
        const cx = x + size / 2;
        const cy = y + size / 2 + wobble(letter) * 3;
        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={size / 2 - 1}
              fill={art.foam}
              fillOpacity={0.35}
              stroke={art.foam}
              strokeWidth={2}
            />
            <path
              d={`M${cx - size * 0.28},${cy - size * 0.1} a${size * 0.3},${size * 0.3} 0 0 1 ${size * 0.18},-${size * 0.18}`}
              stroke={art.foam}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              style={{
                fontSize: 16,
                fontWeight: 800,
                fill: art.ink,
                fontFamily: "inherit",
              }}
            >
              {letter}
            </text>
            <CountBadge
              x={x + size - 4}
              y={y + 4}
              n={count}
              fill={ls.surface}
              ink={ls.onSurface}
            />
          </g>
        );
      }}
    />
  );
}

// --- Firsts: shells on the sand -----------------------------------------------------

function Firsts(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <BadgeRows
      {...props}
      color={ls.onSurface}
      muted={ls.onSurfaceVariant}
      background={(h) => (
        <rect x={0} y={0} width={W} height={h} rx={18} fill={art.sand} />
      )}
      badge={({ cx, top, age, index }) => {
        const fill = art[SEA_FILLS[index % SEA_FILLS.length]];
        const base = top + 80;
        return (
          <g>
            {/* A scallop: a fan of ribs over a small hinge. */}
            <path
              d={`M${cx - 36},${base - 30} Q${cx - 34},${top + 6} ${cx},${top + 6} Q${cx + 34},${top + 6} ${cx + 36},${base - 30} L${cx + 8},${base - 6} H${cx - 8} Z`}
              fill={fill}
            />
            {[-26, -13, 0, 13, 26].map((dx) => (
              <path
                key={dx}
                d={`M${cx},${base - 8} L${cx + dx},${top + 12}`}
                stroke={art.ink}
                strokeOpacity={0.18}
                strokeWidth={1.5}
              />
            ))}
            <path d={`M${cx - 12},${base - 6} h24 l-4,8 h-16 Z`} fill={fill} />
            <rect
              x={cx - 20}
              y={top + 28}
              width={40}
              height={18}
              rx={9}
              fill={ls.surface}
            />
            <text
              x={cx}
              y={top + 41}
              textAnchor="middle"
              style={{
                fontSize: 11,
                fontWeight: 800,
                fill: ls.onSurface,
                fontFamily: "inherit",
              }}
            >
              {age}
            </text>
          </g>
        );
      }}
    />
  );
}

function Siblings(props: SiblingsSlotProps) {
  return <StackedSiblings {...props} Growth={Growth} />;
}

export const oceanTheme: DisplayTheme = {
  id: "ocean",
  name: "Ocean",
  description:
    "A lighthouse, boats and ripples, with fish, bubbles and shells.",
  Growth,
  Foods,
  Words,
  Firsts,
  Siblings,
};
