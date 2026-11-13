import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { memberships, ROLES } from '@/db/schema';
import { requireMember } from '@/lib/server/access';
import { ApiError, json, notFound, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';

type Params = { id: string; userId: string };

async function membersOf(householdId: string) {
  const d = await db();
  return d.select({ userId: memberships.userId, role: memberships.role }).from(memberships).where(eq(memberships.householdId, householdId));
}

const lastOwner = () => new ApiError(409, 'LAST_OWNER', 'A household always needs an owner. Make someone else an owner first.');

const Body = z.object({ role: z.enum(ROLES), password: z.string().max(1000).optional() });

// Change a member's role. Handing over ownership is "make them an owner",
// then (optionally) stepping yourself down; both go through here.
export const PATCH = route<Params>(async (req, { id, userId }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const body = await parseBody(req, Body);
  const members = await membersOf(id);
  const target = members.find((m) => m.userId === userId);
  if (!target) throw notFound();
  if (target.role === body.role) return json({ ok: true });

  if (target.role === 'owner') {
    // An owner's role is theirs to give up; nobody can demote another owner.
    if (userId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Only an owner can step down from being an owner.');
    if (members.filter((m) => m.role === 'owner').length === 1) throw lastOwner();
  }
  if (body.role === 'owner') {
    // An owner can delete everything, so creating one asks for the password again.
    if (!body.password) throw new ApiError(400, 'VALIDATION', 'Please check the highlighted fields.', { fields: { password: 'Enter your password to confirm.' } });
    await requirePassword(user, body.password);
  }
  const d = await db();
  await d
    .update(memberships)
    .set({ role: body.role })
    .where(and(eq(memberships.householdId, id), eq(memberships.userId, userId)));
  return json({ ok: true });
});

// Remove a member, or leave (userId is your own). Their entries stay, shown
// as written by a "former member".
export const DELETE = route<Params>(async (req, { id, userId }) => {
  const { user } = await requireUser(req);
  const leaving = userId === user.id;
  await requireMember(user.id, id, leaving ? 'viewer' : 'owner');
  const members = await membersOf(id);
  const target = members.find((m) => m.userId === userId);
  if (!target) throw notFound();
  if (target.role === 'owner') {
    if (!leaving) throw new ApiError(403, 'FORBIDDEN', "An owner can't be removed by someone else.");
    if (members.filter((m) => m.role === 'owner').length === 1) {
      throw members.length === 1
        ? new ApiError(409, 'LAST_OWNER', 'You are the only person here. Delete the household instead of leaving it.')
        : lastOwner();
    }
  }
  const d = await db();
  await d.delete(memberships).where(and(eq(memberships.householdId, id), eq(memberships.userId, userId)));
  return json({ ok: true });
});
