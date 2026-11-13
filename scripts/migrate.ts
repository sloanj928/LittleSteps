// Applies the versioned SQL migrations in ./drizzle to DATABASE_URL.
//
// Production rule (see the spec's data safety plan): run against a copy
// first, and take a backup right before anything destructive. This script
// refuses a remote database unless MIGRATE_CONFIRM=yes, so a stray
// environment variable cannot migrate production by accident.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:') && process.env.MIGRATE_CONFIRM !== 'yes') {
  console.error(`Refusing to migrate remote database ${url.replace(/\/\/.*@/, '//')} without MIGRATE_CONFIRM=yes.`);
  process.exit(1);
}

// Wrapped in a function: tsx runs this file as CommonJS, which has no top-level await.
async function main() {
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  await client.execute('PRAGMA foreign_keys = ON');
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
