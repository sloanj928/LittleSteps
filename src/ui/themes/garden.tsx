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
  PencilMarks,
  StackedSiblings,
  TokenRows,
  useFreshPoints,
} from "./kit";
import { TreeRings } from "./nurseryGrowth";
import type {
  DisplayTheme,
  EntriesSlotProps,
  GrowthSlotProps,
  SiblingsSlotProps,
} from "./types";

// Garden: the record grown outdoors. Length is a sunflower against the
// fence, weight a row of pumpkins, head size the rings of a tree; foods
// are pots filling with plants, words are flowers, firsts are garden
// markers.

const FLOWER_FILLS: (keyof Art)[] = [
  "fruit",
  "dairy",
  "grain",
  "other",
  "protein",
  "petal",
];

/** Sky above a strip of grass along the bottom. */
function Meadow({ h, ground = 22 }: { h: number; ground?: number }) {
  const { art } = useTokens();
  return (
    <g>
      <rect x={0} y={0} width={W} height={h} rx={18} fill={art.sky} />
      <path
        d={`M0,${h - ground} ${Array.from({ length: W / 20 }, (_, i) => `Q${i * 20 + 10},${h - ground - 4 - wobble(`g${i}`) * 3} ${(i + 1) * 20},${h - ground}`).join(" ")} V${h - 18} Q${W},${h} ${W - 18},${h} H18 Q0,${h} 0,${h - 18} Z`}
        fill={art.grass}
      />
    </g>
  );
}

// --- Length: a sunflower against the fence ----------------------------------------

const FENCE = { h: 300, top: 46, bottom: 268, x: 74, w: 40 };

function Sunflower({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const y = points.length
    ? heightScale(
        points.map((p) => p.value),
        FENCE.top,
        FENCE.bottom,
      )
    : () => FENCE.bottom;
  const last = points[points.length - 1];
  const head = last ? y(last.value) : FENCE.bottom - 60;
  const sx = 38;
  const blooming = last && fresh.has(last.id);
  return (
    <svg viewBox={`0 0 ${W} ${FENCE.h}`} {...svgProps}>
      <Meadow h={FENCE.h} ground={FENCE.h - FENCE.bottom} />
      {/* Two pickets and their rails, standing higher than any mark. */}
      {[FENCE.x, FENCE.x + FENCE.w - 16].map((x) => (
        <path
          key={x}
          d={`M${x},${FENCE.bottom} V30 l8,-10 l8,10 V${FENCE.bottom} Z`}
          fill={art.woodLight}
          stroke={art.woodDark}
          strokeWidth={1}
        />
      ))}
      <rect
        x={FENCE.x - 6}
        y={80}
        width={FENCE.w + 12}
        height={8}
        fill={art.wood}
      />
      <rect
        x={FENCE.x - 6}
        y={200}
        width={FENCE.w + 12}
        height={8}
        fill={art.wood}
      />
      {/* The stem, with a leaf at every earlier height. */}
      <path
        d={`M${sx},${FENCE.bottom} C${sx - 6},${(FENCE.bottom + head) / 2} ${sx + 6},${(FENCE.bottom + head) / 2} ${sx},${head + 12}`}
        stroke={art.grassDark}
        strokeWidth={4}
        fill="none"
      />
      {points.slice(0, -1).map((p, i) => {
        const ly = y(p.value);
        const side = i % 2 ? 1 : -1;
        return (
          <path
            key={p.id}
            d={`M${sx},${f1(ly)} q${side * 10},-12 ${side * 20},-4 q${-side * 8},10 ${-side * 20},4 Z`}
            fill={art.grassDark}
          />
        );
      })}
      <g
        className={blooming ? "ls-grow" : undefined}
        style={blooming ? { transformOrigin: `${sx}px ${head}px` } : undefined}
      >
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <ellipse
              key={i}
              cx={f1(sx + Math.cos(a) * 13)}
              cy={f1(head + Math.sin(a) * 13)}
              rx={8}
              ry={4}
              fill={art.petal}
              transform={`rotate(${f1((a * 180) / Math.PI)} ${f1(sx + Math.cos(a) * 13)} ${f1(head + Math.sin(a) * 13)})`}
            />
          );
        })}
        <circle cx={sx} cy={head} r={10} fill={art.soil} />
      </g>
      <PencilMarks
        points={points}
        measure={measure}
        y={y}
        x1={FENCE.x + 2}
        x2={FENCE.x + FENCE.w - 2}
        labelX={FENCE.x + FENCE.w + 12}
        anchor="start"
        color={art.pencil}
        fresh={fresh}
      />
    </svg>
  );
}

// --- Weight: pumpkins in a row ------------------------------------------------------

