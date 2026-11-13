import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { hashSecret } from '@/lib/auth/crypto';
import { json, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';
import { pinCleared } from '@/lib/server/attempts';
import { assertPin } from '@/lib/server/users';

const Body = z.object({ password: z.string().max(1000), newPin: z.string().max(20) });

export const POST = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, Body);
  await requirePassword(user, body.password);
  assertPin(body.newPin, 'newPin');
  const d = await db();
  await d.update(users).set({ pinHash: await hashSecret(body.newPin) }).where(eq(users.id, user.id));
  await pinCleared(user.id);
  return json({ ok: true });
});
