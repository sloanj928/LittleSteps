import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { supportRequests } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { audit, json, parseBody, requireAdmin, route } from '@/lib/server/api';

export const GET = route(async (req) => {
  await requireAdmin(req);
  const d = await db();
  const requests = await d.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(200);
  return json({ requests });
});

const Body = z.object({ id: z.string(), status: z.enum(['open', 'resolved', 'dismissed']) });

export const PATCH = route(async (req) => {
  const { user } = await requireAdmin(req);
  const body = await parseBody(req, Body);
  const d = await db();
  await d.update(supportRequests).set({ status: body.status, handledBy: user.id, handledAt: nowIso() }).where(eq(supportRequests.id, body.id));
  await audit(user.id, `support.${body.status}`, null, body.id);
  return json({ ok: true });
});