function Pumpkins(props: GrowthSlotProps) {
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
          y={y + 80}
          width={W - 24}
          height={8}
          rx={4}
          fill={art.grass}
        />
      )}
      token={({ cx, top, size }) => {
        const w = 26 + size * 30;
        const h = w * 0.72;
        const base = top + 70;
        return (
          <g>
            <path
              d={`M${cx},${base - h + 2} q2,-8 7,-10`}
              stroke={art.grassDark}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
            {[-0.32, 0.32, 0].map((o) => (
              <ellipse
                key={o}
                cx={cx + o * w}
                cy={base - h / 2}
                rx={w * (o ? 0.3 : 0.32)}
                ry={h / 2}
                fill={art.grain}
                stroke={art.soil}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            ))}
          </g>
        );
      }}
    />
  );
}

function Growth(props: GrowthSlotProps) {
  if (props.measure === "weight") return <Pumpkins {...props} />;
  if (props.measure === "head") return <TreeRings {...props} />;
  return <Sunflower {...props} />;
}

// --- Foods: pots, a taller plant as each group fills -------------------------------

function Foods(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <GroupGrid
      {...props}
      labelColor={ls.onSurface}
      background={(h) => (
        <rect x={0} y={0} width={W} height={h} rx={18} fill={art.sky} />
      )}
      item={({ group, count, level, cx, top }) => {
        const potTop = top + 58;
        const stem = level * 46;
        return (
          <g>
            {count > 0 && (
              <g>
                <path
                  d={`M${cx},${potTop} V${potTop - stem}`}
                  stroke={art.grassDark}
                  strokeWidth={3}
                />
                {Array.from({ length: Math.min(6, count) }, (_, i) => {
                  const ly =
                    potTop - stem * ((i + 1) / (Math.min(6, count) + 1));
                  const side = i % 2 ? 1 : -1;
                  return (
                    <path
                      key={i}
                      d={`M${cx},${f1(ly)} q${side * 9},-10 ${side * 17},-3 q${-side * 7},8 ${-side * 17},3 Z`}
                      fill={art.grass}
                    />
                  );
                })}
                <circle
                  cx={cx}
                  cy={potTop - stem - 4}
                  r={7}
                  fill={art[group]}
                />
              </g>
            )}
            <path
              d={`M${cx - 26},${potTop} h52 l-6,32 h-40 Z`}
              fill={art.soil}
            />
            <rect
              x={cx - 29}
              y={potTop - 4}
              width={58}
              height={9}
              rx={3}
              fill={art.soil}
            />
            <rect
              x={cx - 29}
              y={potTop - 4}
              width={58}
              height={9}
              rx={3}
              fill={art.ink}
              opacity={0.12}
            />
            <text
              x={cx}
              y={potTop + 23}
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

// --- Words: a flower per letter -----------------------------------------------------

function Words(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <LetterField
      {...props}
      labelColor={ls.onSurface}
      background={(h) => <Meadow h={h} ground={14} />}
      item={({ letter, count, x, y, size, index }) => {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const fill = art[FLOWER_FILLS[index % FLOWER_FILLS.length]];
        return (
          <g>
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <circle
                  key={i}
                  cx={f1(cx + Math.cos(a) * 12)}
                  cy={f1(cy + Math.sin(a) * 12)}
                  r={9}
                  fill={fill}
                />
              );
            })}
            <circle cx={cx} cy={cy} r={12} fill={art.face} />
            <text
              x={cx}
              y={cy + 5.5}
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
              x={x + size - 3}
              y={y + 3}
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

// --- Firsts: garden markers ---------------------------------------------------------

function Firsts(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <BadgeRows
      {...props}
      color={ls.onSurface}
      muted={ls.onSurfaceVariant}
      background={(h) => (
        <rect x={0} y={0} width={W} height={h} rx={18} fill={art.sky} />
      )}
      badge={({ cx, top, age, index }) => (
        <g>
          <rect
            x={cx - 3}
            y={top + 30}
            width={6}
            height={56}
            fill={art.woodDark}
          />
          <path d={`M${cx - 18},${top + 92} q18,-14 36,0 Z`} fill={art.grass} />
          <rect
            x={cx - 34}
            y={top + 8}
            width={68}
            height={36}
            rx={6}
            fill={art.woodLight}
            stroke={art.woodDark}
            strokeWidth={1.5}
            transform={`rotate(${f1(wobble(`m${index}`) * 4)} ${cx} ${top + 26})`}
          />
          <circle
            cx={cx - 22}
            cy={top + 26}
            r={5}
            fill={art[FLOWER_FILLS[index % FLOWER_FILLS.length]]}
          />
          <text
            x={cx + 5}
            y={top + 31}
            textAnchor="middle"
            style={{
              fontSize: 13,
              fontWeight: 800,
              fill: art.ink,
              fontFamily: "inherit",
            }}
          >
            {age}
          </text>
        </g>
      )}
    />
  );
}

function Siblings(props: SiblingsSlotProps) {
  return <StackedSiblings {...props} Growth={Growth} />;
}

export const gardenTheme: DisplayTheme = {
  id: "garden",
  name: "Garden",
  description:
    "A sunflower, pumpkins and tree rings, with pots, flowers and markers.",
  Growth,
  Foods,
  Words,
  Firsts,
  Siblings,
};
