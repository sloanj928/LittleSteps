import { db } from '@/db/client';
import { measurements } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireBaby } from '@/lib/server/access';
import { json, parseBody, requireUser, route } from '@/lib/server/api';
import { measurementColumns, MeasurementFields } from '@/lib/server/measurements';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireBaby(user.id, id, 'editor');
  const body = await parseBody(req, MeasurementFields);
  const d = await db();
  const [measurement] = await d
    .insert(measurements)
    .values({ id: crypto.randomUUID(), babyId: id, ...measurementColumns(body), createdBy: user.id, updatedAt: nowIso() })
    .returning();
  return json({ measurement }, { status: 201 });
});
