"use client";

import { useId } from "react";
import { formatWeight } from "@/lib/growth/insights";
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
  LETTER_TOP,
  PencilMarks,
  StackedSiblings,
  starPath,
  TokenRows,
  useFreshPoints,
} from "./kit";
import { shortAge } from "./summaries";
import type {
  DisplayTheme,
  EntriesSlotProps,
  GrowthSlotProps,
  SiblingsSlotProps,
} from "./types";

// Storybook: the record as a picture book. Length is a giraffe beside a
// ruler, weight a seesaw balanced with toy blocks, head size knitted hats
// on a rack; foods fill bowls of porridge, words are books on a shelf,
// firsts are gold-star stickers.

const STORY_FILLS: (keyof Art)[] = [
  "fruit",
  "dairy",
  "grain",
  "vegetable",
  "other",
  "protein",
];

function Page({ h }: { h: number }) {
  const { art } = useTokens();
  return <rect x={0} y={0} width={W} height={h} rx={18} fill={art.paper} />;
}

// --- Length: a giraffe beside a ruler ----------------------------------------------

const RULER = { h: 300, top: 40, bottom: 270, x: 104, w: 20 };
// The giraffe's back is here, so its head can never come down below it.
const BACK = 214;

function Giraffe({ baby, measure, points }: GrowthSlotProps) {
  const { art } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const y = points.length
    ? heightScale(
        points.map((p) => p.value),
        RULER.top,
        RULER.bottom,
      )
    : () => RULER.bottom;
  const last = points[points.length - 1];
  const head = Math.min(BACK - 30, last ? y(last.value) : 120);
  const stretching = last && fresh.has(last.id);
  const spots = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    n: number,
    seed: string,
  ) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return (
        <ellipse
          key={i}
          cx={f1(x0 + (x1 - x0) * t + wobble(`${seed}${i}`) * 4)}
          cy={f1(y0 + (y1 - y0) * t)}
          rx={4.5}
          ry={3.5}
          fill={art.protein}
        />
      );
    });
  return (
    <svg viewBox={`0 0 ${W} ${RULER.h}`} {...svgProps}>
      <Page h={RULER.h} />
      <rect
        x={0}
        y={RULER.bottom}
        width={W}
        height={RULER.h - RULER.bottom}
        fill={art.grass}
        opacity={0.6}
      />
      {/* The ruler, with a tick every little way up. */}
      <rect
        x={RULER.x}
        y={24}
        width={RULER.w}
        height={RULER.bottom - 24}
        rx={3}
        fill={art.woodLight}
        stroke={art.woodDark}
        strokeWidth={1}
      />
      {Array.from({ length: 24 }, (_, i) => (
        <line
          key={i}
          x1={RULER.x}
          x2={RULER.x + (i % 4 ? 6 : 11)}
          y1={RULER.bottom - i * 10}
          y2={RULER.bottom - i * 10}
          stroke={art.woodDark}
          strokeWidth={1}
        />
      ))}
      {/* Legs, body, then a neck that reaches the latest height. */}
      {[30, 44, 70, 82].map((x) => (
        <rect
          key={x}
          x={x}
          y={BACK + 12}
          width={6}
          height={RULER.bottom - BACK - 12}
          rx={3}
          fill={art.grain}
        />
      ))}
      <ellipse cx={56} cy={BACK + 10} rx={34} ry={17} fill={art.grain} />
      {spots(32, BACK + 6, 80, BACK + 12, 4, "b")}
      <g className={stretching ? "ls-hop" : undefined}>
        <path
          d={`M70,${BACK} L78,${head + 6} L90,${head + 8} L84,${BACK + 4} Z`}
          fill={art.grain}
        />
        {spots(
          76,
          BACK - 10,
          82,
          head + 20,
          Math.max(2, Math.round((BACK - head) / 24)),
          "n",
        )}
        <ellipse cx={88} cy={head} rx={14} ry={8} fill={art.grain} />
        <line
          x1={82}
          y1={head - 6}
          x2={80}
          y2={head - 16}
          stroke={art.protein}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <line
          x1={88}
          y1={head - 7}
          x2={88}
          y2={head - 17}
          stroke={art.protein}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={91} cy={head - 2} r={1.8} fill={art.ink} />
      </g>
      <PencilMarks
        points={points}
        measure={measure}
        y={y}
        x1={RULER.x + 2}
        x2={RULER.x + RULER.w - 2}
        labelX={RULER.x + RULER.w + 12}
        anchor="start"
        color={art.pencil}
        fresh={fresh}
      />
    </svg>
  );
}

