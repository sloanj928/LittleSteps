import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { households } from '@/db/schema';
import { nowIso } from '@/lib/dates';
import { requireMember } from '@/lib/server/access';
import { json, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';

const Rename = z.object({ name: z.string().trim().min(1, 'Give the household a name.').max(60) });

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const body = await parseBody(req, Rename);
  const d = await db();
  await d.update(households).set({ name: body.name }).where(eq(households.id, id));
  return json({ ok: true });
});

const Delete = z.object({ password: z.string().max(1000) });

// Soft delete: the household disappears for everyone at once, and the
// nightly purge removes its data 30 days later.
export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const body = await parseBody(req, Delete);
  await requirePassword(user, body.password);
  const d = await db();
  await d.update(households).set({ deletedAt: nowIso() }).where(eq(households.id, id));
  return json({ ok: true });
});
