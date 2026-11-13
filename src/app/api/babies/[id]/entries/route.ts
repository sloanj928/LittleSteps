import { z } from 'zod';
import { db } from '@/db/client';
import { entries } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireBaby } from '@/lib/server/access';
import { ApiError, json, parseBody, requireUser, route } from '@/lib/server/api';
import { entryColumns, EntryFields, findDuplicate } from '@/lib/server/entries';

const Body = EntryFields.and(z.object({ confirmDuplicate: z.boolean().optional() }));

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireBaby(user.id, id, 'editor');
  const body = await parseBody(req, Body);
  if (!body.confirmDuplicate) {
    const existing = await findDuplicate(id, body);
    if (existing) throw new ApiError(409, 'DUPLICATE', 'This looks like one that is already saved.', { existing });
  }
  const d = await db();
  const [entry] = await d
    .insert(entries)
    .values({ id: crypto.randomUUID(), babyId: id, ...entryColumns(body), createdBy: user.id, updatedAt: nowIso() })
    .returning();
  return json({ entry }, { status: 201 });
});
