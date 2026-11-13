import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { entries, measurements } from '@/db/schema';
import { requireBaby } from '@/lib/server/access';
import { json, requireUser, route } from '@/lib/server/api';

// Recently deleted: what can still be brought back before the 30-day purge.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireBaby(user.id, id, 'editor');
  const d = await db();
  const [entryRows, measurementRows] = await Promise.all([
    d.select().from(entries).where(and(eq(entries.babyId, id), isNotNull(entries.deletedAt))).orderBy(desc(entries.deletedAt)),
    d.select().from(measurements).where(and(eq(measurements.babyId, id), isNotNull(measurements.deletedAt))).orderBy(desc(measurements.deletedAt)),
  ]);
  return json({ entries: entryRows, measurements: measurementRows });
});
