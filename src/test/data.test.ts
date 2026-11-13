import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { GET as getDeleted } from '@/app/api/babies/[id]/deleted/route';
import { POST as addEntry } from '@/app/api/babies/[id]/entries/route';
import { POST as addMeasurement } from '@/app/api/babies/[id]/measurements/route';
import { PUT as answerNudge } from '@/app/api/babies/[id]/milestones/[key]/route';
import { GET as getBaby } from '@/app/api/babies/[id]/route';
import { GET as purgeRoute } from '@/app/api/cron/purge/route';
import { DELETE as deleteEntry, GET as getEntry, PATCH as patchEntry } from '@/app/api/entries/[id]/route';
import { GET as exportData } from '@/app/api/households/[id]/export/route';
import { DELETE as revokeInvite } from '@/app/api/households/[id]/invites/[inviteId]/route';
import { GET as listInvites, POST as createInvite } from '@/app/api/households/[id]/invites/route';
import { DELETE as removeMember } from '@/app/api/households/[id]/members/[userId]/route';
import { POST as claimHousehold } from '@/app/api/households/[id]/members/route';
import { POST as createHousehold } from '@/app/api/households/route';
import { POST as joinRoute } from '@/app/api/invites/join/route';
import { POST as deleteAccount } from '@/app/api/me/delete/route';
import { getDb } from '@/db/client';
import { authState, entries, households, invites, memberships, users } from '@/db/schema';
import { runPurge } from '@/lib/server/purge';
import type { BabyBundle, Entry } from '@/lib/types';
import { addMember, call, closeDb, freshDb, makeWorld, me, PASSWORD, signUp, type World } from './harness';

let w: World;
beforeEach(async () => {
  await freshDb();
  w = await makeWorld();
});
afterAll(closeDb);

