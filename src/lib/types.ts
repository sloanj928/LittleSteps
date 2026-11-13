// Shapes the API returns, shared by the route handlers and the client.
// Type-only imports: nothing from the database layer reaches the browser bundle.

import type { babies, entries, entryHistory, measurements, Role } from '@/db/schema';
import type { NudgeStatus } from './milestones';

export type Baby = typeof babies.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Measurement = typeof measurements.$inferSelect;
export type EntryHistoryRow = typeof entryHistory.$inferSelect;

export const PALETTE_IDS = ['sage', 'blush', 'sky', 'sand', 'lavender'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
/** Remembers the palette so the server can render the right colours on the very first paint. */
export const PALETTE_COOKIE = 'ls_palette';
export const THEME_IDS = ['classic', 'nursery'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface MeUser {
  id: string;
  username: string;
  isAdmin: boolean;
  mustReset: boolean;
  theme: ThemeId;
  palette: PaletteId;
  defaultDataView: boolean;
  nudgesEnabled: boolean;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: Role;
  /** Set while the household waits for a new owner. */
  ownerlessSince: string | null;
  babies: Baby[];
}

export interface Me {
  user: MeUser;
  households: HouseholdSummary[];
}

export interface BabyBundle {
  baby: Baby;
  role: Role;
  entries: Entry[];
  measurements: Measurement[];
  statuses: NudgeStatus[];
  /** Current members' usernames by id. An author missing from it has left: "former member". */
  people: Record<string, string>;
}

export interface Member {
  userId: string;
  username: string;
  role: Role;
  joinedAt: string;
}

export interface InviteSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

export interface SessionSummary {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { fields?: Record<string, string>; [k: string]: unknown } };
}
