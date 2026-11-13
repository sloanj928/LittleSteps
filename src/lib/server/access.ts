import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { babies, entries, households, measurements, memberships, type Role } from '@/db/schema';
import { ApiError, notFound } from './api';

const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

// Every data route goes session -> membership -> role through these. Someone
// outside a household gets the same 404 as for an id that doesn't exist, so
// ids can't be probed; a member without the role gets a 403 they can act on.

export async function requireMember(userId: string, householdId: string, min: Role = 'viewer') {
  const d = await db();
  const [row] = await d
    .select({ role: memberships.role, household: households })
    .from(memberships)
    .innerJoin(households, eq(households.id, memberships.householdId))
    .where(and(eq(memberships.userId, userId), eq(memberships.householdId, householdId), isNull(households.deletedAt)));
  if (!row) throw notFound();
  if (!roleAtLeast(row.role, min)) {
    throw new ApiError(403, 'FORBIDDEN', min === 'owner' ? 'Only a household owner can do that.' : 'Your role in this household is view-only.');
  }
  return row;
}

export async function requireBaby(userId: string, babyId: string, min: Role = 'viewer') {
  const d = await db();
  const [baby] = await d.select().from(babies).where(eq(babies.id, babyId));
  if (!baby) throw notFound();
  const { role } = await requireMember(userId, baby.householdId, min);
  return { baby, role };
}

export async function requireEntry(userId: string, entryId: string, min: Role = 'viewer') {
  const d = await db();
  const [entry] = await d.select().from(entries).where(eq(entries.id, entryId));
  if (!entry) throw notFound();
  const { baby, role } = await requireBaby(userId, entry.babyId, min);
  return { entry, baby, role };
}

export async function requireMeasurement(userId: string, measurementId: string, min: Role = 'viewer') {
  const d = await db();
  const [measurement] = await d.select().from(measurements).where(eq(measurements.id, measurementId));
  if (!measurement) throw notFound();
  const { baby, role } = await requireBaby(userId, measurement.babyId, min);
  return { measurement, baby, role };
}
