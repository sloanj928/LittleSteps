"use client";

import { useTokens } from "../Providers";
import type { Art } from "../theme/palettes";
import { svgProps, W, wobble } from "./drawing";
import {
  BadgeRows,
  CountBadge,
  f1,
  starPath,
  GroupGrid,
  heightScale,
  LetterField,
  makeRings,
  PencilMarks,
  radiusScale,
  RingDiagram,
  ringPath,
  ringPoint,
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

// Space: the record as a night sky. Length is a rocket climbing its launch
// tower, weight a moon filling out, head size planets on wider and wider
// orbits; foods are planets, words are stars, firsts are ringed planets.
// The sky is dark in light mode too: it's artwork, not a surface.

const PLANET_FILLS: (keyof Art)[] = [
  "fruit",
  "dairy",
  "grain",
  "vegetable",
  "other",
  "protein",
];

/** A night sky with a scatter of stars, the same stars every time. */
function Sky({ h }: { h: number }) {
  const { art } = useTokens();
  const stars = Math.round((W * h) / 2600);
  return (
    <g>
      <rect x={0} y={0} width={W} height={h} rx={18} fill={art.night} />
      {Array.from({ length: stars }, (_, i) => {
        const x = ((wobble(`sx${i}`) + 1) / 2) * W;
        const y = ((wobble(`sy${i}`) + 1) / 2) * h;
        const r = 0.6 + ((wobble(`sr${i}`) + 1) / 2) * 1.1;
        return (
          <circle
            key={i}
            cx={f1(x)}
            cy={f1(y)}
            r={f1(r)}
            fill={art.star}
            opacity={0.35 + ((wobble(`so${i}`) + 1) / 2) * 0.5}
          />
        );
      })}
    </g>
  );
}

// --- Length: a rocket on its launch tower -----------------------------------------

const TOWER = { h: 300, top: 40, bottom: 268, x: 70, w: 36 };

function RocketTower({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const y = points.length
    ? heightScale(
        points.map((p) => p.value),
        TOWER.top,
        TOWER.bottom,
      )
    : () => TOWER.bottom;
  const last = points[points.length - 1];
  const nose = last ? y(last.value) : TOWER.bottom - 60;
  const rx = 38;
  const launching = last && fresh.has(last.id);
  return (
    <svg viewBox={`0 0 ${W} ${TOWER.h}`} {...svgProps}>
      <Sky h={TOWER.h} />
      <rect
        x={0}
        y={TOWER.bottom}
        width={W}
        height={TOWER.h - TOWER.bottom}
        fill={art.nightLight}
      />
      {/* The tower: two rails and zigzag bracing, all the way up. */}
      <rect
        x={TOWER.x}
        y={20}
        width={4}
        height={TOWER.bottom - 20}
        fill={art.lid}
      />
      <rect
        x={TOWER.x + TOWER.w - 4}
        y={20}
        width={4}
        height={TOWER.bottom - 20}
        fill={art.lid}
      />
      <path
        d={Array.from(
          { length: 12 },
          (_, i) =>
            `M${TOWER.x + 2},${20 + i * 21} L${TOWER.x + TOWER.w - 2},${30 + i * 21} L${TOWER.x + 2},${41 + i * 21}`,
        ).join(" ")}
        stroke={art.lid}
        strokeWidth={1.5}
        fill="none"
        opacity={0.7}
      />
      {/* The rocket, its nose at the latest height; it lifts in when that's new. */}
      <g className={launching ? "ls-hop" : undefined}>
        <path
          d={`M${rx},${nose} q11,14 11,34 v${Math.max(10, TOWER.bottom - nose - 46)} h-22 v-${Math.max(10, TOWER.bottom - nose - 46)} q0,-20 11,-34 Z`}
          fill={art.face}
        />
        <circle
          cx={rx}
          cy={nose + 30}
          r={5}
          fill={art.dairy}
          stroke={art.lid}
          strokeWidth={1.5}
        />
        <path
          d={`M${rx - 11},${TOWER.bottom - 22} l-8,14 h8 Z M${rx + 11},${TOWER.bottom - 22} l8,14 h-8 Z`}
          fill={art.needle}
        />
        <path
          d={`M${rx - 7},${TOWER.bottom - 12} q7,16 14,0 Z`}
          fill={art.star}
        />
      </g>
      <PencilMarks
        points={points}
        measure={measure}
        y={y}
        x1={TOWER.x + 4}
        x2={TOWER.x + TOWER.w - 4}
        labelX={TOWER.x + TOWER.w + 12}
        anchor="start"
        color={art.onNight}
        fresh={fresh}
      />
    </svg>
  );
}

// --- Weight: a moon filling out -----------------------------------------------------

/** A moon lit from the right: `k` is how much of it is lit, a crescent at 0.2 and full at 1. */
function Moon({
  cx,
  cy,
  r,
  k,
}: {
  cx: number;
  cy: number;
  r: number;
  k: number;
}) {
  const { art } = useTokens();
  const rx = r * Math.abs(1 - 2 * k);
  // Bottom to top, the edge of the light bulges right for a crescent and left past half.
  const lit =
    k >= 0.999
      ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx},${cy + r} A${r},${r} 0 1 1 ${cx},${cy - r} Z`
      : `M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r} A${f1(rx)},${r} 0 0 ${k < 0.5 ? 0 : 1} ${cx},${cy - r} Z`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={art.nightLight} />
      <path d={lit} fill={art.star} />
      <circle
        cx={cx - r * 0.25}
        cy={cy - r * 0.2}
        r={r * 0.14}
        fill={art.ink}
        opacity={0.08}
      />
      <circle
        cx={cx + r * 0.3}
        cy={cy + r * 0.3}
        r={r * 0.1}
        fill={art.ink}
        opacity={0.08}
      />
    </g>
  );
}

function Moons(props: GrowthSlotProps) {
  const { art } = useTokens();
  return (
    <TokenRows
      {...props}
      color={art.onNight}
      muted={art.star}
      background={(h) => <Sky h={h} />}
      token={({ cx, top, size }) => (
        <Moon cx={cx} cy={top + 40} r={24} k={0.2 + size * 0.8} />
      )}
    />
  );
}

// --- Head: planets on wider and wider orbits ---------------------------------------

const ORBITS = { cx: 112, cy: 150, rOut: 100, rIn: 26 };

function Orbits({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const frame = makeRings(baby.id, ORBITS.cx, ORBITS.cy, ORBITS.rOut, {
    lumpy: 0.12,
    squash: 0.62,
    offCentre: 0,
    jitter: 0,
  });
  const radius = points.length
    ? radiusScale(
        points.map((p) => p.value),
        ORBITS.rIn,
        ORBITS.rOut,
      )
    : () => ORBITS.rOut;
  const lastId = points[points.length - 1]?.id;
  return (
    <RingDiagram
      frame={frame}
      points={points}
      measure={measure}
      radius={radius}
      color={art.onNight}
      fresh={fresh}
      background={<Sky h={300} />}
    >
      <circle
        cx={ORBITS.cx}
        cy={ORBITS.cy}
        r={20}
        fill={art.gold}
        opacity={0.25}
      />
      <circle cx={ORBITS.cx} cy={ORBITS.cy} r={13} fill={art.gold} />
      {points.map((p, i) => {
        const r = radius(p.value);
        const newest = p.id === lastId;
        // Each planet sits somewhere on its orbit, the same place every time, never under the labels' leaders.
        const a = Math.PI * (0.55 + 0.8 * ((wobble(p.id) + 1) / 2));
        const [px, py] = ringPoint(frame, r, a, p.id);
        return (
          <g key={p.id}>
            <path
              d={ringPath(frame, r, p.id)}
              fill="none"
              stroke={art.onNight}
              strokeWidth={newest ? 1.6 : 1}
              strokeDasharray={newest ? undefined : "3 4"}
              opacity={newest ? 0.9 : 0.5}
            />
            <circle
              cx={f1(px)}
              cy={f1(py)}
              r={4 + (r / ORBITS.rOut) * 5}
              fill={art[PLANET_FILLS[i % PLANET_FILLS.length]]}
              className={fresh.has(p.id) ? "ls-grow" : undefined}
              style={
                fresh.has(p.id)
                  ? { transformOrigin: `${f1(px)}px ${f1(py)}px` }
                  : undefined
              }
            />
          </g>
        );
      })}
    </RingDiagram>
  );
}

function Growth(props: GrowthSlotProps) {
  if (props.measure === "weight") return <Moons {...props} />;
  if (props.measure === "head") return <Orbits {...props} />;
  return <RocketTower {...props} />;
}

// --- Foods: planets, bigger as each group fills ------------------------------------

function Foods(props: EntriesSlotProps) {
  const { art } = useTokens();
  return (
    <GroupGrid
      {...props}
      labelColor={art.onNight}
      background={(h) => <Sky h={h} />}
      item={({ group, count, level, cx, top }) => {
        const r = count ? 14 + level * 24 : 12;
        const cy = top + 48;
        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={count ? art[group] : "none"}
              stroke={count ? "none" : art.onNight}
              strokeDasharray="3 4"
              opacity={count ? 1 : 0.6}
            />
            {count > 0 && (
              <path
                d={`M${cx - r * 0.7},${cy - r * 0.35} q${r * 0.7},${r * 0.25} ${r * 1.4},0`}
                stroke={art.ink}
                strokeWidth={1.2}
                fill="none"
                opacity={0.15}
              />
            )}
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              style={{
                fontSize: 17,
                fontWeight: 800,
                fill: count ? art.ink : art.onNight,
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

// --- Words: a star per letter ------------------------------------------------------

function Words(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <LetterField
      {...props}
      labelColor={art.onNight}
      background={(h) => <Sky h={h} />}
      item={({ letter, count, x, y, size }) => (
        <g>
          <path
            d={starPath(
              x + size / 2,
              y + size / 2 + 2,
              size * 0.56,
              size * 0.3,
            )}
            fill={art.star}
          />
          <text
            x={x + size / 2}
            y={y + size / 2 + 8}
            textAnchor="middle"
            style={{
              fontSize: 15,
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
      )}
    />
  );
}

// --- Firsts: ringed planets ---------------------------------------------------------

function Firsts(props: EntriesSlotProps) {
  const { art } = useTokens();
  return (
    <BadgeRows
      {...props}
      color={art.onNight}
      muted={art.star}
      background={(h) => <Sky h={h} />}
      badge={({ cx, top, age, index }) => {
        const cy = top + 48;
        const fill = art[PLANET_FILLS[index % PLANET_FILLS.length]];
        return (
          <g>
            <ellipse
              cx={cx}
              cy={cy}
              rx={42}
              ry={11}
              fill="none"
              stroke={art.gold}
              strokeWidth={4}
              transform={`rotate(-14 ${cx} ${cy})`}
            />
            <circle cx={cx} cy={cy} r={27} fill={fill} />
            {/* The ring's near half passes in front of the planet. */}
            <path
              d={`M${cx - 42},${cy} A42,11 0 0 0 ${cx + 42},${cy}`}
              fill="none"
              stroke={art.gold}
              strokeWidth={4}
              transform={`rotate(-14 ${cx} ${cy})`}
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              style={{
                fontSize: 11,
                fontWeight: 800,
                fill: art.ink,
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

export const spaceTheme: DisplayTheme = {
  id: "space",
  name: "Space",
  description: "A rocket, a filling moon and orbits, with planets and stars.",
  Growth,
  Foods,
  Words,
  Firsts,
  Siblings,
};
