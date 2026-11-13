import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { authState } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { audit, json, notFound, requireAdmin, route } from '@/lib/server/api';
import { findUserByUsername } from '@/lib/server/users';

// Look up one account by exact username. It returns what recovery needs --
// that the account exists and whether it is locked -- and nothing about
// households, babies or entries, which an admin has no access to.
export const GET = route(async (req) => {
  const { user: admin } = await requireAdmin(req);
  const username = new URL(req.url).searchParams.get('username') ?? '';
  const user = await findUserByUsername(username);
  if (!user) throw notFound();
  const d = await db();
  const [state] = await d.select().from(authState).where(eq(authState.userId, user.id));
  const now = nowIso();
  await audit(admin.id, 'user.lookup', user.id);
  return json({
    id: user.id,
    username: user.usernameDisplay,
    createdAt: user.createdAt,
    mustReset: user.mustReset,
    deletionScheduledFor: user.deletionScheduledFor,
    signInPaused: Boolean(state?.loginLockedUntil && state.loginLockedUntil > now),
    pinPaused: Boolean(state?.pinLockedUntil && state.pinLockedUntil > now),
    pinFrozen: Boolean(state?.pinFrozen),
  });
});
