import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Argon2id is the library's default algorithm; each hash embeds its own
// random salt. OWASP's minimum profile (19 MiB, 2 passes) keeps a sign-in
// well under a serverless function's budget.
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashSecret(secret: string): Promise<string> {
  return hash(secret, ARGON);
}

export async function verifySecret(hashed: string, secret: string): Promise<boolean> {
  try {
    return await verify(hashed, secret);
  } catch {
    return false;
  }
}

// Verifying against this when the username doesn't exist makes an unknown
// name take as long as a wrong password, so timing can't reveal which it was.
let dummy: Promise<string> | undefined;
export async function burnVerify(secret: string): Promise<void> {
  dummy ??= hashSecret('little-steps-timing-equaliser');
  await verifySecret(await dummy, secret);
}

/** 256 random bits, URL-safe. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Session tokens and invite codes are stored only as this hash. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Invite codes and temporary passwords avoid characters people misread
// (0/O, 1/I/L), since they are read aloud or copied by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function readableCode(length: number): string {
  const bytes = randomBytes(length);
  // 256 % 31 leaves a slight bias toward the first few characters; with 31
  // symbols it costs under 0.1 bit per character, which is acceptable here.
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** IPs are kept only as a keyed hash: enough to rate-limit, useless if leaked. */
export function hashIp(ip: string): string {
  return sha256(`${process.env.IP_HASH_SALT ?? 'dev-salt'}:${ip}`);
}
