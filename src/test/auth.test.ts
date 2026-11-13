import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as completeReset } from '@/app/api/auth/complete-reset/route';
import { POST as reset } from '@/app/api/auth/reset/route';
import { POST as signin } from '@/app/api/auth/signin/route';
import { POST as signout } from '@/app/api/auth/signout/route';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as tempPassword } from '@/app/api/admin/users/[id]/temp-password/route';
import { GET as lookup } from '@/app/api/admin/users/route';
import { GET as auditLogRoute } from '@/app/api/admin/audit/route';
import { POST as deleteAccount } from '@/app/api/me/delete/route';
import { POST as changePassword } from '@/app/api/me/password/route';
import { GET as meRoute } from '@/app/api/me/route';
import { DELETE as signOutOthers, GET as listSessions } from '@/app/api/me/sessions/route';
import { POST as support } from '@/app/api/support/route';
import { getDb } from '@/db/client';
import { authState, sessions, users } from '@/db/schema';
import { call, closeDb, freshDb, me, PASSWORD, PIN, signUp } from './harness';

beforeEach(freshDb);
afterAll(closeDb);

const signIn = (username: string, password = PASSWORD, ip?: string) => call(signin, { body: { username, password }, ip });

describe('sign-up', () => {
  it('creates an account and signs it in', async () => {
    const cookie = await signUp('Mama.Bear');
    expect((await me(cookie)).user.username).toBe('Mama.Bear');
  });

  it('treats usernames as the same whatever their case', async () => {
    await signUp('mama');
    const again = await call(signup, { body: { username: 'MAMA', password: PASSWORD, pin: PIN } });
    expect(again.code).toBe('USERNAME_TAKEN');
  });

  it('stores only hashes of the password and PIN', async () => {
    await signUp('mama');
    const [row] = await getDb().select().from(users);
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.pinHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
  });

  it('sets the session cookie httpOnly and SameSite=Lax, and stores only its hash', async () => {
    const res = await call(signup, { body: { username: 'mama', password: PASSWORD, pin: PIN } });
    const raw = res.headers.get('set-cookie')!;
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Lax');
    const token = res.cookie!.split('=')[1];
    const [session] = await getDb().select().from(sessions);
    expect(session.tokenHash).not.toBe(token);
    expect(session.tokenHash).toHaveLength(64);
  });

  it('rejects a weak password or PIN with a field error', async () => {
    const weak = await call(signup, { body: { username: 'mama', password: 'password123', pin: PIN } });
    expect(weak.data.error.details.fields.password).toBeTruthy();
    const pin = await call(signup, { body: { username: 'mama', password: PASSWORD, pin: '123456' } });
    expect(pin.data.error.details.fields.pin).toBeTruthy();
  });
});

describe('sign-in', () => {
  it('gives the same answer for a wrong password and an unknown username', async () => {
    await signUp('mama');
    const wrong = await signIn('mama', 'not the password');
    const unknown = await signIn('nobody', 'not the password');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.data).toEqual(unknown.data);
  });

  it('locks the account after five wrong passwords, even for the right one', async () => {
    await signUp('mama');
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      // Clear the short back-off between guesses; the count is what is under test.
      await db.update(authState).set({ loginLockedUntil: null });
      expect((await signIn('mama', 'wrong password')).status).toBe(401);
    }
    const locked = await signIn('mama');
    expect(locked.code).toBe('LOCKED');
    // The lock is a time, not a permanent state.
    await db.update(authState).set({ loginLockedUntil: new Date(Date.now() - 1000).toISOString() });
    expect((await signIn('mama')).status).toBe(200);
  });

  it('makes each wrong guess wait before the next', async () => {
    await signUp('mama');
    await signIn('mama', 'wrong password');
    expect((await signIn('mama')).code).toBe('LOCKED');
  });

  it('limits attempts from one address across accounts', async () => {
    for (let i = 0; i < 30; i++) await signIn(`ghost${i}`, 'whatever it is', '192.0.2.1');
    expect((await signIn('ghost', 'whatever it is', '192.0.2.1')).code).toBe('RATE_LIMITED');
    // Another address is unaffected.
    expect((await signIn('ghost', 'whatever it is', '192.0.2.2')).status).toBe(401);
  });

  it('refuses a request from another site', async () => {
    await signUp('mama');
    const res = await call(signin, { body: { username: 'mama', password: PASSWORD }, origin: 'https://evil.example' });
    expect(res.code).toBe('BAD_ORIGIN');
    const none = await call(signin, { body: { username: 'mama', password: PASSWORD }, origin: null });
    expect(none.code).toBe('BAD_ORIGIN');
  });
});

