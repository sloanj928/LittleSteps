import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { households, memberships } from '@/db/schema';
import { ApiError, json, parseBody, requireUser, route } from '@/lib/server/api';

const Body = z.object({ name: z.string().trim().min(1, 'Give the household a name.').max(60) });

// Far more than a family needs; it only stops a script from filling the database.
const MAX_OWNED = 10;

export const POST = route(async (req) => {
  const { user } = await requireUser(req);
  const body = await parseBody(req, Body);
  const d = await db();
  const [owned] = await d
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.role, 'owner')));
  if (owned.n >= MAX_OWNED) throw new ApiError(409, 'TOO_MANY', 'You already own the most households one account can.');
  const id = crypto.randomUUID();
  await d.transaction(async (tx) => {
    await tx.insert(households).values({ id, name: body.name });
    await tx.insert(memberships).values({ householdId: id, userId: user.id, role: 'owner' });
  });
  return json({ id }, { status: 201 });
});
