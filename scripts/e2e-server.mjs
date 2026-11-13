// Starts the built app for Playwright on an empty, freshly migrated database,
// so every run begins from the state a new deployment is in.
//
//   node scripts/e2e-server.mjs <port>      (after `npm run build`)

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const port = process.argv[2] ?? '3210';
const env = { ...process.env, DATABASE_URL: 'file:e2e.db', IP_HASH_SALT: 'e2e', CRON_SECRET: 'e2e' };
for (const f of ['e2e.db', 'e2e.db-journal', 'e2e.db-wal', 'e2e.db-shm']) rmSync(f, { force: true });

// Each tool's JS entry point under this Node: no shell, so nothing to escape on any OS.
const ENTRY = { tsx: 'node_modules/tsx/dist/cli.mjs', next: 'node_modules/next/dist/bin/next' };
const run = ([name, ...args]) => spawn(process.execPath, [ENTRY[name], ...args], { env, stdio: 'inherit' });
run(['tsx', 'scripts/migrate.ts']).on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  run(['next', 'start', '-p', port]).on('exit', (c) => process.exit(c ?? 0));
});
