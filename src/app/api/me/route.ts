import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { PALETTE_IDS, THEME_IDS } from '@/lib/types';
import { json, parseBody, requireUser, route } from '@/lib/server/api';
import { loadMe } from '@/lib/server/users';

// Called when the app opens. Validating the session here is also what slides
// its 30-day expiry forward.
export const GET = route(async (req) => {
  const { user } = await requireUser(req, { allowMustReset: true });
  return json(await loadMe(user));
});

const Prefs = z
  .object({
    theme: z.enum(THEME_IDS),
    palette: z.enum(PALETTE_IDS),
    defaultDataView: z.boolean(),
    nudgesEnabled: z.boolean(),
  })
  .partial();

export const PATCH = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, Prefs);
  if (Object.keys(body).length) {
    const d = await db();
    await d.update(users).set(body).where(eq(users.id, user.id));
  }
  return json({ ok: true });
});
