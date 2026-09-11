#!/usr/bin/env node
/**
 * Pre-build check: fails if Supabase public env is missing (same condition as a broken EAS build).
 * Usage:
 *   node scripts/check-public-env.mjs
 *   eas env:exec --environment production -- node scripts/check-public-env.mjs
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.error('[check-public-env] MISSING required variables:');
  if (!url) console.error('  - EXPO_PUBLIC_SUPABASE_URL');
  if (!key) console.error('  - EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

if (!url.includes('supabase.co')) {
  console.error('[check-public-env] EXPO_PUBLIC_SUPABASE_URL does not look like a Supabase URL:', url);
  process.exit(1);
}

console.log('[check-public-env] OK — Supabase public env is present (key length:', key.length, ')');
