// What every illustrated display draws with: one width, one set of SVG
// attributes, and a seeded wobble for the hand-drawn look.

export const W = 340;
// Overflow visible: a bounce lifts a jar's lid or drops a block from above the drawing's edge.
export const svgProps = { width: '100%', 'aria-hidden': true, style: { display: 'block', fontFamily: 'inherit', overflow: 'visible' } } as const;

// A stable pseudo-random number in [-1, 1] from a string, so hand-drawn
// wobble is the same on every render and on the server.
export function wobble(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}
