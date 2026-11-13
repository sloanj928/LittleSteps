// Makes an account an admin (or, with --revoke, stops it being one):
//
//   npm run admin:grant -- <username> [--revoke]
//
// There is deliberately no way to do this from inside the app: an admin can
// reset anyone's password, so becoming one takes database credentials.

import { createClient } from '@libsql/client';

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const username = args.find((a) => !a.startsWith('--'));
  const url = process.env.DATABASE_URL;
  if (!username || !url) {
    console.error('Usage: DATABASE_URL=... npm run admin:grant -- <username> [--revoke]');
    process.exit(1);
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const norm = username.normalize('NFKC').trim().toLowerCase();
  const result = await client.execute({ sql: 'UPDATE users SET is_admin = ? WHERE username_norm = ? AND deleted_at IS NULL', args: [revoke ? 0 : 1, norm] });
  if (result.rowsAffected === 0) {
    console.error(`No account named "${norm}".`);
    process.exit(1);
  }
  console.log(`${norm} is ${revoke ? 'no longer' : 'now'} an admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
