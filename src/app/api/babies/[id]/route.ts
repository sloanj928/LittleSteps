import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { babies, entries, measurements, memberships, milestoneStatus, users } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import type { BabyBundle } from '@/lib/types';
import { requireBaby } from '@/lib/server/access';
import { json, parseBody, requireUser, route, validate } from '@/lib/server/api';
import { BabyFields } from '@/lib/server/babies';

// Everything one baby's screens draw from, in a single request: a baby's
// whole record is a few hundred small rows, and every display (timeline,
// charts, themes, nudges) is derived from it on the client.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { baby, role } = await requireBaby(user.id, id);
  const d = await db();
  const [entryRows, measurementRows, statuses, members] = await Promise.all([
    d.select().from(entries).where(and(eq(entries.babyId, id), isNull(entries.deletedAt))),
    d.select().from(measurements).where(and(eq(measurements.babyId, id), isNull(measurements.deletedAt))).orderBy(asc(measurements.date)),
    d.select().from(milestoneStatus).where(eq(milestoneStatus.babyId, id)),
    d.select({ id: users.id, name: users.usernameDisplay }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.householdId, baby.householdId)),
  ]);
  const bundle: BabyBundle = {
    baby,
    role,
    entries: entryRows,
    measurements: measurementRows,
    statuses: statuses.map(({ milestoneKey, status, snoozedUntil, updatedAt }) => ({ milestoneKey, status, snoozedUntil, updatedAt })),
    people: Object.fromEntries(members.map((m) => [m.id, m.name])),
  };
  return json(bundle);
});

const Archive = z.object({ archived: z.boolean() });

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireBaby(user.id, id, 'owner');
  const raw = await parseBody(req, z.looseObject({}));
  const d = await db();
  if ('archived' in raw) {
    const { archived } = validate(Archive, raw);
    await d.update(babies).set({ archivedAt: archived ? nowIso() : null }).where(eq(babies.id, id));
  } else {
    const body = validate(BabyFields, raw);
    await d
      .update(babies)
      .set({ name: body.name, birthDate: body.birthDate, sex: body.sex ?? null, dueDate: body.dueDate ?? null, correctedAge: body.correctedAge ?? false })
      .where(eq(babies.id, id));
  }
  return json({ ok: true });
});
