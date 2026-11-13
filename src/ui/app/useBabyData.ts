'use client';

import { useMemo } from 'react';
import type { EntryKind } from '@/db/schema';
import { loggedMilestones } from '@/lib/milestones';
import type { BabyBundle, Entry } from '@/lib/types';

/** Oldest first; entries without a date go last, in the order they were written. */
export function byDate(a: Entry, b: Entry): number {
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** A baby's entries split by kind and sorted once, for every display that draws them. */
export function useEntriesByKind(bundle: BabyBundle | undefined) {
  return useMemo(() => {
    const sorted = [...(bundle?.entries ?? [])].sort(byDate);
    const of = (kind: EntryKind) => sorted.filter((e) => e.kind === kind);
    return {
      all: sorted,
      firsts: of('first'),
      foods: of('food'),
      words: of('word'),
      notes: of('note'),
      loggedKeys: loggedMilestones(sorted),
    };
  }, [bundle]);
}
