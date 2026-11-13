import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { milestoneStatus } from '@/db/schema';
import { addDays, isIsoDate, nowIso } from '@/lib/dates';
import { milestoneByKey, NOT_YET_DAYS, SNOOZE_DAYS } from '@/lib/milestones';
import { requireBaby } from '@/lib/server/access';
import { json, notFound, parseBody, requireUser, route } from '@/lib/server/api';

const Body = z.object({
  action: z.enum(['not_yet', 'snooze', 'hide', 'reset']),
  // The viewer's own calendar day; snoozes are counted from it so "a week"
  // ends on the day they expect, not on UTC's.
  today: z.string().refine(isIsoDate),
});

// Answering a nudge. "Not yet" and "Snooze" both put it away for a while;
// "hide" never asks again; "reset" forgets the answer.
export const PUT = route<{ id: string; key: string }>(async (req, { id, key }) => {
  const { user } = await requireUser(req);
  await requireBaby(user.id, id, 'editor');
  if (!milestoneByKey(key)) throw notFound();
  const { action, today } = await parseBody(req, Body);
  const d = await db();
  if (action === 'reset') {
    await d.delete(milestoneStatus).where(and(eq(milestoneStatus.babyId, id), eq(milestoneStatus.milestoneKey, key)));
    return json({ ok: true });
  }
  const row =
    action === 'hide'
      ? { status: 'hidden' as const, snoozedUntil: null }
      : action === 'snooze'
        ? { status: 'snoozed' as const, snoozedUntil: addDays(today, SNOOZE_DAYS) }
        : { status: 'not_yet' as const, snoozedUntil: addDays(today, NOT_YET_DAYS) };
  const updatedAt = nowIso();
  await d
    .insert(milestoneStatus)
    .values({ babyId: id, milestoneKey: key, ...row, updatedAt })
    .onConflictDoUpdate({ target: [milestoneStatus.babyId, milestoneStatus.milestoneKey], set: { ...row, updatedAt } });
  return json({ ok: true });
});
