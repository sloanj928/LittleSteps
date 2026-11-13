import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { households, invites, memberships } from '@/db/schema';
import { sha256 } from '@/lib/auth/crypto';
import { nowIso } from '@/lib/dates';
import { ApiError, json, parseBody, requireUser, route } from '@/lib/server/api';
import { inviteGuessesBy, ipHashOf, ipLimited, recordAttempt } from '@/lib/server/attempts';

const Body = z.object({ code: z.string().max(40) });

const MAX_GUESSES_PER_HOUR = 5;

const invalid = () => new ApiError(400, 'INVALID_CODE', "That code didn't work. Codes last 48 hours and can be used once; ask for a new one if needed.", { fields: { code: "That code didn't work." } });

export const POST = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, Body);
  const ip = ipHashOf(req);
  if ((await inviteGuessesBy(user.id)) >= MAX_GUESSES_PER_HOUR || (await ipLimited('invite', ip))) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many wrong codes. Try again in an hour.');
  }
  // Codes are read aloud and typed by hand: forgive case, spaces and dashes.
  const code = body.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const d = await db();
  const [invite] = await d
    .select({ id: invites.id, householdId: invites.householdId })
    .from(invites)
    .innerJoin(households, eq(households.id, invites.householdId))
    .where(and(eq(invites.codeHash, sha256(code)), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, nowIso()), isNull(households.deletedAt)));
  if (!invite) {
    await recordAttempt('invite', ip, false, user.id);
    throw invalid();
  }
  const [already] = await d
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.householdId, invite.householdId), eq(memberships.userId, user.id)));
  // Not an error worth spending the code on.
  if (already) throw new ApiError(409, 'ALREADY_MEMBER', 'You are already in that household.');

  // Claiming is one conditional UPDATE, so two people racing for a
  // single-use code can't both win.
  const claimed = await d
    .update(invites)
    .set({ usedBy: user.id, usedAt: nowIso() })
    .where(and(eq(invites.id, invite.id), isNull(invites.usedAt), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  if (!claimed.length) throw invalid();
  // Everyone joins as a viewer; an owner decides who may edit.
  await d.insert(memberships).values({ householdId: invite.householdId, userId: user.id, role: 'viewer' });
  await recordAttempt('invite', ip, true, user.id);
  return json({ householdId: invite.householdId }, { status: 201 });
});
