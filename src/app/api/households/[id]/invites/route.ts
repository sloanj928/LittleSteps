import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { invites, users } from '@/db/schema';
import { readableCode, sha256 } from '@/lib/auth/crypto';
import { HOUR, isoPlus, nowIso } from '@/lib/dates';
import type { InviteSummary } from '@/lib/types';
import { requireMember } from '@/lib/server/access';
import { ApiError, json, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';

const INVITE_TTL_MS = 48 * HOUR;
const MAX_ACTIVE_INVITES = 5;
// 8 characters from a 31-symbol alphabet is about 39 bits. With guesses
// capped per user and per address, that is out of reach inside 48 hours.
const CODE_LENGTH = 8;

function active(householdId: string) {
  return and(eq(invites.householdId, householdId), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, nowIso()));
}

// Codes are stored hashed, so the list can show that an invite exists and
// when it expires, never the code itself.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const d = await db();
  const list: InviteSummary[] = await d
    .select({ id: invites.id, createdAt: invites.createdAt, expiresAt: invites.expiresAt, createdBy: users.usernameDisplay })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(active(id))
    .orderBy(desc(invites.createdAt));
  return json({ invites: list });
});

const Body = z.object({ password: z.string().max(1000) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const body = await parseBody(req, Body);
  await requirePassword(user, body.password);
  const d = await db();
  const open = await d.select({ id: invites.id }).from(invites).where(active(id));
  if (open.length >= MAX_ACTIVE_INVITES) {
    throw new ApiError(409, 'INVITE_CAP', `A household can have ${MAX_ACTIVE_INVITES} unused invites at a time. Revoke one to make another.`);
  }
  const code = readableCode(CODE_LENGTH);
  const expiresAt = isoPlus(INVITE_TTL_MS);
  await d.insert(invites).values({ id: crypto.randomUUID(), householdId: id, codeHash: sha256(code), createdBy: user.id, expiresAt });
  // The only time the code is ever sent anywhere.
  return json({ code, expiresAt }, { status: 201 });
});
