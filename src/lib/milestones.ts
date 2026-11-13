// The firsts library. It ships as code so its wording is reviewed and
// versioned with the app.
//
// `window` is the age range, in months, in which many babies do this for the
// first time. It is drawn from the CDC's developmental milestones and the WHO
// motor development study, widened where they differ. It exists only to time
// a gentle "has this happened yet?" -- it is never shown as a deadline, and a
// first with no window (a first haircut) is never asked about at all.

import type { EntryKind } from '@/db/schema';

export interface Milestone {
  key: string;
  label: string;
  /** Any entry of this kind is the record of it: a logged food means solids have started. */
  metByKind?: EntryKind;
  /** What the nudge asks, after "Has {name} ..." */
  ask?: string;
  window?: [startMonths: number, endMonths: number];
}

export const MILESTONES: readonly Milestone[] = [
  { key: 'first_smile', label: 'First smile', ask: 'smiled at you yet', window: [1, 3] },
  { key: 'first_laugh', label: 'First laugh', ask: 'laughed yet', window: [3, 5] },
  { key: 'rolled_over', label: 'Rolled over', ask: 'rolled over yet', window: [3, 6] },
  { key: 'first_solid_food', label: 'First solid food', ask: 'tried solid food yet', window: [4, 7], metByKind: 'food' },
  { key: 'sat_up', label: 'Sat up alone', ask: 'sat up without help yet', window: [5, 8] },
  { key: 'first_tooth', label: 'First tooth', ask: 'got a first tooth yet', window: [5, 10] },
  { key: 'crawled', label: 'Crawled', ask: 'started crawling yet', window: [6, 10] },
  { key: 'waved', label: 'Waved', ask: 'waved hello or goodbye yet', window: [8, 12] },
  { key: 'clapped', label: 'Clapped', ask: 'clapped yet', window: [8, 12] },
  { key: 'pulled_to_stand', label: 'Pulled up to stand', ask: 'pulled up to stand yet', window: [8, 11] },
  { key: 'first_word', label: 'First word', ask: 'said a first word yet', window: [9, 14], metByKind: 'word' },
  { key: 'first_steps', label: 'First steps', ask: 'taken first steps yet', window: [9, 15] },
  { key: 'used_spoon', label: 'Used a spoon', ask: 'used a spoon yet', window: [12, 18] },
  { key: 'first_bath', label: 'First bath' },
  { key: 'first_outing', label: 'First outing' },
  { key: 'slept_through', label: 'Slept through the night' },
  { key: 'first_haircut', label: 'First haircut' },
  { key: 'first_trip', label: 'First trip' },
  { key: 'first_swim', label: 'First swim' },
  { key: 'first_birthday', label: 'First birthday' },
];

const BY_KEY = new Map(MILESTONES.map((m) => [m.key, m]));

export function milestoneByKey(key: string): Milestone | undefined {
  return BY_KEY.get(key);
}

/** Milestones already on record: logged as that first, or met by an entry of their kind. */
export function loggedMilestones(entries: readonly { kind: EntryKind; milestoneKey: string | null }[]): Set<string> {
  const keys = new Set(entries.flatMap((e) => (e.milestoneKey ? [e.milestoneKey] : [])));
  const kinds = new Set(entries.map((e) => e.kind));
  for (const m of MILESTONES) if (m.metByKind && kinds.has(m.metByKind)) keys.add(m.key);
  return keys;
}

// --- Nudges ------------------------------------------------------------------

export const NOT_YET_DAYS = 14;
export const SNOOZE_DAYS = 7;
// A question still unanswered this long after its window has quietly had its
// chance; asking a three-year-old's parent about a first smile helps nobody.
const STOP_ASKING_AFTER_MONTHS = 3;
const QUIET_AFTER_ACTION_MS = 24 * 60 * 60 * 1000;

export interface NudgeStatus {
  milestoneKey: string;
  status: 'hidden' | 'snoozed' | 'not_yet';
  snoozedUntil: string | null;
  updatedAt: string;
}

export interface NudgeInput {
  /** Corrected age where that applies: a preemie's windows start from the due date. */
  ageMonths: number;
  loggedKeys: ReadonlySet<string>;
  statuses: readonly NudgeStatus[];
  enabled: boolean;
  /** The viewer's calendar day, 'YYYY-MM-DD'. */
  today: string;
  now?: number;
}

/**
 * The one nudge to show, or null. At most one at a time, the earliest window
 * first; nothing for a day after any nudge is answered, so answering one
 * never immediately produces the next.
 */
export function pickNudge({ ageMonths, loggedKeys, statuses, enabled, today, now = Date.now() }: NudgeInput): Milestone | null {
  if (!enabled) return null;
  if (statuses.some((s) => now - Date.parse(s.updatedAt) < QUIET_AFTER_ACTION_MS)) return null;
  const byKey = new Map(statuses.map((s) => [s.milestoneKey, s]));
  const open = MILESTONES.filter((m) => {
    if (!m.window || loggedKeys.has(m.key)) return false;
    if (ageMonths < m.window[0] || ageMonths > m.window[1] + STOP_ASKING_AFTER_MONTHS) return false;
    const s = byKey.get(m.key);
    if (!s) return true;
    return s.status !== 'hidden' && (!s.snoozedUntil || s.snoozedUntil <= today);
  });
  open.sort((a, b) => a.window![0] - b.window![0]);
  return open[0] ?? null;
}
