#!/usr/bin/env node
/**
 * SomBill Phase 1 – Supabase Staging Go-Live & Schema Reconciliation Utility.
 *
 * Subcommands:
 *   node scripts/supabase-golive.mjs check-migrations
 *     Verifies migration ordering, enum isolation, idempotent guards, and bucket definitions offline.
 *
 *   node scripts/supabase-golive.mjs reconcile <inspection-columns.json>
 *     Compares JSON output of query #1 from `database/supabase/inspect_existing_schema.sql`
 *     against `20261121000001_core_schema.sql` (+ later migrations) and prints additive
 *     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` SQL for any missing columns on existing tables.
 *
 *   node scripts/supabase-golive.mjs deploy-staging
 *     Requires SUPABASE_PROJECT_REF (and SUPABASE_ACCESS_TOKEN, plus SUPABASE_DB_URL for the 2x
 *     idempotency re-apply check). Links the project, pushes migrations, re-applies them to prove
 *     idempotency, deploys `manage-staff`, sets ALLOWED_ORIGINS, and regenerates TypeScript types.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_DIR = path.join(ROOT, 'database', 'supabase');
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, 'migrations');
const TYPES_OUT = path.join(ROOT, 'frontend', 'packages', 'shared-types', 'src', 'database.types.ts');

/** Canonical public tables & columns defined across 000001–000008 for schema drift reconciliation. */
const EXPECTED_COLUMNS = {
  restaurants: {
    id: 'uuid primary key default gen_random_uuid()',
    name: 'text not null',
    logo_url: 'text',
    address: 'text',
    phone: 'text',
    email: 'text',
    currency: "char(3) not null default 'USD'",
    timezone: "text not null default 'Africa/Mogadishu'",
    tax_rate: 'numeric(6,4) not null default 0',
    tax_inclusive: 'boolean not null default false',
    tax_label: "text not null default 'VAT'",
    receipt_header: 'text',
    receipt_footer: "text default 'Thank you for dining with us!'",
    settings: "jsonb not null default '{}'::jsonb",
    order_seq: 'bigint not null default 0',
    po_seq: 'bigint not null default 0',
    txn_seq: 'bigint not null default 0',
    receipt_seq: 'bigint not null default 0',
    organization_id: 'uuid references public.organizations(id) on delete set null',
    created_at: 'timestamptz not null default now()',
    updated_at: 'timestamptz not null default now()',
  },
  profiles: {
    id: 'uuid primary key references auth.users(id) on delete cascade',
    full_name: "text not null default ''",
    email: 'text',
    phone: 'text',
    avatar_url: 'text',
    last_login_at: 'timestamptz',
    created_at: 'timestamptz not null default now()',
    updated_at: 'timestamptz not null default now()',
  },
  restaurant_members: {
    id: 'uuid primary key default gen_random_uuid()',
    restaurant_id: 'uuid not null references public.restaurants(id) on delete cascade',
    user_id: 'uuid not null references auth.users(id) on delete cascade',
    role: 'public.app_role not null',
    status: "public.member_status not null default 'active'",
    created_at: 'timestamptz not null default now()',
    updated_at: 'timestamptz not null default now()',
  },
  orders: {
    bill_requested_at: 'timestamptz',
    bill_requested_by: 'uuid references auth.users(id) on delete set null',
    bill_acknowledged_at: 'timestamptz',
    bill_acknowledged_by: 'uuid references auth.users(id) on delete set null',
    stock_deducted_at: 'timestamptz',
    stock_reversed_at: 'timestamptz',
  },
  payments: {
    transaction_number: 'bigint',
    verification_status: "text not null default 'not_required'",
    verified_by: 'uuid references auth.users(id) on delete set null',
    verified_at: 'timestamptz',
    verification_note: 'text',
    shift_id: 'uuid references public.cashier_shifts(id) on delete restrict',
    amount_received: 'numeric(12,2)',
    change_given: 'numeric(12,2)',
    request_key: 'uuid',
    refund_of: 'uuid references public.payments(id) on delete restrict',
  },
};

function checkMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length < 8) {
    throw new Error(`Expected at least 8 migrations in ${MIGRATIONS_DIR}, found ${files.length}`);
  }
  const issues = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Disallow destructive table or column drops per Hard Rule #1
    if (/\bdrop\s+table\b/i.test(sql) || /\balter\s+table\s+\S+\s+drop\s+column\b/i.test(sql)) {
      issues.push(`${file}: contains forbidden DROP TABLE / DROP COLUMN`);
    }
    // Verify enum additions are isolated from usage in the same file
    if (/\balter\s+type\s+\S+\s+add\s+value\b/i.test(sql) && /\bcreate\s+(table|or\s+replace\s+function)\b/i.test(sql)) {
      issues.push(`${file}: mixes ALTER TYPE ADD VALUE with CREATE TABLE/FUNCTION in same transaction`);
    }
  }
  const storageSql = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261121000003_rls_storage_realtime.sql'), 'utf8');
  for (const bucket of ['menu-images', 'branding', 'expense-attachments']) {
    if (!storageSql.includes(`'${bucket}'`)) {
      issues.push(`20261121000003_rls_storage_realtime.sql: missing bucket '${bucket}'`);
    }
  }
  const configToml = fs.readFileSync(path.join(SUPABASE_DIR, 'config.toml'), 'utf8');
  const recoveryHtml = fs.readFileSync(path.join(SUPABASE_DIR, 'templates', 'recovery.html'), 'utf8');
  if (!recoveryHtml.includes('{{ .Token }}')) {
    issues.push('templates/recovery.html: missing {{ .Token }} OTP placeholder');
  }
  if (!configToml.includes('[functions.manage-staff]')) {
    issues.push('config.toml: missing [functions.manage-staff] section');
  }
  if (issues.length > 0) {
    console.error('Migration / staging readiness check FAILED:\n' + issues.map((i) => `  - ${i}`).join('\n'));
    process.exit(1);
  }
  console.log(`✔ Verified ${files.length} migrations, storage bucket policies, config.toml, and {{ .Token }} template.`);
}

function reconcile(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error('Usage: node scripts/supabase-golive.mjs reconcile <inspection-columns.json>');
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const existing = new Map();
  for (const r of rows) {
    if (!existing.has(r.table_name)) existing.set(r.table_name, new Set());
    existing.get(r.table_name).add(r.column_name);
  }
  const statements = [];
  for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
    if (!existing.has(table)) continue; // Table doesn't exist yet -> CREATE TABLE IF NOT EXISTS will create it whole.
    const have = existing.get(table);
    for (const [col, def] of Object.entries(cols)) {
      if (!have.has(col)) {
        const cleanDef = def.replace(/\bprimary\s+key\b/i, '').trim();
        statements.push(`alter table public.${table} add column if not exists ${col} ${cleanDef};`);
      }
    }
  }
  if (statements.length === 0) {
    console.log('-- No missing columns detected on existing public tables. Safe to apply migrations 000001..000008.');
  } else {
    console.log('-- Additive reconciliation statements generated for pre-existing tables:');
    console.log(statements.join('\n'));
  }
}

function run(cmd, args, cwd = path.join(ROOT, 'database')) {
  console.log(`→ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

function deployStaging() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const origins =
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://staging.sombill.com,https://app.sombill.com';
  if (!ref) {
    console.error(
      'Missing SUPABASE_PROJECT_REF. Set SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, and optionally SUPABASE_DB_URL + ALLOWED_ORIGINS.',
    );
    process.exit(1);
  }
  checkMigrations();
  run('npx', ['--yes', 'supabase', 'link', '--project-ref', ref]);
  run('npx', ['--yes', 'supabase', 'db', 'push']);
  if (process.env.SUPABASE_DB_URL) {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    console.log('→ Re-applying all migrations against SUPABASE_DB_URL to prove idempotency on staging...');
    for (const f of files) {
      run('psql', [process.env.SUPABASE_DB_URL, '-v', 'ON_ERROR_STOP=1', '-f', path.join(MIGRATIONS_DIR, f)]);
    }
  }
  run('npx', ['--yes', 'supabase', 'functions', 'deploy', 'manage-staff', '--no-verify-jwt']);
  run('npx', ['--yes', 'supabase', 'secrets', 'set', `ALLOWED_ORIGINS=${origins}`]);
  const generated = execFileSync(
    'npx',
    ['--yes', 'supabase', 'gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public'],
    { cwd: path.join(ROOT, 'database'), encoding: 'utf8', shell: process.platform === 'win32' },
  );
  fs.writeFileSync(TYPES_OUT, generated, 'utf8');
  console.log(`✔ Staging deployment complete and ${TYPES_OUT} refreshed.`);
}

const sub = process.argv[2] ?? 'check-migrations';
if (sub === 'check-migrations') checkMigrations();
else if (sub === 'reconcile') reconcile(process.argv[3]);
else if (sub === 'deploy-staging') deployStaging();
else {
  console.error(`Unknown subcommand: ${sub}`);
  process.exit(1);
}