const first = { kind: 'first', title: 'First steps', milestoneKey: 'first_steps', date: '2026-11-01', datePrecision: 'day' };
const add = (cookie: string, body: object) => call(addEntry, { cookie, params: { id: w.babyId }, body });
const bundle = async (cookie = w.owner) => (await call(getBaby, { cookie, params: { id: w.babyId } })).data as BabyBundle;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('entries', () => {
  it('warns when a first is logged twice, and saves both if confirmed', async () => {
    expect((await add(w.owner, first)).status).toBe(201);
    const again = await add(w.editor, { ...first, date: '2026-11-02' });
    expect(again.code).toBe('DUPLICATE');
    expect(again.data.error.details.existing.date).toBe('2026-11-01');
    expect((await add(w.editor, { ...first, confirmDuplicate: true })).status).toBe(201);
  });

  it('matches custom firsts and words whatever their case, but lets foods repeat', async () => {
    await add(w.owner, { kind: 'word', title: 'Dada', date: '2026-10-01', datePrecision: 'day' });
    expect((await add(w.owner, { kind: 'word', title: 'dada', date: '2026-10-05', datePrecision: 'day' })).code).toBe('DUPLICATE');
    const food = { kind: 'food', title: 'Banana', date: '2026-10-01', datePrecision: 'day', reaction: 'loved' };
    expect((await add(w.owner, food)).status).toBe(201);
    expect((await add(w.owner, food)).status).toBe(201);
  });

  it('files a food under its group and keeps the allergy flag apart from the reaction', async () => {
    const res = await add(w.owner, { kind: 'food', title: 'Mashed banana', date: '2026-10-01', datePrecision: 'day', reaction: 'loved', allergyFlag: true });
    const entry = res.data.entry as Entry;
    expect(entry.foodGroup).toBe('fruit');
    expect(entry.reaction).toBe('loved');
    expect(entry.allergyFlag).toBe(true);
  });

  it('drops fields that belong to another kind', async () => {
    const res = await add(w.owner, { kind: 'note', title: 'Slept well', date: '2026-10-01', datePrecision: 'day', reaction: 'loved', allergyFlag: true, milestoneKey: null });
    expect(res.data.entry.reaction).toBeNull();
    expect(res.data.entry.allergyFlag).toBe(false);
  });

  it('takes approximate and unremembered dates, and refuses a date with "unknown"', async () => {
    expect((await add(w.owner, { kind: 'first', title: 'First laugh', date: '2026-07-01', datePrecision: 'season' })).status).toBe(201);
    expect((await add(w.owner, { kind: 'first', title: 'First bath', date: null, datePrecision: 'unknown' })).status).toBe(201);
    expect((await add(w.owner, { kind: 'first', title: 'First trip', date: '2026-07-01', datePrecision: 'unknown' })).status).toBe(400);
    expect((await add(w.owner, { kind: 'first', title: 'First swim', date: '2999-01-01', datePrecision: 'day' })).status).toBe(400);
  });

  it('keeps history on edit, and can put an old version back', async () => {
    const created = (await add(w.owner, { kind: 'note', title: 'Original', date: '2026-10-01', datePrecision: 'day' })).data.entry as Entry;
    const edit = await call(patchEntry, { method: 'PATCH', cookie: w.editor, params: { id: created.id }, body: { kind: 'note', title: 'Edited', date: '2026-10-02', datePrecision: 'day', expectedUpdatedAt: created.updatedAt } });
    expect(edit.data.entry.title).toBe('Edited');

    const detail = await call(getEntry, { cookie: w.viewer, params: { id: created.id } });
    expect(detail.data.history).toHaveLength(1);
    expect(detail.data.history[0].changedBy).toBe('eli.editor');
    expect(JSON.parse(detail.data.history[0].beforeJson).title).toBe('Original');

    const reverted = await call(patchEntry, { method: 'PATCH', cookie: w.owner, params: { id: created.id }, body: { revertTo: detail.data.history[0].id } });
    expect(reverted.data.entry.title).toBe('Original');
    expect(reverted.data.entry.date).toBe('2026-10-01');
  });

  it('tells the second of two simultaneous editors instead of overwriting', async () => {
    const created = (await add(w.owner, { kind: 'note', title: 'Original', date: '2026-10-01', datePrecision: 'day' })).data.entry as Entry;
    const edit = { kind: 'note', date: '2026-10-01', datePrecision: 'day', expectedUpdatedAt: created.updatedAt };
    await call(patchEntry, { method: 'PATCH', cookie: w.owner, params: { id: created.id }, body: { ...edit, title: 'Mine' } });
    const second = await call(patchEntry, { method: 'PATCH', cookie: w.editor, params: { id: created.id }, body: { ...edit, title: 'Theirs' } });
    expect(second.code).toBe('CONFLICT');
    expect(second.data.error.details.entry.title).toBe('Mine');
  });

  it('soft-deletes, lists the deleted entry, and restores it', async () => {
    const created = (await add(w.owner, first)).data.entry as Entry;
    await call(deleteEntry, { method: 'DELETE', cookie: w.editor, params: { id: created.id } });
    expect((await bundle()).entries).toHaveLength(0);
    expect((await call(getDeleted, { cookie: w.editor, params: { id: w.babyId } })).data.entries).toHaveLength(1);
    await call(patchEntry, { method: 'PATCH', cookie: w.editor, params: { id: created.id }, body: { restore: true } });
    expect((await bundle()).entries).toHaveLength(1);
  });

  it('shows a removed member as missing from the people list, and keeps their entries', async () => {
    await add(w.editor, first);
    await call(removeMember, { method: 'DELETE', cookie: w.owner, params: { id: w.householdId, userId: w.ids.editor } });
    const b = await bundle();
    expect(b.entries).toHaveLength(1);
    expect(b.people[b.entries[0].createdBy]).toBeUndefined();
  });
});

describe('measurements and nudges', () => {
  it('saves an unusual measurement rather than refusing it', async () => {
    const res = await call(addMeasurement, { cookie: w.editor, params: { id: w.babyId }, body: { date: '2026-06-01', weightOz: 900 } });
    expect(res.status).toBe(201);
    const none = await call(addMeasurement, { cookie: w.editor, params: { id: w.babyId }, body: { date: '2026-06-01' } });
    expect(none.status).toBe(400);
  });

  it('records snoozes from the viewer\'s own day', async () => {
    const answer = (action: string) => call(answerNudge, { method: 'PUT', cookie: w.editor, params: { id: w.babyId, key: 'first_smile' }, body: { action, today: '2026-05-01' } });
    await answer('snooze');
    expect((await bundle()).statuses[0]).toMatchObject({ status: 'snoozed', snoozedUntil: '2026-05-08' });
    await answer('not_yet');
    expect((await bundle()).statuses[0]).toMatchObject({ status: 'not_yet', snoozedUntil: '2026-05-15' });
    await answer('hide');
    expect((await bundle()).statuses[0]).toMatchObject({ status: 'hidden', snoozedUntil: null });
    await answer('reset');
    expect((await bundle()).statuses).toHaveLength(0);
  });
});