// --- Weight: a seesaw balanced with blocks -------------------------------------------

const SEESAW = { h: 250, pivotX: 170, plankY: 150, ground: 196 };
const BLOCK = 13;
// Rows of blocks from the plank up; past this many pounds each block is two.
const PILE = [8, 7, 6, 5, 4, 3, 2, 1];
const PILE_MAX = PILE.reduce((a, b) => a + b, 0);

function Seesaw({ baby, measure, points }: GrowthSlotProps) {
  const { art, ls } = useTokens();
  const fresh = useFreshPoints(baby, measure, points);
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const lb = last ? last.value / 16 : 0;
  const perBlock = lb > PILE_MAX ? 2 : 1;
  let blocks = Math.round(lb / perBlock);
  const pile: { x: number; y: number; i: number }[] = [];
  for (let r = 0; r < PILE.length && blocks > 0; r++) {
    const n = Math.min(PILE[r], blocks);
    for (let c = 0; c < n; c++)
      pile.push({
        x: 250 - (n * BLOCK) / 2 + c * BLOCK,
        y: SEESAW.plankY - (r + 1) * BLOCK,
        i: pile.length,
      });
    blocks -= n;
  }
  const teeter = last && fresh.has(last.id);
  const text = (size: number, fill: string, weight = 700) => ({
    fontSize: size,
    fontWeight: weight,
    fill,
    fontFamily: "inherit",
  });
  return (
    <svg viewBox={`0 0 ${W} ${SEESAW.h}`} {...svgProps}>
      <Page h={SEESAW.h} />
      <path
        d={`M${SEESAW.pivotX - 22},${SEESAW.ground} L${SEESAW.pivotX},${SEESAW.plankY + 6} L${SEESAW.pivotX + 22},${SEESAW.ground} Z`}
        fill={art.woodDark}
      />
      <rect
        x={20}
        y={SEESAW.ground}
        width={W - 40}
        height={4}
        rx={2}
        fill={art.woodLight}
      />
      <g
        className={teeter ? "ls-teeter" : undefined}
        style={
          teeter
            ? { transformOrigin: `${SEESAW.pivotX}px ${SEESAW.plankY + 6}px` }
            : undefined
        }
      >
        <rect
          x={34}
          y={SEESAW.plankY}
          width={W - 68}
          height={9}
          rx={4}
          fill={art.wood}
        />
        {/* A teddy stands in for the baby on the left. */}
        <g>
          <circle cx={84} cy={SEESAW.plankY - 22} r={20} fill={art.protein} />
          <circle cx={84} cy={SEESAW.plankY - 52} r={14} fill={art.protein} />
          <circle cx={73} cy={SEESAW.plankY - 63} r={5.5} fill={art.protein} />
          <circle cx={95} cy={SEESAW.plankY - 63} r={5.5} fill={art.protein} />
          <ellipse
            cx={84}
            cy={SEESAW.plankY - 47}
            rx={6}
            ry={4.5}
            fill={art.face}
          />
          <circle cx={79} cy={SEESAW.plankY - 55} r={1.6} fill={art.ink} />
          <circle cx={89} cy={SEESAW.plankY - 55} r={1.6} fill={art.ink} />
          <ellipse
            cx={84}
            cy={SEESAW.plankY - 20}
            rx={10}
            ry={9}
            fill={art.face}
            opacity={0.5}
          />
        </g>
        {pile.map((b) => (
          <rect
            key={b.i}
            x={b.x}
            y={b.y}
            width={BLOCK - 1.5}
            height={BLOCK - 1.5}
            rx={2}
            fill={art[STORY_FILLS[(b.i * 7) % STORY_FILLS.length]]}
            stroke={art.ink}
            strokeOpacity={0.2}
          />
        ))}
      </g>
      {last ? (
        <g>
          <text
            x={SEESAW.pivotX}
            y={SEESAW.ground + 26}
            textAnchor="middle"
            style={text(17, ls.onSurface, 800)}
          >
            {formatWeight(last.value)} at {shortAge(last.ageMonths)}
          </text>
          <text
            x={SEESAW.pivotX}
            y={SEESAW.ground + 44}
            textAnchor="middle"
            style={text(12, ls.onSurfaceVariant, 600)}
          >
            {perBlock === 2 ? "Each block is 2 lb. " : "Each block is 1 lb. "}
            {prev
              ? `Last time ${formatWeight(prev.value)} at ${shortAge(prev.ageMonths)}.`
              : ""}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

// --- Head: knitted hats on a rack ----------------------------------------------------

function Hats(props: GrowthSlotProps) {
  const { art, ls } = useTokens();
  // Clip ids must be unique on the page: siblings show two racks at once.
  const uid = useId();
  return (
    <TokenRows
      {...props}
      color={ls.onSurface}
      muted={ls.onSurfaceVariant}
      background={(h) => <Page h={h} />}
      rail={(y) => (
        <g>
          <rect
            x={12}
            y={y - 4}
            width={W - 24}
            height={14}
            rx={4}
            fill={art.wood}
          />
          <rect
            x={12}
            y={y + 7}
            width={W - 24}
            height={3}
            rx={1.5}
            fill={art.woodDark}
          />
          {[24, W - 24].map((x) => (
            <circle key={x} cx={x} cy={y + 3} r={2.2} fill={art.woodDark} />
          ))}
        </g>
      )}
      token={({ cx, top, size, index }) => {
        // The hat widens with head size; it hangs by a loop of yarn from a brass hook.
        const w = 28 + size * 24;
        const domeH = w * 0.62;
        const brimH = 10;
        const pom = 4 + w * 0.07;
        const fill = art[STORY_FILLS[index % STORY_FILLS.length]];
        const hookY = top - 4;
        const domeTop = top + 28;
        const brimY = domeTop + domeH;
        // A cubic dome peaks three quarters of the way up its control height; the pom-pom sits on the peak.
        const pomY = brimY - 0.75 * (domeH + 2) - pom * 0.55;
        const dome = `M${f1(cx - w / 2)},${f1(brimY)} C${f1(cx - w / 2)},${f1(domeTop - 2)} ${f1(cx + w / 2)},${f1(domeTop - 2)} ${f1(cx + w / 2)},${f1(brimY)} Z`;
        const id = `${uid}-hat-${index}`;
        let stitches = "";
        for (let sy = domeTop + 6; sy < brimY; sy += 6)
          for (let sx = cx - w / 2 - 3; sx < cx + w / 2 + 3; sx += 6)
            stitches += `M${f1(sx)},${f1(sy)} l3,3 l3,-3 `;
        let ribs = "";
        for (let rx = cx - w / 2 + 2; rx < cx + w / 2 + 1; rx += 3.5)
          ribs += `M${f1(rx)},${f1(brimY + 1.5)} v${brimH - 3} `;
        // The widest hat is 52px across, clear of its neighbours, and its brim ends 70px down, clear of the labels.
        return (
          <g
            transform={`rotate(${f1(wobble(`hat${index}`) * 5)} ${cx} ${hookY})`}
          >
            <path
              d={`M${cx},${hookY} v9 q0,7 -6,7 q-4,0 -4,-4`}
              stroke={art.lid}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M${cx},${hookY + 15} Q${cx - 5},${f1((hookY + 15 + pomY - pom) / 2)} ${cx},${f1(pomY - pom)}`}
              stroke={art.ink}
              strokeOpacity={0.5}
              strokeWidth={1.3}
              fill="none"
            />
            <clipPath id={id}>
              <path d={dome} />
            </clipPath>
            <path d={dome} fill={fill} />
            <path
              d={stitches}
              clipPath={`url(#${id})`}
              stroke={art.ink}
              strokeOpacity={0.18}
              strokeWidth={1}
              fill="none"
            />
            <rect
              x={cx - w / 2 - 2}
              y={brimY}
              width={w + 4}
              height={brimH}
              rx={4}
              fill={fill}
            />
            <rect
              x={cx - w / 2 - 2}
              y={brimY}
              width={w + 4}
              height={brimH}
              rx={4}
              fill={art.ink}
              fillOpacity={0.12}
            />
            <path
              d={ribs}
              stroke={art.ink}
              strokeOpacity={0.22}
              strokeWidth={1}
              fill="none"
            />
            <circle cx={cx} cy={f1(pomY)} r={f1(pom)} fill={fill} />
            <circle
              cx={cx}
              cy={f1(pomY)}
              r={f1(pom)}
              fill="none"
              stroke={art.ink}
              strokeOpacity={0.25}
              strokeDasharray="1.5 2"
            />
          </g>
        );
      }}
    />
  );
}

function Growth(props: GrowthSlotProps) {
  if (props.measure === "weight") return <Seesaw {...props} />;
  if (props.measure === "head") return <Hats {...props} />;
  return <Giraffe {...props} />;
}

// --- Foods: bowls of porridge -------------------------------------------------------

function Foods(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <GroupGrid
      {...props}
      labelColor={ls.onSurface}
      background={(h) => <Page h={h} />}
      item={({ group, count, level, cx, top }) => {
        const w = count ? 44 + level * 30 : 44;
        const rim = top + 56;
        return (
          <g>
            {count > 0 && (
              <line
                x1={cx + w * 0.15}
                y1={rim + 2}
                x2={cx + w * 0.42}
                y2={rim - 26}
                stroke={art.lid}
                strokeWidth={4}
                strokeLinecap="round"
              />
            )}
            <ellipse
              cx={cx}
              cy={rim}
              rx={w / 2}
              ry={7}
              fill={count ? art[group] : art.paper}
              stroke={art.lid}
              strokeWidth={1.5}
            />
            <path
              d={`M${cx - w / 2},${rim} A${w / 2},${w * 0.45} 0 0 0 ${cx + w / 2},${rim} Z`}
              fill={art.face}
              stroke={art.lid}
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={rim + 22}
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

// --- Words: books on a shelf ---------------------------------------------------------

const BOOK = 30;
const BOOK_GAP = 6;

function Words(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <LetterField
      {...props}
      labelColor={ls.onSurface}
      size={BOOK}
      gap={BOOK_GAP}
      background={(h) => {
        const rows = Math.max(
          1,
          Math.round((h - LETTER_TOP - 20) / (BOOK + BOOK_GAP)),
        );
        return (
          <g>
            <Page h={h} />
            {Array.from({ length: rows }, (_, r) => (
              <rect
                key={r}
                x={10}
                y={LETTER_TOP + r * (BOOK + BOOK_GAP) + BOOK}
                width={W - 20}
                height={5}
                rx={2}
                fill={art.wood}
              />
            ))}
          </g>
        );
      }}
      item={({ letter, count, x, y, size, index }) => {
        const tall = size * (0.82 + ((wobble(letter) + 1) / 2) * 0.18);
        const fill = art[STORY_FILLS[index % STORY_FILLS.length]];
        return (
          <g>
            <rect
              x={x + 2}
              y={y + size - tall}
              width={size - 4}
              height={tall}
              rx={2}
              fill={fill}
            />
            <rect
              x={x + 2}
              y={y + size - tall + 4}
              width={size - 4}
              height={2.5}
              fill={art.ink}
              opacity={0.2}
            />
            <rect
              x={x + 2}
              y={y + size - 7}
              width={size - 4}
              height={2.5}
              fill={art.ink}
              opacity={0.2}
            />
            <text
              x={x + size / 2}
              y={y + size - tall / 2 + 5}
              textAnchor="middle"
              style={{
                fontSize: 14,
                fontWeight: 800,
                fill: art.ink,
                fontFamily: "inherit",
              }}
            >
              {letter}
            </text>
            <CountBadge
              x={x + size - 3}
              y={y + size - tall - 1}
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

// --- Firsts: gold-star stickers ------------------------------------------------------

function Firsts(props: EntriesSlotProps) {
  const { art, ls } = useTokens();
  return (
    <BadgeRows
      {...props}
      color={ls.onSurface}
      muted={ls.onSurfaceVariant}
      background={(h) => <Page h={h} />}
      badge={({ cx, top, age, index }) => (
        <g
          transform={`rotate(${f1(wobble(`st${index}`) * 8)} ${cx} ${top + 46})`}
        >
          <path d={starPath(cx, top + 48, 44, 22)} fill={art.face} />
          <path d={starPath(cx, top + 48, 40, 19)} fill={art.gold} />
          <text
            x={cx}
            y={top + 53}
            textAnchor="middle"
            style={{
              fontSize: 11.5,
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

export const storybookTheme: DisplayTheme = {
  id: "storybook",
  name: "Storybook",
  description:
    "A giraffe, a seesaw and hats on a rack, with bowls, books and stickers.",
  Growth,
  Foods,
  Words,
  Firsts,
  Siblings,
};
