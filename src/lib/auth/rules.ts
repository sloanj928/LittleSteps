// Username, password and PIN rules. Pure functions, shared by the sign-up form
// (instant feedback) and the server (the real check).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const RESERVED = new Set(['admin', 'administrator', 'support', 'system', 'root', 'littlesteps', 'little.steps', 'help', 'moderator', 'staff']);

/**
 * The form a username is compared and indexed by. NFKC folds compatibility
 * forms (full-width "ａ" -> "a", ligatures), then case and outer space go.
 */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

/**
 * Null when acceptable, else a message for the person typing it.
 *
 * Only ASCII letters, digits, "_" and "." survive. That closes the lookalike
 * hole outright (Cyrillic "а" for Latin "a" cannot be typed into a name)
 * rather than chasing confusable tables.
 */
export function usernameProblem(raw: string): string | null {
  const norm = normalizeUsername(raw);
  if (norm.length < USERNAME_MIN || norm.length > USERNAME_MAX) return `Use ${USERNAME_MIN} to ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9_.]+$/.test(norm)) return 'Use only letters, numbers, underscores and periods.';
  if (/^\.|\.$|\.\./.test(norm)) return "Periods can't start, end, or sit next to each other.";
  if (RESERVED.has(norm)) return 'That username is reserved. Try another.';
  return null;
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

export function passwordProblem(password: string, username?: string, isCommon?: (p: string) => boolean): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^(.)\1+$/.test(password)) return 'Pick something less repetitive.';
  const lower = password.toLowerCase();
  if (username && lower.includes(normalizeUsername(username))) return "Your password can't contain your username.";
  if (isCommon?.(lower)) return 'That password is too common. Try a short phrase only you would know.';
  return null;
}

const TRIVIAL_PINS = new Set(['123123', '112233', '121212', '111222', '159753', '147258', '258369', '102030', '010203', '696969', '199000', '200000']);

export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return 'Use exactly 6 digits.';
  if (/^(\d)\1{5}$/.test(pin)) return 'Pick a PIN that is harder to guess.';
  const digits = [...pin].map(Number);
  const step = digits[1] - digits[0];
  if (Math.abs(step) === 1 && digits.every((d, i) => i === 0 || d - digits[i - 1] === step)) return 'Pick a PIN that is harder to guess.';
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin) || TRIVIAL_PINS.has(pin)) return 'Pick a PIN that is harder to guess.';
  return null;
}
