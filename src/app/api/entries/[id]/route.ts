import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { entries, entryHistory, users } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireEntry } from '@/lib/server/access';
import { ApiError, json, parseBody, requireUser, route, validate } from '@/lib/server/api';
import { entryColumns, EntryFields, refuseListDuplicate, snapshot } from '@/lib/server/entries';

/** An entry with its edit history, newest change first. */
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { entry } = await requireEntry(user.id, id);
  const d = await db();
  const history = await d
    .select({ id: entryHistory.id, changedAt: entryHistory.changedAt, changedBy: users.usernameDisplay, beforeJson: entryHistory.beforeJson })
    .from(entryHistory)
    .innerJoin(users, eq(users.id, entryHistory.changedBy))
    .where(eq(entryHistory.entryId, id))
    .orderBy(desc(entryHistory.changedAt));
  return json({ entry, history });
});

const Edit = EntryFields.and(z.object({ expectedUpdatedAt: z.string() }));
const Revert = z.object({ revertTo: z.string() });

// Three things arrive here: an edit, { restore: true } to undo a delete, and
// { revertTo } to put back the version saved in one history row.
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { entry } = await requireEntry(user.id, id, 'editor');
  const raw = await parseBody(req, z.looseObject({}));
  const d = await db();

  if (raw.restore === true) {
    // Someone may have added the same food or word while this one was deleted.
    await refuseListDuplicate(entry.babyId, entry, id);
    const [restored] = await d.update(entries).set({ deletedAt: null }).where(eq(entries.id, id)).returning();
    return json({ entry: restored });
  }
  if (entry.deletedAt) throw new ApiError(409, 'DELETED', 'This entry was deleted. Restore it from Recently deleted to edit it.');

  let next;
  if ('revertTo' in raw) {
    const { revertTo } = validate(Revert, raw);
    const [row] = await d.select().from(entryHistory).where(eq(entryHistory.id, revertTo));
    if (!row || row.entryId !== id) throw new ApiError(404, 'NOT_FOUND', "We couldn't find that version.");
    const before = JSON.parse(row.beforeJson) as ReturnType<typeof snapshot>;
    next = entryColumns(EntryFields.parse(before));
  } else {
    const body = validate(Edit, raw);
    // Two people editing the same entry: the second save is told, instead
    // of silently overwriting the first.
    if (body.expectedUpdatedAt !== entry.updatedAt) {
      throw new ApiError(409, 'CONFLICT', 'Someone else changed this entry while you were editing. Review their version, then save again.', { entry });
    }
    next = entryColumns(body);
  }
  await refuseListDuplicate(entry.babyId, next, id);
  const saved = await d.transaction(async (tx) => {
    await tx.insert(entryHistory).values({ id: crypto.randomUUID(), entryId: id, changedBy: user.id, beforeJson: JSON.stringify(snapshot(entry)) });
    const [row] = await tx.update(entries).set({ ...next, updatedAt: nowIso() }).where(eq(entries.id, id)).returning();
    return row;
  });
  return json({ entry: saved });
});

// Soft delete; recoverable for 30 days.
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireEntry(user.id, id, 'editor');
  const d = await db();
  await d.update(entries).set({ deletedAt: nowIso() }).where(eq(entries.id, id));
  return json({ ok: true });
});