describe('invites', () => {
  const invite = async () => (await call(createInvite, { cookie: w.owner, params: { id: w.householdId }, body: { password: PASSWORD } })).data.code as string;
  const join = (cookie: string, code: string, ip?: string) => call(joinRoute, { cookie, body: { code }, ip });

  it('needs the password, stores only a hash, and never lists the code', async () => {
    const wrong = await call(createInvite, { cookie: w.owner, params: { id: w.householdId }, body: { password: 'not the password' } });
    expect(wrong.code).toBe('WRONG_PASSWORD');
    await getDb().update(authState).set({ loginLockedUntil: null });
    const code = await invite();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    const rows = await getDb().select().from(invites);
    expect(JSON.stringify(rows)).not.toContain(code);
    const listed = await call(listInvites, { cookie: w.owner, params: { id: w.householdId } });
    expect(JSON.stringify(listed.data)).not.toContain(code);
  });

  it('joins as a viewer, once, forgiving case and dashes', async () => {
    const code = await invite();
    const newcomer = await signUp('nia.new');
    const res = await join(newcomer, `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase());
    expect(res.status).toBe(201);
    expect((await me(newcomer)).households[0].role).toBe('viewer');
    const second = await signUp('sam.second');
    expect((await join(second, code)).code).toBe('INVALID_CODE');
  });

  it('refuses expired and revoked codes', async () => {
    const expired = await invite();
    await getDb().update(invites).set({ expiresAt: daysAgo(1) });
    expect((await join(w.outsider, expired)).code).toBe('INVALID_CODE');

    const revoked = await invite();
    const [row] = (await call(listInvites, { cookie: w.owner, params: { id: w.householdId } })).data.invites;
    await call(revokeInvite, { method: 'DELETE', cookie: w.owner, params: { id: w.householdId, inviteId: row.id } });
    expect((await join(w.outsider, revoked, '192.0.2.77')).code).toBe('INVALID_CODE');
  });

  it('caps unused invites per household and wrong guesses per person', async () => {
    for (let i = 0; i < 5; i++) await invite();
    const sixth = await call(createInvite, { cookie: w.owner, params: { id: w.householdId }, body: { password: PASSWORD } });
    expect(sixth.code).toBe('INVITE_CAP');

    for (let i = 0; i < 5; i++) expect((await join(w.outsider, `WRONG${i}XX`, `192.0.2.${i}`)).code).toBe('INVALID_CODE');
    expect((await join(w.outsider, 'WRONG9XX', '192.0.2.200')).code).toBe('RATE_LIMITED');
  });

  it('does not spend a code on someone already in the household', async () => {
    const code = await invite();
    expect((await join(w.viewer, code)).code).toBe('ALREADY_MEMBER');
    expect((await join(w.outsider, code)).status).toBe(201);
  });
});

describe('export', () => {
  it('gives the owner JSON and CSV, with formulas defused and deleted rows left out', async () => {
    await add(w.owner, { kind: 'note', title: '=HYPERLINK("http://evil")', date: '2026-10-01', datePrecision: 'day', note: 'has, a comma' });
    const gone = (await add(w.owner, first)).data.entry as Entry;
    await call(deleteEntry, { method: 'DELETE', cookie: w.owner, params: { id: gone.id } });

    const csv = await call(exportData, { cookie: w.owner, params: { id: w.householdId }, query: '?format=entries.csv' });
    expect(csv.headers.get('content-disposition')).toContain('attachment');
    expect(csv.data).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv.data).toContain('"has, a comma"');
    expect(csv.data).not.toContain('First steps');

    const json = await call(exportData, { cookie: w.owner, params: { id: w.householdId }, query: '?format=json' });
    expect(json.data.babies[0].name).toBe('Juniper');
    expect(json.data.babies[0].entries).toHaveLength(1);
    // Account details are not part of a household's data.
    expect(JSON.stringify(json.data)).not.toMatch(/passwordHash|pinHash|olive\.owner/);
  });
});

describe('nightly purge', () => {
  it('needs the cron secret', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const call404 = await purgeRoute(new Request('http://localhost:3000/api/cron/purge'));
    expect(call404.status).toBe(404);
    const ok = await purgeRoute(new Request('http://localhost:3000/api/cron/purge', { headers: { authorization: 'Bearer test-secret' } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).ok).toBe(true);
  });

  it('removes entries deleted over 30 days ago and keeps newer ones', async () => {
    const old = (await add(w.owner, first)).data.entry as Entry;
    const recent = (await add(w.owner, { kind: 'note', title: 'Recent', date: '2026-10-01', datePrecision: 'day' })).data.entry as Entry;
    const db = getDb();
    await db.update(entries).set({ deletedAt: daysAgo(31) }).where(eq(entries.id, old.id));
    await db.update(entries).set({ deletedAt: daysAgo(29) }).where(eq(entries.id, recent.id));
    expect((await runPurge()).entries).toBe(1);
    expect((await db.select().from(entries)).map((e) => e.id)).toEqual([recent.id]);
  });

  it('blocks deleting an account that would strand a household', async () => {
    const res = await call(deleteAccount, { cookie: w.owner, body: { password: PASSWORD } });
    expect(res.code).toBe('TRANSFER_FIRST');
  });

  it('hands a purged owner\'s household to the longest-standing editor', async () => {
    await addMember(w, 'lena.later', 'editor');
    // Scheduled directly: the API refuses this deletion (the test above), but
    // the purge must still cope with an owner who is already on their way out.
    const db = getDb();
    await db.update(users).set({ deletionScheduledFor: daysAgo(1) }).where(eq(users.id, w.ids.owner));
    expect((await runPurge()).users).toBe(1);

    const roles = await db.select().from(memberships).where(eq(memberships.householdId, w.householdId));
    expect(roles.find((r) => r.userId === w.ids.editor)?.role).toBe('owner');
    expect(roles.some((r) => r.userId === w.ids.owner)).toBe(false);
    // The name is free again, and the entries they wrote remain.
    const [gone] = await db.select().from(users).where(eq(users.id, w.ids.owner));
    expect(gone.usernameNorm).toBe(`deleted:${w.ids.owner}`);
    expect(gone.passwordHash).toBe('');
    expect((await signUp('olive.owner')).length).toBeGreaterThan(0);
  });

  it('leaves a household with only viewers ownerless for 30 days, claimable, then deletes it', async () => {
    const db = getDb();
    await call(removeMember, { method: 'DELETE', cookie: w.owner, params: { id: w.householdId, userId: w.ids.editor } });
    await db.update(users).set({ deletionScheduledFor: daysAgo(1) }).where(eq(users.id, w.ids.owner));
    await runPurge();
    const [waiting] = await db.select().from(households);
    expect(waiting.ownerlessSince).not.toBeNull();
    expect((await me(w.viewer)).households[0].ownerlessSince).not.toBeNull();

    // Unclaimed for 30 days: gone, with its babies and entries.
    await db.update(households).set({ ownerlessSince: daysAgo(31) });
    expect((await runPurge()).households).toBe(1);
    expect(await db.select().from(households)).toHaveLength(0);
    expect((await me(w.viewer)).households).toHaveLength(0);
  });

  it('lets a remaining member claim an ownerless household', async () => {
    const db = getDb();
    await db.update(households).set({ ownerlessSince: daysAgo(2) });
    const res = await call(claimHousehold, { method: 'POST', cookie: w.viewer, params: { id: w.householdId } });
    expect(res.status).toBe(200);
    expect((await me(w.viewer)).households[0]).toMatchObject({ role: 'owner', ownerlessSince: null });
  });

  it('deletes a sole member\'s household with their account', async () => {
    const solo = await signUp('solo.parent');
    await call(createHousehold, { cookie: solo, body: { name: 'Just us' } });
    expect((await call(deleteAccount, { cookie: solo, body: { password: PASSWORD } })).status).toBe(200);
    await getDb().update(users).set({ deletionScheduledFor: daysAgo(1) }).where(eq(users.usernameNorm, 'solo.parent'));
    await runPurge();
    expect((await getDb().select().from(households)).map((h) => h.name)).toEqual(['The Nest']);
  });
});
