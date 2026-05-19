/**
 * One-time script to create the test account in Supabase.
 * Run: node scripts/seed-user.js
 *
 * Requires the following vars in .env (or exported in your shell):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SEED_EMAIL
 *   SEED_PASSWORD
 *   SEED_NAME  (optional, defaults to 'Ali Imran')
 *
 * Safe to re-run — if the user already exists it prints the error and exits.
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL    = process.env.SEED_EMAIL;
const PASSWORD = process.env.SEED_PASSWORD;
const NAME     = process.env.SEED_NAME ?? 'Ali Imran';
const TAGS     = ['math', 'coding'];

const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SEED_EMAIL', 'SEED_PASSWORD']
  .filter(k => !process.env[k]);

if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Add them to .env or export them in your shell before running this script.');
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  console.log(`Signing up ${EMAIL}…`);
  const { data, error } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD });

  if (error) {
    console.error('signUp error:', error.message);
    process.exit(1);
  }

  const userId = data.user?.id;
  if (!userId) {
    console.error('No user ID returned. Email confirmation may be required — check Supabase Auth settings.');
    process.exit(1);
  }

  console.log('User created:', userId);

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    name: NAME,
    tags: TAGS,
  });

  if (profileError) {
    console.error('profiles insert error:', profileError.message);
    console.log('(If RLS blocks this, the profile will be created automatically on first app login via the register flow.)');
  } else {
    console.log('Profile row inserted.');
  }

  console.log('\nDone. Login with:');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

main();
