// The authorization matrix: every data route, called as an owner, an editor,
// a viewer, a signed-in outsider and nobody. A new route belongs in this
// table; the last test fails if one is missing.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getDeleted } from '@/app/api/babies/[id]/deleted/route';
import { POST as addEntry } from '@/app/api/babies/[id]/entries/route';
import { POST as addMeasurement } from '@/app/api/babies/[id]/measurements/route';
import { PUT as answerNudge } from '@/app/api/babies/[id]/milestones/[key]/route';
import { GET as getBaby, PATCH as patchBaby } from '@/app/api/babies/[id]/route';
import { DELETE as deleteEntry, GET as getEntry, PATCH as patchEntry } from '@/app/api/entries/[id]/route';
import { POST as addBaby } from '@/app/api/households/[id]/babies/route';
import { GET as exportData } from '@/app/api/households/[id]/export/route';
import { DELETE as revokeInvite } from '@/app/api/households/[id]/invites/[inviteId]/route';
import { GET as listInvites, POST as createInvite } from '@/app/api/households/[id]/invites/route';
import { DELETE as removeMember, PATCH as setRole } from '@/app/api/households/[id]/members/[userId]/route';
import { GET as listMembers, POST as claimHousehold } from '@/app/api/households/[id]/members/route';
import { DELETE as deleteHousehold, PATCH as renameHousehold } from '@/app/api/households/[id]/route';
import { DELETE as deleteMeasurement, PATCH as patchMeasurement } from '@/app/api/measurements/[id]/route';
import { call, closeDb, freshDb, makeWorld, PASSWORD, type World } from './harness';

let w: World;
let entryId: string;
let measurementId: string;

beforeAll(async () => {
  await freshDb();
  w = await makeWorld();
  const entry = await call(addEntry, { cookie: w.owner, params: { id: w.babyId }, body: { kind: 'note', title: 'Seed', date: '2026-06-01', datePrecision: 'day' } });
  entryId = entry.data.entry.id;
  const m = await call(addMeasurement, { cookie: w.owner, params: { id: w.babyId }, body: { date: '2026-06-01', weightOz: 200 } });
  measurementId = m.data.measurement.id;
});
afterAll(closeDb);

type Who = 'owner' | 'editor' | 'viewer';
const RANK: Record<Who, number> = { viewer: 0, editor: 1, owner: 2 };

interface Case {
  name: string;
  /** The lowest role that may do it. */
  min: Who;
  // Bodies are deliberately invalid where the action would change the shared
  // fixture: an allowed caller then gets a 400, which still proves the role
  // check let them through. A refused caller never reaches validation.
  run: (cookie: string | null) => Promise<{ status: number }>;
}

const cases: Case[] = [
  { name: 'GET baby bundle', min: 'viewer', run: (cookie) => call(getBaby, { cookie, params: { id: w.babyId } }) },
  { name: 'GET entry', min: 'viewer', run: (cookie) => call(getEntry, { cookie, params: { id: entryId } }) },
  { name: 'GET members', min: 'viewer', run: (cookie) => call(listMembers, { cookie, params: { id: w.householdId } }) },
  { name: 'POST claim ownerless household', min: 'viewer', run: (cookie) => call(claimHousehold, { method: 'POST', cookie, params: { id: w.householdId } }) },
  { name: 'GET recently deleted', min: 'editor', run: (cookie) => call(getDeleted, { cookie, params: { id: w.babyId } }) },
  { name: 'POST entry', min: 'editor', run: (cookie) => call(addEntry, { cookie, params: { id: w.babyId }, body: {} }) },
  { name: 'PATCH entry', min: 'editor', run: (cookie) => call(patchEntry, { method: 'PATCH', cookie, params: { id: entryId }, body: {} }) },
  { name: 'DELETE entry', min: 'editor', run: (cookie) => call(deleteEntry, { method: 'DELETE', cookie, params: { id: 'missing' } }) },
  { name: 'POST measurement', min: 'editor', run: (cookie) => call(addMeasurement, { cookie, params: { id: w.babyId }, body: {} }) },
  { name: 'PATCH measurement', min: 'editor', run: (cookie) => call(patchMeasurement, { method: 'PATCH', cookie, params: { id: measurementId }, body: {} }) },
  { name: 'DELETE measurement', min: 'editor', run: (cookie) => call(deleteMeasurement, { method: 'DELETE', cookie, params: { id: 'missing' } }) },
  { name: 'PUT nudge answer', min: 'editor', run: (cookie) => call(answerNudge, { method: 'PUT', cookie, params: { id: w.babyId, key: 'first_smile' }, body: {} }) },
  { name: 'PATCH baby', min: 'owner', run: (cookie) => call(patchBaby, { method: 'PATCH', cookie, params: { id: w.babyId }, body: {} }) },
  { name: 'POST baby', min: 'owner', run: (cookie) => call(addBaby, { cookie, params: { id: w.householdId }, body: {} }) },
  { name: 'PATCH household', min: 'owner', run: (cookie) => call(renameHousehold, { method: 'PATCH', cookie, params: { id: w.householdId }, body: {} }) },
  { name: 'DELETE household', min: 'owner', run: (cookie) => call(deleteHousehold, { method: 'DELETE', cookie, params: { id: w.householdId }, body: {} }) },
  { name: 'GET invites', min: 'owner', run: (cookie) => call(listInvites, { cookie, params: { id: w.householdId } }) },
  { name: 'POST invite', min: 'owner', run: (cookie) => call(createInvite, { cookie, params: { id: w.householdId }, body: {} }) },
  { name: 'DELETE invite', min: 'owner', run: (cookie) => call(revokeInvite, { method: 'DELETE', cookie, params: { id: w.householdId, inviteId: 'missing' } }) },
  { name: 'PATCH member role', min: 'owner', run: (cookie) => call(setRole, { method: 'PATCH', cookie, params: { id: w.householdId, userId: w.ids.viewer }, body: {} }) },
  { name: 'DELETE another member', min: 'owner', run: (cookie) => call(removeMember, { method: 'DELETE', cookie, params: { id: w.householdId, userId: 'missing' } }) },
  { name: 'GET export', min: 'owner', run: (cookie) => call(exportData, { cookie, params: { id: w.householdId }, query: '?format=nope' }) },
];