describe('sessions', () => {
  it('signs out, and the old cookie stops working', async () => {
    const cookie = await signUp('mama');
    await call(signout, { method: 'POST', cookie });
    expect((await call(meRoute, { cookie })).status).toBe(401);
  });

  it('slides the expiry at most once a day, and never past the 90-day cap', async () => {
    const cookie = await signUp('mama');
    const db = getDb();
    const [before] = await db.select().from(sessions);
    await me(cookie);
    expect((await db.select().from(sessions))[0].expiresAt).toBe(before.expiresAt);

    // Two days idle, with the absolute cap only five days away.
    const cap = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await db.update(sessions).set({ lastSeenAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), absoluteExpiresAt: cap });
    await me(cookie);
    expect((await db.select().from(sessions))[0].expiresAt).toBe(cap);
  });

  it('rejects an expired session', async () => {
    const cookie = await signUp('mama');
    await getDb().update(sessions).set({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await call(meRoute, { cookie })).status).toBe(401);
  });

  it('lists devices and signs out the others', async () => {
    const first = await signUp('mama');
    const second = (await signIn('mama')).cookie!;
    expect((await call(listSessions, { cookie: first })).data.sessions).toHaveLength(2);
    await call(signOutOthers, { method: 'DELETE', cookie: first });
    expect((await call(meRoute, { cookie: second })).status).toBe(401);
    expect((await call(meRoute, { cookie: first })).status).toBe(200);
  });

  it('asks for the password again before changing it, then signs out other devices', async () => {
    const first = await signUp('mama');
    const second = (await signIn('mama')).cookie!;
    const wrong = await call(changePassword, { cookie: first, body: { password: 'not my password', newPassword: 'a brand new phrase' } });
    expect(wrong.code).toBe('WRONG_PASSWORD');
    await getDb().update(authState).set({ loginLockedUntil: null });
    const ok = await call(changePassword, { cookie: first, body: { password: PASSWORD, newPassword: 'a brand new phrase' } });
    expect(ok.status).toBe(200);
    expect((await call(meRoute, { cookie: second })).status).toBe(401);
    expect((await signIn('mama', 'a brand new phrase')).status).toBe(200);
  });
});

describe('password reset by PIN', () => {
  const tryReset = (username: string, pin: string, ip?: string) => call(reset, { body: { username, pin, newPassword: 'a brand new phrase' }, ip });
  const clearBackoff = () => getDb().update(authState).set({ pinLockedUntil: null });

  it('resets the password, signs in, and signs out every other device', async () => {
    const old = await signUp('mama');
    const res = await tryReset('mama', PIN);
    expect(res.status).toBe(200);
    expect((await call(meRoute, { cookie: old })).status).toBe(401);
    expect((await call(meRoute, { cookie: res.cookie })).status).toBe(200);
    expect((await signIn('mama', 'a brand new phrase')).status).toBe(200);
  });

  it('answers a wrong PIN, an unknown username and a paused account identically', async () => {
    await signUp('mama');
    const wrongPin = await tryReset('mama', '999999');
    const unknown = await tryReset('nobody', '999999');
    // Paused by the back-off after the wrong PIN: even the right PIN gets the same answer.
    const paused = await tryReset('mama', PIN);
    expect(wrongPin.status).toBe(400);
    expect(unknown.data).toEqual(wrongPin.data);
    expect(paused.data).toEqual(wrongPin.data);
  });

  it('pauses reset for a day after five wrong PINs, and freezes it after three such days', async () => {
    await signUp('mama');
    const db = getDb();
    for (let round = 1; round <= 3; round++) {
      for (let i = 0; i < 5; i++) {
        await clearBackoff();
        await tryReset('mama', '999999', `192.0.2.${round * 10 + i}`);
      }
      const [state] = await db.select().from(authState);
      expect(state.pinLockoutsInRow).toBe(round);
      expect(Date.parse(state.pinLockedUntil!) - Date.now()).toBeGreaterThan(23 * 3_600_000);
      expect(state.pinFrozen).toBe(round === 3);
    }
    // Frozen: the right PIN no longer works, even once the day has passed.
    await clearBackoff();
    expect((await tryReset('mama', PIN, '192.0.2.99')).code).toBe('RESET_FAILED');
  });

  it('does not check the PIN at all while paused', async () => {
    await signUp('mama');
    await getDb().update(authState).set({ pinLockedUntil: new Date(Date.now() + 3_600_000).toISOString() });
    await tryReset('mama', '999999');
    const [state] = await getDb().select().from(authState);
    expect(state.pinFailures).toBe(0);
  });
});

