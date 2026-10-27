// Applies new migrations with the Supabase CLI using the database URL from the root .env.
// Run from supabase/: npm run migrate
import { execFileSync } from 'node:child_process';

const db = process.env.POSTGRES_URL_NON_POOLING;
if (!db) throw new Error('POSTGRES_URL_NON_POOLING is not set in .env');
execFileSync('npx', ['supabase', 'db', 'push', '--db-url', db, '--yes'], { cwd: new URL('../..', import.meta.url), stdio: 'inherit', shell: true });
