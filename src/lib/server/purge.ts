import 'server-only';
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { authState, babies, entries, entryHistory, households, invites, measurements, memberships, milestoneStatus, sessions, users } from '@/db/schema';
import { DAY, isoPlus, nowIso } from '@/lib/dates';
import { pruneAttempts } from './attempts';

// How long anything deleted can still be brought back.
const GRACE_MS = 30 * DAY;

async function hardDeleteHousehold(householdId: string): Promise<void> {
  const d = await db();
  await d.transaction(async (tx) => {
    const babyIds = (await tx.select({ id: babies.id }).from(babies).where(eq(babies.householdId, householdId))).map((b) => b.id);
    if (babyIds.length) {
      const entryIds = (await tx.select({ id: entries.id }).from(entries).where(inArray(entries.babyId, babyIds))).map((e) => e.id);
      if (entryIds.length) await tx.delete(entryHistory).where(inArray(entryHistory.entryId, entryIds));
      await tx.delete(entries).where(inArray(entries.babyId, babyIds));
      await tx.delete(measurements).where(inArray(measurements.babyId, babyIds));
      await tx.delete(milestoneStatus).where(inArray(milestoneStatus.babyId, babyIds));
      await tx.delete(babies).where(eq(babies.householdId, householdId));
    }
    await tx.delete(invites).where(eq(invites.householdId, householdId));
    await tx.delete(memberships).where(eq(memberships.householdId, householdId));
    await tx.delete(households).where(eq(households.id, householdId));
  });
}

/**
 * Removes one account for good. Each household it owned alone passes to the
 * longest-standing editor; with no editor it waits, ownerless, for 30 days;
 * with nobody else in it at all, it goes with the account.
 *
 * The user row itself is kept, emptied: entries they wrote in other
 * households still point at it and show as written by a "former member".
 */
async function purgeUser(userId: string): Promise<void> {
  const d = await db();
  const mine = await d.select().from(memberships).where(eq(memberships.userId, userId));
  for (const m of mine) {
    const others = (await d.select().from(memberships).where(eq(memberships.householdId, m.householdId)).orderBy(asc(memberships.joinedAt))).filter((o) => o.userId !== userId);
    if (others.length === 0) {
      await hardDeleteHousehold(m.householdId);
      continue;
    }
    if (m.role === 'owner' && !others.some((o) => o.role === 'owner')) {
      const heir = others.find((o) => o.role === 'editor');
      if (heir) {
        await d
          .update(memberships)
          .set({ role: 'owner' })
          .where(and(eq(memberships.householdId, m.householdId), eq(memberships.userId, heir.userId)));
      } else {
        await d.update(households).set({ ownerlessSince: nowIso() }).where(eq(households.id, m.householdId));
      }
    }
  }
  await d.transaction(async (tx) => {
    await tx.delete(memberships).where(eq(memberships.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(authState).where(eq(authState.userId, userId));
    await tx
      .update(users)
      // The name is freed for reuse; "deleted:<id>" can't collide with a
      // real username, which never contains a colon.
      .set({ usernameNorm: `deleted:${userId}`, usernameDisplay: 'former member', passwordHash: '', pinHash: '', isAdmin: false, deletedAt: nowIso(), deletionScheduledFor: null })
      .where(eq(users.id, userId));
  });
}

/** The nightly clean-up. Returns counts so the cron response says what it did. */
export async function runPurge() {
  const d = await db();
  const now = nowIso();
  const cutoff = isoPlus(-GRACE_MS);

  const dueUsers = await d
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.deletedAt), isNotNull(users.deletionScheduledFor), lte(users.deletionScheduledFor, now)));
  for (const u of dueUsers) await purgeUser(u.id);

  // Households deleted by an owner, or left ownerless, 30 days ago.
  const dueHouseholds = await d
    .select({ id: households.id })
    .from(households)
    .where(or(lt(households.deletedAt, cutoff), lt(households.ownerlessSince, cutoff)));
  for (const h of dueHouseholds) await hardDeleteHousehold(h.id);

  const oldEntries = (await d.select({ id: entries.id }).from(entries).where(lt(entries.deletedAt, cutoff))).map((e) => e.id);
  if (oldEntries.length) {
    await d.delete(entryHistory).where(inArray(entryHistory.entryId, oldEntries));
    await d.delete(entries).where(inArray(entries.id, oldEntries));
  }
  const oldMeasurements = await d.delete(measurements).where(lt(measurements.deletedAt, cutoff)).returning({ id: measurements.id });

  await d.delete(sessions).where(or(lt(sessions.expiresAt, now), lt(sessions.absoluteExpiresAt, now)));
  await d.delete(invites).where(lt(invites.expiresAt, cutoff));
  await pruneAttempts();

  return { users: dueUsers.length, households: dueHouseholds.length, entries: oldEntries.length, measurements: oldMeasurements.length };
}
