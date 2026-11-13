import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { invites } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireMember } from '@/lib/server/access';
import { json, requireUser, route } from '@/lib/server/api';

export const DELETE = route<{ id: string; inviteId: string }>(async (req, { id, inviteId }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const d = await db();
  // Scoped to this household, so an owner can't revoke another household's invite by id.
  await d
    .update(invites)
    .set({ revokedAt: nowIso() })
    .where(and(eq(invites.id, inviteId), eq(invites.householdId, id), isNull(invites.usedAt)));
  return json({ ok: true });
});
