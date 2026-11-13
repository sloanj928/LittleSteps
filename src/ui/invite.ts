// Invite links: `/join#CODE`. The code rides in the fragment, which the
// browser never sends, so it stays out of server logs and Referer headers.
// It is held in sessionStorage while the invited person signs up or signs
// in, so they land back on /join afterwards instead of an empty welcome.

const PENDING_KEY = 'ls_pending_invite';

/** The code inside whatever was pasted or opened: a bare code, "ABCD 2345", or a whole link. */
export function inviteCodeFrom(text: string): string {
  return (text.split('#').pop() ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 40);
}

export function inviteLink(code: string): string {
  return `${location.origin}/join#${code}`;
}

// Storage can throw (Safari private mode, blocked site data); an invite
// that isn't remembered only costs a second tap on the link.
export function pendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function rememberInvite(code: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, code);
  } catch {}
}

export function forgetInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

/** Where a fresh sign-in goes: back to the invite that brought them, if there is one. */
export function homeAfterSignIn(): string {
  return pendingInvite() ? '/join' : '/';
}