// The entry and measurement DELETE cases use a missing id, so for those a
// permitted caller sees 404 too. Their role check is proven separately below.
const TARGETLESS = new Set(['DELETE entry', 'DELETE measurement']);

describe('authorization matrix', () => {
  for (const c of cases) {
    describe(c.name, () => {
      it('refuses a signed-out caller', async () => {
        expect((await c.run(null)).status).toBe(401);
      });

      it('gives an outsider the same 404 as a missing id', async () => {
        expect((await c.run(w.outsider)).status).toBe(404);
      });

      for (const who of ['viewer', 'editor', 'owner'] as const) {
        const allowed = RANK[who] >= RANK[c.min];
        it(`${allowed ? 'lets' : 'stops'} ${who === 'owner' ? 'an' : 'a'} ${who}`, async () => {
          const { status } = await c.run(w[who]);
          if (allowed) expect([401, 403]).not.toContain(status);
          else if (!TARGETLESS.has(c.name)) expect(status).toBe(403);
        });
      }
    });
  }

  it('stops a viewer deleting a real entry or measurement, and an outsider from seeing either exists', async () => {
    expect((await call(deleteEntry, { method: 'DELETE', cookie: w.viewer, params: { id: entryId } })).status).toBe(403);
    expect((await call(deleteMeasurement, { method: 'DELETE', cookie: w.viewer, params: { id: measurementId } })).status).toBe(403);
    expect((await call(deleteEntry, { method: 'DELETE', cookie: w.outsider, params: { id: entryId } })).status).toBe(404);
    expect((await call(deleteMeasurement, { method: 'DELETE', cookie: w.outsider, params: { id: measurementId } })).status).toBe(404);
    expect((await call(getEntry, { cookie: w.owner, params: { id: entryId } })).data.entry.deletedAt).toBeNull();
  });

  it('lets a member leave, but nobody else remove them', async () => {
    const leave = (cookie: string, userId: string) => call(removeMember, { method: 'DELETE', cookie, params: { id: w.householdId, userId } });
    expect((await leave(w.editor, w.ids.viewer)).status).toBe(403);
    expect((await leave(w.viewer, w.ids.viewer)).status).toBe(200);
    expect((await call(getBaby, { cookie: w.viewer, params: { id: w.babyId } })).status).toBe(404);
  });

  it('never leaves a household without an owner', async () => {
    const res = await call(removeMember, { method: 'DELETE', cookie: w.owner, params: { id: w.householdId, userId: w.ids.owner } });
    expect(res.code).toBe('LAST_OWNER');
    const demote = await call(setRole, { method: 'PATCH', cookie: w.owner, params: { id: w.householdId, userId: w.ids.owner }, body: { role: 'editor' } });
    expect(demote.code).toBe('LAST_OWNER');
    // Making a second owner needs the password; after that the first may step down.
    const noPassword = await call(setRole, { method: 'PATCH', cookie: w.owner, params: { id: w.householdId, userId: w.ids.editor }, body: { role: 'owner' } });
    expect(noPassword.status).toBe(400);
    await call(setRole, { method: 'PATCH', cookie: w.owner, params: { id: w.householdId, userId: w.ids.editor }, body: { role: 'owner', password: PASSWORD } });
    const stepDown = await call(setRole, { method: 'PATCH', cookie: w.owner, params: { id: w.householdId, userId: w.ids.owner }, body: { role: 'editor' } });
    expect(stepDown.status).toBe(200);
  });

  it('covers every household and baby route file', () => {
    // Routes outside these folders act only on the caller's own account, or
    // are the admin console and cron, which auth.test.ts and purge.test.ts cover.
    const roots = ['babies', 'entries', 'measurements', 'households/[id]'];
    const count = (dir: string): number =>
      readdirSync(dir, { withFileTypes: true }).reduce((n, f) => n + (f.isDirectory() ? count(join(dir, f.name)) : f.name === 'route.ts' ? 1 : 0), 0);
    const files = roots.reduce((n, r) => n + count(join('src/app/api', r)), 0);
    // 14 files hold the 22 handlers in the table above.
    expect(files).toBe(14);
  });
});
