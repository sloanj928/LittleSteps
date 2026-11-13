import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { babies, households, memberships, users } from '@/db/schema';
import { isCommonPassword } from '@/lib/auth/commonPasswords';
import { normalizeUsername, passwordProblem, pinProblem } from '@/lib/auth/rules';
import type { HouseholdSummary, Me, MeUser, PaletteId, ThemeId } from '@/lib/types';
import { ApiError } from './api';
import type { User } from './session';

export function toMeUser(user: User): MeUser {
  return {
    id: user.id,
    username: user.usernameDisplay,
    isAdmin: user.isAdmin,
    mustReset: user.mustReset,
    theme: user.theme as ThemeId,
    palette: user.palette as PaletteId,
    defaultDataView: user.defaultDataView,
    nudgesEnabled: user.nudgesEnabled,
  };
}

/** Everything the app shell needs on open: the user, their households, and each household's babies. */
export async function loadMe(user: User): Promise<Me> {
  if (user.mustReset) return { user: toMeUser(user), households: [] };
  const d = await db();
  const rows = await d
    .select({ id: households.id, name: households.name, role: memberships.role, ownerlessSince: households.ownerlessSince })
    .from(memberships)
    .innerJoin(households, eq(households.id, memberships.householdId))
    .where(and(eq(memberships.userId, user.id), isNull(households.deletedAt)))
    .orderBy(asc(memberships.joinedAt));
  const ids = rows.map((r) => r.id);
  const kids = ids.length ? await d.select().from(babies).where(inArray(babies.householdId, ids)).orderBy(asc(babies.birthDate)) : [];
  const list: HouseholdSummary[] = rows.map((r) => ({ ...r, babies: kids.filter((b) => b.householdId === r.id) }));
  return { user: toMeUser(user), households: list };
}

export async function findUserByUsername(raw: string): Promise<User | undefined> {
  const d = await db();
  const [user] = await d
    .select()
    .from(users)
    .where(and(eq(users.usernameNorm, normalizeUsername(raw)), isNull(users.deletedAt)));
  return user;
}

/** Throws the field-level validation error the forms render, or returns. */
export function assertPassword(password: string, username: string, field = 'password'): void {
  const problem = passwordProblem(password, username, isCommonPassword);
  if (problem) throw new ApiError(400, 'VALIDATION', 'Please check the highlighted fields.', { fields: { [field]: problem } });
}

export function assertPin(pin: string, field = 'pin'): void {
  const problem = pinProblem(pin);
  if (problem) throw new ApiError(400, 'VALIDATION', 'Please check the highlighted fields.', { fields: { [field]: problem } });
}
