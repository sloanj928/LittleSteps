import { db } from '@/db/client';
import { babies } from '@/db/schema';
import { requireMember } from '@/lib/server/access';
import { json, parseBody, requireUser, route } from '@/lib/server/api';
import { BabyFields } from '@/lib/server/babies';

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  await requireMember(user.id, id, 'owner');
  const body = await parseBody(req, BabyFields);
  const d = await db();
  const babyId = crypto.randomUUID();
  await d.insert(babies).values({ id: babyId, householdId: id, name: body.name, birthDate: body.birthDate, sex: body.sex ?? null, dueDate: body.dueDate ?? null, correctedAge: body.correctedAge ?? false });
  return json({ id: babyId }, { status: 201 });
});
