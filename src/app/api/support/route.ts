import { z } from 'zod';
import { db } from '@/db/client';
import { supportRequests } from '@/db/schema';
import { ApiError, json, parseBody, route } from '@/lib/server/api';
import { ipHashOf, ipLimited, recordAttempt } from '@/lib/server/attempts';

const Body = z.object({
  username: z.string().trim().min(1, 'Enter your username.').max(60),
  note: z.string().trim().min(1, 'Tell us what happened.').max(1000),
});

// Open to people who can't sign in, so it is rate-limited by address and
// answers the same whether or not the username exists.
export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const ip = ipHashOf(req);
  if (await ipLimited('support', ip)) throw new ApiError(429, 'RATE_LIMITED', 'You have sent a few requests already. We will get to them; please try again later if you need to add more.');
  await recordAttempt('support', ip, true);
  const d = await db();
  await d.insert(supportRequests).values({ id: crypto.randomUUID(), usernameEntered: body.username, note: body.note });
  return json({ ok: true }, { status: 201 });
});
