/* global process */
// scripts/seed.js
// One-time bootstrap script for Here App.
// Creates the City View org and initial admin user in Supabase.
//
// Usage:
//   node scripts/seed.js
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit this key).
// Safe to re-run — checks for existing records before inserting.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

const envVars = {}
try {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    envVars[key.trim()] = rest.join('=').trim()
  }
} catch {
  console.error('Could not read .env.local — make sure it exists at the project root.')
  process.exit(1)
}

const supabaseUrl = envVars['VITE_SUPABASE_URL']
const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const ORG = {
  name: 'City View Community High School',
  slug: 'city-view',
  settings: {
    timezone: 'America/Chicago',
    uses_rotation_schedule: true,
    rotation_day_names: ['A', 'B'],
    rotation_mode: 'continue',
  },
}

const ADMIN_USER = {
  email: process.env.SEED_USER_EMAIL,
  password: process.env.SEED_USER_PASSWORD,
  // Set seed user email and password in .env.local (never commit these).
  first_name: 'Daniel',
  last_name: 'Lang',
  roles: ['admin', 'teacher'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`  ${msg}`)
}

function success(msg) {
  console.log(`  ✓ ${msg}`)
}

function warn(msg) {
  console.log(`  ⚠ ${msg}`)
}

function fail(msg, err) {
  console.error(`  ✗ ${msg}`)
  if (err) console.error('   ', err.message ?? err)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 1: Create or find the organization
// ---------------------------------------------------------------------------

async function seedOrganization() {
  console.log('\n[1/3] Organization')

  // Check if it already exists
  const { data: existing, error: fetchError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', ORG.slug)
    .maybeSingle()

  if (fetchError) fail('Failed to query organizations', fetchError)

  if (existing) {
    warn(`Org already exists (id: ${existing.id}) — skipping insert`)
    return existing.id
  }

  const { data: created, error: insertError } = await supabase
    .from('organizations')
    .insert(ORG)
    .select('id')
    .single()

  if (insertError) fail('Failed to create organization', insertError)

  success(`Created org "${ORG.name}" (id: ${created.id})`)
  return created.id
}

// ---------------------------------------------------------------------------
// Step 2: Create or find the auth user
// ---------------------------------------------------------------------------

async function seedAuthUser(orgId) {
  console.log('\n[2/3] Auth user')

  // Check if auth user already exists by listing and filtering
  // (admin.getUserByEmail isn't available in all SDK versions)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) fail('Failed to list auth users', listError)

  const existing = users.find(u => u.email === ADMIN_USER.email)

  if (existing) {
    warn(`Auth user already exists (id: ${existing.id}) — skipping create`)
    return existing.id
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_USER.email,
    password: ADMIN_USER.password,
    email_confirm: true, // skip the confirmation email
    user_metadata: {
      organization_id: orgId,
      first_name: ADMIN_USER.first_name,
      last_name: ADMIN_USER.last_name,
      roles: ADMIN_USER.roles,
    },
  })

  if (createError) fail('Failed to create auth user', createError)

  success(`Created auth user ${ADMIN_USER.email} (id: ${created.user.id})`)
  return created.user.id
}

// ---------------------------------------------------------------------------
// Step 3: Verify the user_profiles row was created by the trigger
// ---------------------------------------------------------------------------

async function verifyProfile(userId) {
  console.log('\n[3/3] User profile')

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, email, first_name, last_name, roles, organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) fail('Failed to query user_profiles', error)

  if (!profile) {
    fail(
      'user_profiles row was NOT created automatically. ' +
      'Make sure the auth trigger migration (20260217000000_add_auth_trigger.sql) ' +
      'has been applied to your Supabase project before running this script.'
    )
  }

  success(`Profile exists for ${profile.email}`)
  log(`  Name:  ${profile.first_name} ${profile.last_name}`)
  log(`  Roles: ${profile.roles.join(', ')}`)
  log(`  Org:   ${profile.organization_id}`)
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('Here App — Seed Script')
console.log('======================')

const orgId = await seedOrganization()
const userId = await seedAuthUser(orgId)
await verifyProfile(userId)

console.log('\nDone! You can now log in with:')
console.log(`  Email:    ${ADMIN_USER.email}`)
console.log(`  Password: ${ADMIN_USER.password}`)
console.log('\nRemember to change your password after first login.\n')
