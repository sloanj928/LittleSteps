import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, validateSession } from './session';

/** The signed-in user for a server-rendered page, or null. API routes read the cookie from the Request instead. */
export async function pageSession() {
  return validateSession((await cookies()).get(SESSION_COOKIE)?.value);
}
