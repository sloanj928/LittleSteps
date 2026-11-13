import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '@/db/client';
import { auditLog, users } from '@/db/schema';
import { json, requireAdmin, route } from '@/lib/server/api';

export const GET = route(async (req) => {
  await requireAdmin(req);
  const d = await db();
  const target = alias(users, 'target');
  const log = await d
    .select({ id: auditLog.id, action: auditLog.action, detail: auditLog.detail, createdAt: auditLog.createdAt, actor: users.usernameDisplay, target: target.usernameDisplay })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .leftJoin(target, eq(target.id, auditLog.targetUserId))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);
  return json({ log });
});
