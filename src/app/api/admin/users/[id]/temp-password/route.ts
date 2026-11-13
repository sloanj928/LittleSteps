import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { hashSecret, readableCode } from '@/lib/auth/crypto';
import { audit, json, notFound, parseBody, requireAdmin, requirePassword, route } from '@/lib/server/api';
import { loginSucceeded, pinCleared } from '@/lib/server/attempts';
import { revokeSessions } from '@/lib/server/session';

const Body = z.object({ password: z.string().max(1000) });

// Admin recovery, for someone who has lost both password and PIN. The
// temporary password is shown to the admin once, to pass on by a channel
// they trust (a phone call, in person). It only opens the forced-reset
// screen, where the user picks a password and PIN the admin never sees.
export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user: admin } = await requireAdmin(req);
  const body = await parseBody(req, Body);
  await requirePassword(admin, body.password);
  const d = await db();
  const [target] = await d
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));
  if (!target) throw notFound();

  const tempPassword = readableCode(14);
  await d
    .update(users)
    .set({ passwordHash: await hashSecret(tempPassword), mustReset: true })
    .where(eq(users.id, id));
  await revokeSessions(id);
  await pinCleared(id);
  await loginSucceeded(id);
  await audit(admin.id, 'user.temp_password', id);
  return json({ tempPassword });
});
