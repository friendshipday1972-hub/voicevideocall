// Creates (or resets) the admin dashboard login.
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from the root .env, plus the Supabase URL and service key.
// Run from the repo root: node --env-file=.env supabase/scripts/create-admin.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!url || !service) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (!email || !password) throw new Error('Add ADMIN_EMAIL and ADMIN_PASSWORD to .env');
if (password.length < 10) throw new Error('Use an admin password of at least 10 characters');

const root = createClient(url, service, { auth: { persistSession: false } });

const { data: list } = await root.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email?.toLowerCase() === email);
if (user) {
  const { error } = await root.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  console.log('Admin login exists: password updated.');
} else {
  const { data, error } = await root.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
  console.log('Admin login created.');
}

const { error } = await root.from('profiles').upsert({ id: user.id, role: 'admin', display_name: 'Admin', email, status: 'active' });
if (error) throw error;
console.log(`Sign in to the dashboard with ${email}`);
