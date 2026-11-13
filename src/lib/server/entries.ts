import 'server-only';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { DATE_PRECISIONS, entries, ENTRY_KINDS, FOOD_GROUPS, REACTIONS } from '@/db/schema';
import { addDays, isIsoDate } from '@/lib/dates';
import { guessFoodGroup } from '@/lib/foods';
import { isListKind, nameKey } from '@/lib/match';
import { milestoneByKey } from '@/lib/milestones';
import { ApiError } from './api';
import type { Entry } from '@/lib/types';

// The server only knows UTC's day; a parent a few hours ahead of it is
// already in "tomorrow". One day of slack lets them log tonight's first
// tonight, and still refuses dates that are plainly in the future.
export const isoDate = z
  .string()
  .refine(isIsoDate, 'Pick a valid date.')
  .refine((s) => s <= addDays(new Date().toISOString().slice(0, 10), 1), "That date hasn't happened yet.");

export const EntryFields = z
  .object({
    kind: z.enum(ENTRY_KINDS),
    title: z.string().trim().min(1, 'Add a few words.').max(120),
    milestoneKey: z.string().max(40).nullish(),
    date: isoDate.nullable(),
    datePrecision: z.enum(DATE_PRECISIONS),
    reaction: z.enum(REACTIONS).nullish(),
    allergyFlag: z.boolean().optional(),
    foodGroup: z.enum(FOOD_GROUPS).nullish(),
    note: z.string().trim().max(2000).nullish(),
  })
  .refine((e) => (e.datePrecision === 'unknown') === (e.date === null), { path: ['date'], message: 'Pick a date, or choose "I don\'t remember".' })
  .refine((e) => !e.milestoneKey || (e.kind === 'first' && milestoneByKey(e.milestoneKey)), { path: ['milestoneKey'], message: 'Unknown milestone.' });

export type EntryInput = z.infer<typeof EntryFields>;

/** The columns an entry of this kind may carry; fields that belong to another kind are dropped, not stored. */
export function entryColumns(input: EntryInput) {
  const food = input.kind === 'food';
  return {
    kind: input.kind,
    title: input.title,
    milestoneKey: input.kind === 'first' ? (input.milestoneKey ?? null) : null,
    date: input.date,
    datePrecision: input.datePrecision,
    reaction: food ? (input.reaction ?? null) : null,
    allergyFlag: food ? (input.allergyFlag ?? false) : false,
    foodGroup: food ? (input.foodGroup ?? guessFoodGroup(input.title)) : null,
    note: input.note || null,
  };
}

type Named = Pick<EntryInput, 'kind' | 'title' | 'milestoneKey'>;

/**
 * An existing entry that says the same thing. For a first, two parents
 * logging "first steps" the same evening is the usual cause, so the form
 * shows the existing one and lets them keep both if they really mean it.
 * Foods and words are lists and never keep both (`refuseListDuplicate`).
 * Notes are free text and never checked.
 */
export async function findDuplicate(babyId: string, input: Named, exceptId?: string): Promise<Entry | undefined> {
  if (input.kind === 'note') return undefined;
  const d = await db();
  const scope = and(eq(entries.babyId, babyId), eq(entries.kind, input.kind), isNull(entries.deletedAt), exceptId ? ne(entries.id, exceptId) : undefined);
  if (isListKind(input.kind)) {
    // Matched in JS, not SQL: SQLite's lower() knows no accents, and the
    // rule has to be the one the form uses. A baby's list is short.
    const key = nameKey(input.title);
    return (await d.select().from(entries).where(scope)).find((e) => nameKey(e.title) === key);
  }
  const same = input.milestoneKey ? eq(entries.milestoneKey, input.milestoneKey) : sql`lower(${entries.title}) = ${input.title.toLowerCase()}`;
  const [hit] = await d.select().from(entries).where(and(scope, same));
  return hit;
}

/** A food or word already on the list is refused outright, on add, rename and undelete alike. */
export async function refuseListDuplicate(babyId: string, input: Named, exceptId?: string): Promise<void> {
  if (!isListKind(input.kind)) return;
  const existing = await findDuplicate(babyId, input, exceptId);
  if (existing) throw new ApiError(409, 'DUPLICATE', `${existing.title} is already on the list.`, { existing, strict: true });
}

/** The fields an edit can change, as kept in history and restored from it. */
export function snapshot(entry: Entry) {
  const { kind, title, milestoneKey, date, datePrecision, reaction, allergyFlag, foodGroup, note, updatedAt } = entry;
  return { kind, title, milestoneKey, date, datePrecision, reaction, allergyFlag, foodGroup, note, updatedAt };
}
