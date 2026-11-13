import { json, route } from '@/lib/server/api';
import { clearSessionCookie, readSessionToken, revokeSession, validateSession } from '@/lib/server/session';

export const POST = route(async (req) => {
  const found = await validateSession(readSessionToken(req));
  if (found) await revokeSession(found.user.id, found.session.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(req) } });
});
