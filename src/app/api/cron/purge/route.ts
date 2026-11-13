import { safeEqual } from '@/lib/auth/crypto';
import { json } from '@/lib/server/api';
import { runPurge } from '@/lib/server/purge';

// Vercel Cron calls this nightly (vercel.json) with `Authorization: Bearer
// $CRON_SECRET`. A failure is reported in the status and the body: a
// scheduler that only ever sees 200 hides a purge that stopped working.
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(given, `Bearer ${secret}`)) return json({ error: { code: 'NOT_FOUND', message: "We couldn't find that." } }, { status: 404 });
  try {
    return json({ ok: true, purged: await runPurge() });
  } catch (e) {
    console.error('[cron] purge failed:', e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error');
    return json({ ok: false, error: { code: 'PURGE_FAILED', message: 'The purge did not finish.' } }, { status: 500 });
  }
}