describe('admin recovery', () => {
  async function makeAdmin() {
    const cookie = await signUp('the.admin');
    await getDb().update(users).set({ isAdmin: true }).where(eq(users.usernameNorm, 'the.admin'));
    return cookie;
  }

  it('hides the console from everyone else', async () => {
    const cookie = await signUp('mama');
    expect((await call(lookup, { cookie, query: '?username=mama' })).status).toBe(404);
    expect((await call(lookup, { cookie: null, query: '?username=mama' })).status).toBe(401);
  });

  it('issues a one-time password that forces a new password and PIN', async () => {
    const admin = await makeAdmin();
    const userCookie = await signUp('mama');
    const found = await call(lookup, { cookie: admin, query: '?username=MAMA' });
    expect(found.data.username).toBe('mama');
    // Nothing about households or babies comes back.
    expect(Object.keys(found.data).sort()).toEqual(['createdAt', 'deletionScheduledFor', 'id', 'mustReset', 'pinFrozen', 'pinPaused', 'signInPaused', 'username']);

    const issued = await call(tempPassword, { cookie: admin, params: { id: found.data.id }, body: { password: PASSWORD } });
    const temp = issued.data.tempPassword as string;
    expect(temp).toHaveLength(14);
    expect((await call(meRoute, { cookie: userCookie })).status).toBe(401);
    expect((await signIn('mama')).status).toBe(401);

    await getDb().update(authState).set({ loginLockedUntil: null });
    const signedIn = await signIn('mama', temp);
    expect(signedIn.data.mustReset).toBe(true);
    // Until the reset is finished, nothing else works.
    expect((await call(listSessions, { cookie: signedIn.cookie })).code).toBe('MUST_RESET');
    const done = await call(completeReset, { cookie: signedIn.cookie, body: { newPassword: 'a brand new phrase', newPin: '385207' } });
    expect(done.status).toBe(200);
    expect((await call(listSessions, { cookie: signedIn.cookie })).status).toBe(200);
    expect((await signIn('mama', temp)).status).toBe(401);

    const log = (await call(auditLogRoute, { cookie: admin })).data.log as { action: string; target: string }[];
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['user.lookup', 'user.temp_password']));
    expect(JSON.stringify(log)).not.toContain(temp);
  });

  it('unfreezes PIN reset', async () => {
    const admin = await makeAdmin();
    await signUp('mama');
    const [target] = await getDb().select().from(users).where(eq(users.usernameNorm, 'mama'));
    await getDb().update(authState).set({ pinFrozen: true, pinLockoutsInRow: 3 }).where(eq(authState.userId, target.id));
    await call(tempPassword, { cookie: admin, params: { id: target.id }, body: { password: PASSWORD } });
    const [state] = await getDb().select().from(authState).where(eq(authState.userId, target.id));
    expect(state.pinFrozen).toBe(false);
  });
});

describe('support form', () => {
  it('answers the same for any username, and limits requests per address', async () => {
    await signUp('mama');
    const real = await call(support, { body: { username: 'mama', note: 'Locked out' }, ip: '192.0.2.50' });
    const fake = await call(support, { body: { username: 'nobody', note: 'Locked out' }, ip: '192.0.2.50' });
    expect(real.status).toBe(201);
    expect(fake.data).toEqual(real.data);
    for (let i = 0; i < 3; i++) await call(support, { body: { username: 'mama', note: 'Again' }, ip: '192.0.2.50' });
    expect((await call(support, { body: { username: 'mama', note: 'Again' }, ip: '192.0.2.50' })).code).toBe('RATE_LIMITED');
  });
});

describe('account deletion', () => {
  it('waits 30 days, signs out, and is cancelled by signing in', async () => {
    const cookie = await signUp('mama');
    const res = await call(deleteAccount, { cookie, body: { password: PASSWORD } });
    const days = (Date.parse(res.data.scheduledFor) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect((await call(meRoute, { cookie })).status).toBe(401);

    const back = await signIn('mama');
    expect(back.data.deletionCancelled).toBe(true);
    const [row] = await getDb().select().from(users);
    expect(row.deletionScheduledFor).toBeNull();
  });
});
