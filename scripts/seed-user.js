/**
 * One-time script to create the test account in Supabase.
 * Run: node scripts/seed-user.js
 *
 * Creates ali@strivo.app / Strivo123! with a profiles row (name: Ali Imran).
 * Safe to re-run — if the user already exists it prints the error and exits.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vobvpbqtpmtvuabannjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ni3oxpqRzugzRy-uWJxOrg_-oPXKgDA';

const EMAIL    = 'ali@strivo.app';
const PASSWORD = 'Strivo123!';
const NAME     = 'Ali Imran';
const TAGS     = ['math', 'coding'];

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
