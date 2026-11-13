// Test harness: route handlers run directly against a throwaway SQLite file,
// through the same code path as production (same-origin check, session
// cookie, role checks). No server, no mocks.

import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb, resetDbForTests } from '@/db/client';
import { POST as signupRoute } from '@/app/api/auth/signup/route';
import { POST as createHousehold } from '@/app/api/households/route';
import { POST as createInvite } from '@/app/api/households/[id]/invites/route';
import { PATCH as setRole } from '@/app/api/households/[id]/members/[userId]/route';
import { POST as createBaby } from '@/app/api/households/[id]/babies/route';
import { POST as joinRoute } from '@/app/api/invites/join/route';
import { GET as meRoute } from '@/app/api/me/route';
import type { Role } from '@/db/schema';
import type { Me } from '@/lib/types';

const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct horse battery';
export const PIN = '274916';

let file: string | undefined;

// Children before parents, so the wipe satisfies the foreign keys.
const TABLES = ['entry_history', 'entries', 'measurements', 'milestone_status', 'babies', 'invites', 'memberships', 'households', 'sessions', 'auth_state', 'auth_attempts', 'support_requests', 'audit_log', 'users'];

/**
 * An empty, migrated database. Each test file gets one SQLite file and wipes
 * it between tests: Windows won't delete a file the client still has open,
 * so a file per test is not an option.
 */
export async function freshDb(): Promise<void> {
  if (!file) {
    file = join(tmpdir(), `little-steps-test-${randomUUID()}.db`);
    process.env.DATABASE_URL = `file:${file}`;
    resetDbForTests();
    await migrate(getDb(), { migrationsFolder: 'drizzle' });
    return;
  }
  for (const table of TABLES) await getDb().run(sql.raw(`DELETE FROM ${table}`));
}

export function closeDb(): void {
  resetDbForTests();
  try {
    if (file) rmSync(file, { force: true });
  } catch {
    // Still held open on Windows; the OS temp folder is cleaned for us.
  }
  file = undefined;
}

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

export interface CallOptions<P> {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  params?: P;
  query?: string;
  ip?: string;
  /** Override or drop (null) the Origin header, to test the cross-site check. */
  origin?: string | null;
}

export async function call<P = Record<string, never>>(handler: Handler<P>, opts: CallOptions<P> = {}) {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { host: 'localhost:3000', 'x-forwarded-for': opts.ip ?? '203.0.113.7' };
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin) headers.origin = origin;
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`${ORIGIN}/api/test${opts.query ?? ''}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // CSV exports are not JSON; the raw text is what the test wants.
  }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data, code: data?.error?.code as string | undefined, cookie: setCookie ? setCookie.split(';')[0] : null, headers: res.headers };
}

/** Creates an account and returns its session cookie. */
export async function signUp(username: string, ip?: string): Promise<string> {
  const res = await call(signupRoute, { body: { username, password: PASSWORD, pin: PIN }, ip: ip ?? `198.51.100.${Math.floor(Math.random() * 250)}` });
  if (res.status !== 201 || !res.cookie) throw new Error(`sign-up failed: ${JSON.stringify(res.data)}`);
  return res.cookie;
}

export async function me(cookie: string): Promise<Me> {
  return (await call(meRoute, { cookie })).data as Me;
}

export interface World {
  householdId: string;
  babyId: string;
  owner: string;
  editor: string;
  viewer: string;
  /** Signed in, but not in the household. */
  outsider: string;
  ids: Record<'owner' | 'editor' | 'viewer' | 'outsider', string>;
}

/** Adds a member through the real invite flow, then gives them their role. */
export async function addMember(w: Pick<World, 'householdId' | 'owner'>, username: string, role: Exclude<Role, 'owner'>): Promise<{ cookie: string; id: string }> {
  const cookie = await signUp(username);
  const invite = await call(createInvite, { cookie: w.owner, params: { id: w.householdId }, body: { password: PASSWORD } });
  const joined = await call(joinRoute, { cookie, body: { code: invite.data.code } });
  if (joined.status !== 201) throw new Error(`join failed: ${JSON.stringify(joined.data)}`);
  const id = (await me(cookie)).user.id;
  if (role !== 'viewer') await call(setRole, { method: 'PATCH', cookie: w.owner, params: { id: w.householdId, userId: id }, body: { role } });
  return { cookie, id };
}

/** One household with a baby, and one account in each role plus an outsider. */
export async function makeWorld(): Promise<World> {
  const owner = await signUp('olive.owner');
  const household = await call(createHousehold, { cookie: owner, body: { name: 'The Nest' } });
  const householdId = household.data.id as string;
  const baby = await call(createBaby, { cookie: owner, params: { id: householdId }, body: { name: 'Juniper', birthDate: '2026-03-10', sex: 'female' } });
  const editor = await addMember({ householdId, owner }, 'eli.editor', 'editor');
  const viewer = await addMember({ householdId, owner }, 'vera.viewer', 'viewer');
  const outsider = await signUp('otto.outsider');
  return {
    householdId,
    babyId: baby.data.id as string,
    owner,
    editor: editor.cookie,
    viewer: viewer.cookie,
    outsider,
    ids: { owner: (await me(owner)).user.id, editor: editor.id, viewer: viewer.id, outsider: (await me(outsider)).user.id },
  };
}
