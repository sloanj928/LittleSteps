import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Conventions (see the spec's data model):
// - ids are random UUID text;
// - instants are UTC ISO strings (`createdAt`, `expiresAt`);
// - dates a parent chooses (a first, a measurement, a birth date) are
//   date-only 'YYYY-MM-DD' strings, never timestamps, so no time zone can
//   move a baby's birthday;
// - rows are soft-deleted through `deletedAt` so mistakes are undoable.

const id = () => text('id').primaryKey();
const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const users = sqliteTable('users', {
  id: id(),
  usernameDisplay: text('username_display').notNull(),
  usernameNorm: text('username_norm').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  // Set when an admin issues a temporary password: the next sign-in must
  // choose a new password and PIN before anything else.
  mustReset: integer('must_reset', { mode: 'boolean' }).notNull().default(false),
  theme: text('theme').notNull().default('classic'),
  palette: text('palette').notNull().default('sage'),
  defaultDataView: integer('default_data_view', { mode: 'boolean' }).notNull().default(false),
  nudgesEnabled: integer('nudges_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  // Deletion waits 30 days; signing in again before then cancels it.
  deletionScheduledFor: text('deletion_scheduled_for'),
  deletedAt: text('deleted_at'),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: text('last_seen_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    absoluteExpiresAt: text('absolute_expires_at').notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

// One row per sign-in, PIN or invite-code attempt. Per-IP limits count these;
// per-account locks live on auth_state so a check is one row read.
export const authAttempts = sqliteTable(
  'auth_attempts',
  {
    id: id(),
    kind: text('kind', { enum: ['login', 'pin', 'invite', 'support', 'signup'] }).notNull(),
    userId: text('user_id'),
    ipHash: text('ip_hash').notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('auth_attempts_ip_idx').on(t.kind, t.ipHash, t.createdAt), index('auth_attempts_user_idx').on(t.kind, t.userId, t.createdAt)],
);

export const authState = sqliteTable('auth_state', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  loginFailures: integer('login_failures').notNull().default(0),
  loginWindowStart: text('login_window_start'),
  loginLockedUntil: text('login_locked_until'),
  pinFailures: integer('pin_failures').notNull().default(0),
  pinLockedUntil: text('pin_locked_until'),
  // Consecutive 24-hour PIN locks; the third freezes PIN reset until an admin
  // recovers the account.
  pinLockoutsInRow: integer('pin_lockouts_in_row').notNull().default(0),
  pinFrozen: integer('pin_frozen', { mode: 'boolean' }).notNull().default(false),
});

export const supportRequests = sqliteTable('support_requests', {
  id: id(),
  usernameEntered: text('username_entered').notNull(),
  note: text('note').notNull(),
  status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).notNull().default('open'),
  createdAt: createdAt(),
  handledBy: text('handled_by').references(() => users.id),
  handledAt: text('handled_at'),
});

export const auditLog = sqliteTable('audit_log', {
  id: id(),
  actorId: text('actor_id')
    .notNull()
    .references(() => users.id),
  action: text('action').notNull(),
  targetUserId: text('target_user_id').references(() => users.id),
  detail: text('detail'),
  createdAt: createdAt(),
});

export const households = sqliteTable('households', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
  // Set when the last owner's account is purged and no editor can take over:
  // the household waits 30 days for an owner, then is deleted.
  ownerlessSince: text('ownerless_since'),
  deletedAt: text('deleted_at'),
});

export const ROLES = ['viewer', 'editor', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const memberships = sqliteTable(
  'memberships',
  {
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: ROLES }).notNull().default('viewer'),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] }), index('memberships_user_idx').on(t.userId)],
);

export const invites = sqliteTable(
  'invites',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    codeHash: text('code_hash').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    expiresAt: text('expires_at').notNull(),
    usedBy: text('used_by').references(() => users.id),
    usedAt: text('used_at'),
    revokedAt: text('revoked_at'),
  },
  (t) => [index('invites_household_idx').on(t.householdId)],
);

export const babies = sqliteTable(
  'babies',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    birthDate: text('birth_date').notNull(),
    sex: text('sex', { enum: ['male', 'female'] }),
    dueDate: text('due_date'),
    correctedAge: integer('corrected_age', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('babies_household_idx').on(t.householdId)],
);

export const ENTRY_KINDS = ['first', 'food', 'word', 'note'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const DATE_PRECISIONS = ['day', 'month', 'season', 'unknown'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];
export const REACTIONS = ['loved', 'neutral', 'disliked'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const FOOD_GROUPS = ['fruit', 'vegetable', 'grain', 'protein', 'dairy', 'other'] as const;
export type FoodGroup = (typeof FOOD_GROUPS)[number];

export const entries = sqliteTable(
  'entries',
  {
    id: id(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    kind: text('kind', { enum: ENTRY_KINDS }).notNull(),
    title: text('title').notNull(),
    // Library firsts carry their milestone key, so a logged "first steps"
    // retires the matching nudge and two people logging it are caught.
    milestoneKey: text('milestone_key'),
    // A representative day for sorting: the 1st for a month, the middle month's
    // 1st for a season, null when the parent doesn't remember.
    date: text('date'),
    datePrecision: text('date_precision', { enum: DATE_PRECISIONS }).notNull().default('day'),
    reaction: text('reaction', { enum: REACTIONS }),
    // Kept apart from `reaction` on purpose: "disliked" is taste, an allergy
    // reaction is safety, and merging them would bury the one that matters.
    allergyFlag: integer('allergy_flag', { mode: 'boolean' }).notNull().default(false),
    foodGroup: text('food_group', { enum: FOOD_GROUPS }),
    note: text('note'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('entries_baby_date_idx').on(t.babyId, t.date), index('entries_baby_kind_idx').on(t.babyId, t.kind)],
);

export const measurements = sqliteTable(
  'measurements',
  {
    id: id(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    date: text('date').notNull(),
    // Imperial as entered; converted to metric only to look up percentiles.
    weightOz: real('weight_oz'),
    lengthIn: real('length_in'),
    headIn: real('head_in'),
    note: text('note'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('measurements_baby_date_idx').on(t.babyId, t.date)],
);

export const MILESTONE_STATUSES = ['hidden', 'snoozed', 'not_yet'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

// The milestone library itself ships as code (src/lib/milestones.ts) so its
// reviewed wording is versioned with the app; this table only records what a
// household chose to do with each nudge. "Done" is not stored: a logged first
// with the milestone's key is the record of it.
export const milestoneStatus = sqliteTable(
  'milestone_status',
  {
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    milestoneKey: text('milestone_key').notNull(),
    status: text('status', { enum: MILESTONE_STATUSES }).notNull(),
    snoozedUntil: text('snoozed_until'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.babyId, t.milestoneKey] })],
);

export const entryHistory = sqliteTable(
  'entry_history',
  {
    id: id(),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id),
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
    beforeJson: text('before_json').notNull(),
    changedAt: createdAt(),
  },
  (t) => [index('entry_history_entry_idx').on(t.entryId)],
);
