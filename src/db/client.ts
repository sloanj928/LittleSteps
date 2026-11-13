import 'server-only';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = LibSQLDatabase<typeof schema>;

// One client per server process. Vercel reuses a warm function's module scope,
// so this also saves a connection handshake on every request after the first.
let cached: { client: Client; db: Db } | undefined;

export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set (use file:local.db for development)');
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
    cached = { client, db: drizzle(client, { schema }) };
  }
  return cached.db;
}

// Turso and local SQLite both need foreign keys switched on per connection.
let foreignKeysOn: Promise<unknown> | undefined;
export async function db(): Promise<Db> {
  const d = getDb();
  foreignKeysOn ??= cached!.client.execute('PRAGMA foreign_keys = ON');
  await foreignKeysOn;
  return d;
}

/** Test-only: drop the cached client so the next call reads DATABASE_URL again. */
export function resetDbForTests() {
  cached?.client.close();
  cached = undefined;
  foreignKeysOn = undefined;
}
