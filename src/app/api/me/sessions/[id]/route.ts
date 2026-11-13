import { json, requireUser, route } from '@/lib/server/api';
import { revokeSession } from '@/lib/server/session';

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  // Scoped to the caller's own sessions inside revokeSession.
  await revokeSession(user.id, id);
  return json({ ok: true });
});
