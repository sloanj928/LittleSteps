import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { households, memberships, users } from '@/db/schema';
import { DAY, isoPlus } from '@/lib/dates';
import { ApiError, json, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';
import { clearSessionCookie, revokeSessions } from '@/lib/server/session';

const Body = z.object({ password: z.string().max(1000) });

const ACCOUNT_DELETION_GRACE_MS = 30 * DAY;

// Schedules the account for deletion in 30 days and signs it out everywhere.
// Signing in again within that time cancels it; the nightly purge does the
// rest.
export const POST = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, Body);
  await requirePassword(user, body.password);

  const d = await db();
  const mine = await d
    .select({ id: households.id, name: households.name, role: memberships.role })
    .from(memberships)
    .innerJoin(households, eq(households.id, memberships.householdId))
    .where(and(eq(memberships.userId, user.id), isNull(households.deletedAt)));
  // A household with other people in it must not be left without an owner
  // by surprise: hand it over first.
  const stranded: string[] = [];
  for (const h of mine.filter((m) => m.role === 'owner')) {
    const members = await d.select({ userId: memberships.userId, role: memberships.role }).from(memberships).where(eq(memberships.householdId, h.id));
    const otherOwner = members.some((m) => m.userId !== user.id && m.role === 'owner');
    if (members.length > 1 && !otherOwner) stranded.push(h.name);
  }
  if (stranded.length) {
    throw new ApiError(409, 'TRANSFER_FIRST', `Make someone else an owner of ${stranded.join(' and ')} first, so the household isn't left without one.`, { households: stranded });
  }

  const scheduledFor = isoPlus(ACCOUNT_DELETION_GRACE_MS);
  await d.update(users).set({ deletionScheduledFor: scheduledFor }).where(eq(users.id, user.id));
  await revokeSessions(user.id);
  return json({ scheduledFor }, { headers: { 'Set-Cookie': clearSessionCookie(req) } });
});
