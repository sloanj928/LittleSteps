import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import type { SessionSummary } from '@/lib/types';
import { json, requireUser, route } from '@/lib/server/api';
import { revokeSessions } from '@/lib/server/session';

export const GET = route(async (req) => {
  const { user, session } = await requireUser(req);
  const d = await db();
  const rows = await d.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.lastSeenAt));
  const list: SessionSummary[] = rows.map((s) => ({ id: s.id, current: s.id === session.id, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, userAgent: s.userAgent }));
  return json({ sessions: list });
});

/** Sign out other devices. */
export const DELETE = route(async (req) => {
  const { user, session } = await requireUser(req);
  await revokeSessions(user.id, session.id);
  return json({ ok: true });
});
