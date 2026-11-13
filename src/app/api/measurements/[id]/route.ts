import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { measurements } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireMeasurement } from '@/lib/server/access';
import { ApiError, json, parseBody, requireUser, route, validate } from '@/lib/server/api';
import { measurementColumns, MeasurementFields } from '@/lib/server/measurements';

const Edit = MeasurementFields.and(z.object({ expectedUpdatedAt: z.string() }));

// An edit, or { restore: true } to undo a delete.
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { measurement } = await requireMeasurement(user.id, id, 'editor');
  const raw = await parseBody(req, z.looseObject({}));
  const d = await db();
  if (raw.restore === true) {
    const [restored] = await d.update(measurements).set({ deletedAt: null }).where(eq(measurements.id, id)).returning();
    return json({ measurement: restored });
  }
  if (measurement.deletedAt) throw new ApiError(409, 'DELETED', 'This measurement was deleted. Restore it from Recently deleted to edit it.');
  const body = validate(Edit, raw);
  if (body.expectedUpdatedAt !== measurement.updatedAt) {
    throw new ApiError(409, 'CONFLICT', 'Someone else changed this measurement while you were editing. Review their version, then save again.', { measurement });
  }
  const [saved] = await d
    .update(measurements)
    .set({ ...measurementColumns(body), updatedAt: nowIso() })
    .where(eq(measurements.id, id))
    .returning();
  return json({ measurement: saved });
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMeasurement(user.id, id, 'editor');
  const d = await db();
  await d.update(measurements).set({ deletedAt: nowIso() }).where(eq(measurements.id, id));
  return json({ ok: true });
});
