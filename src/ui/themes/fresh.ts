'use client';

import { useEffect, useMemo } from 'react';

// Which things in a display are new since this device last showed it, so
// they can bounce once. "Last showed" is a list of ids per display and baby
// in localStorage: something added a moment ago, or by someone else since
// this phone last looked, is new; a first visit marks nothing, or every
// block and jar would bounce at once.
//
// Only ids are stored, never titles or values: nothing a family writes is
// kept on the device (see public/sw.js).

const PREFIX = 'ls_seen:';

function readSeen(key: string): ReadonlySet<string> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/** The ids not seen in this display before. Stable for the life of the screen, so a re-render doesn't replay a bounce. */
export function useFresh(key: string, ids: readonly string[]): ReadonlySet<string> {
  // Read once per display: what was there when this screen opened. Things
  // added while it's open aren't in it, so they count as new too.
  const before = useMemo(() => readSeen(key), [key]);
  const joined = ids.join(',');
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(joined ? joined.split(',') : []));
    } catch {
      // Without storage nothing bounces; the drawing is the same either way.
    }
  }, [key, joined]);
  return useMemo(() => new Set(before ? joined.split(',').filter((id) => id && !before.has(id)) : []), [before, joined]);
}
