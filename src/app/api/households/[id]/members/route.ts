import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { households, memberships, users } from '@/db/schema';
import type { Member } from '@/lib/types';
import { requireMember } from '@/lib/server/access';
import { ApiError, json, requireUser, route } from '@/lib/server/api';

export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id);
  const d = await db();
  const members: Member[] = await d
    .select({ userId: memberships.userId, username: users.usernameDisplay, role: memberships.role, joinedAt: memberships.joinedAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.householdId, id))
    .orderBy(asc(memberships.joinedAt));
  return json({ members });
});

// Claim an ownerless household. When an owner's account is purged and no
// editor could inherit, the household waits 30 days; any remaining member
// may step up, since they can already see everything in it.
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { household } = await requireMember(user.id, id);
  if (!household.ownerlessSince) throw new ApiError(409, 'HAS_OWNER', 'This household already has an owner.');
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.update(memberships).set({ role: 'owner' }).where(and(eq(memberships.householdId, id), eq(memberships.userId, user.id)));
    await tx.update(households).set({ ownerlessSince: null }).where(eq(households.id, id));
  });
  return json({ ok: true });
});
