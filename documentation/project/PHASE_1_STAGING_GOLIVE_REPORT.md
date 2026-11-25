# PHASE 1 REPORT — Supabase Go-Live Preparation & Generated Schema Types

_Date: 24 Nov 2026_

## 1. What Changed

1. **Supabase CLI Configuration & Auth Email Template (`{{ .Token }}`):**
   - Added `database/supabase/config.toml` configured for PostgreSQL 16, public `menu-images` and `branding` buckets (`2 MiB`), private `expense-attachments` bucket (`5 MiB`), disabled public self-signup (`enable_signup = false`), redirect URLs (`/reset-password` and `/login` for `http://localhost:3000`, staging, and production), 6-digit OTP recovery (`otp_length = 6`), and `[functions.manage-staff]` (`verify_jwt = false` at gateway so `OPTIONS` CORS preflight succeeds while `admin.auth.getUser(jwt)` enforces authentication inside `index.ts`).
   - Added `database/supabase/templates/recovery.html` containing both `{{ .Token }}` (for the 6-digit OTP verification card on `/login`) and `{{ .ConfirmationURL }}` (fallback reset link).

2. **Edge Function Deno Deployment Fix (`manage-staff`):**
   - Fixed `database/supabase/functions/manage-staff/index.ts` import from `./handler.js` to `./handler.ts` so Deno / Supabase Edge Runtime bundles the function without a missing-module error on deploy, and added `database/supabase/functions/manage-staff/deno.json`.

3. **Schema Inspection, Reconciliation & Staging Go-Live Script:**
   - Added `scripts/supabase-golive.mjs` (wired to root `package.json` as `npm run supabase:check`, `npm run supabase:reconcile`, and `npm run supabase:golive`):
     - `check-migrations`: verifies all 8 migrations (`000001`–`000008`) contain zero destructive drops, keep `ALTER TYPE … ADD VALUE` in isolated files (`000004`, `000006`), define storage buckets (`menu-images`, `branding`, `expense-attachments`), and include `{{ .Token }}` in `recovery.html`.
     - `reconcile <inspection.json>`: diffs output from `database/supabase/inspect_existing_schema.sql` against canonical table columns and emits additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` SQL if a shared staging database already holds SomBill tables with missing columns.
     - `deploy-staging`: links `$SUPABASE_PROJECT_REF`, pushes migrations, re-applies all 8 migrations via `$SUPABASE_DB_URL` to prove idempotency on staging, deploys `manage-staff`, sets `ALLOWED_ORIGINS`, and regenerates `database.types.ts`.

4. **Generated Supabase TypeScript Schema & Strict Client Typing:**
   - Generated `frontend/packages/shared-types/src/database.types.ts` matching `supabase gen types typescript --schema public` across all 31 tables, `table_status_v`, 39 RPCs/helpers, and 9 enums from migrations `000001`–`000008`.
   - Replaced hand-written row interfaces in `frontend/packages/shared-types/src/types.ts` with types derived directly from `Database['public']` (`Tables<...>`, `Enums<...>`) plus narrowed JSONB/check unions (`RestaurantSettings`, `ShiftSummary`, `VerificationStatus`, `LicenseStatus`).
   - Typed the shared client in `frontend/packages/api-client/src/supabase.ts` with `createClient<Database>(...)`.
   - Resolved all **16 exposed compile-time mismatches** across `AuthContext.tsx`, `settings.ts`, test fixtures (`fixtures.ts`, `mockAuth.tsx`, `posFixtures.ts`, `reports.test.ts`), and Manager / Waiter / Cashier / Super Admin pages (`BillDetail.tsx`, `PaymentPanel.tsx`, `NewSalePage.tsx`, `RefundsPage.tsx`, `ShiftPage.tsx`, `DashboardPage.tsx`, `PurchaseOrderDetailPage.tsx`, `SettingsPage.tsx`, `hq.ts`, `waiter/NewOrderPage.tsx`).
   - Added compile-time parity assertions in `frontend/packages/shared-types/src/__tests__/databaseTypes.test.ts`.

5. **Cross-Platform Browser Gate Reliability:**
   - Updated `frontend/apps/dashboards/e2e/run-tablet.mjs` to auto-detect Chrome/Edge on Windows and Linux and poll `http://127.0.0.1:4179` before launching browser suites.
   - Configured Testing Library `asyncUtilTimeout: 4000` in `frontend/packages/shared-utils/src/testing/setup.ts` to prevent cold `React.lazy` chunk transform timeouts under parallel Vitest workers.

## 2. Quality Gate Results

| Gate | Status | Result |
|---|---|---|
| TypeScript (`tsc --noEmit` Website + `tsc -b` Dashboards + Edge Function) | ✅ Passed | 0 errors |
| ESLint (`--max-warnings=0`, `no-explicit-any: error`) | ✅ Passed | 0 errors, 0 warnings |
| Prettier (`format:check` Website + Frontend) | ✅ Passed | All files formatted |
| Vitest (`frontend` + `database/supabase`) | ✅ Passed | **311 / 311** tests (25 dashboard/package suites = 301 + 1 Edge Function suite = 10) |
| Migration & Staging Readiness Check (`npm run supabase:check`) | ✅ Passed | 8 migrations, buckets, `config.toml`, `{{ .Token }}` verified |
| Production Builds (`vite build` Website + Dashboards) | ✅ Passed | Built cleanly |
| Real-Browser Suites (`tablet.mjs`, `hq.mjs`, `login.mjs`, `routes.mjs`) | ✅ Passed | Light & Dark: 78/78 tablet + 80mm PDF, 52/52 HQ, 32/32 login (EN/SO/AR RTL), 111/111 routes |
| PostgreSQL 16 Live SQL & Concurrency (`npm run test:db`) | ⚠️ Not run locally | Windows host has no `psql`/`initdb`/`pg_ctl`, WSL, or Docker installed (runs in GitHub Actions Ubuntu CI) |
| Hosted Supabase Staging Push, Deploy & Live Role Sign-In | ⚠️ Needs credentials | `frontend/apps/dashboards/.env.local` still contains placeholder values (`YOUR-PROJECT.supabase.co`) |

## 3. Operator Actions Required on Supabase Staging

Because no Supabase Staging credentials (`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are present on this machine, run these steps once your staging project is created:

1. **Inspect Existing Schema (if staging DB is non-empty):**
   - Run `database/supabase/inspect_existing_schema.sql` in the Supabase SQL Editor. If tables already exist, export query #1 as JSON and run:
     ```powershell
     npm run supabase:reconcile -- path\to\inspection.json
     ```
2. **Apply Migrations ×2, Deploy `manage-staff`, Set `ALLOWED_ORIGINS` & Refresh Types:**
   ```powershell
   $env:SUPABASE_PROJECT_REF = "<your-staging-project-ref>"
   $env:SUPABASE_ACCESS_TOKEN = "<your-supabase-access-token>"
   $env:SUPABASE_DB_URL = "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
   $env:ALLOWED_ORIGINS = "http://localhost:3000,https://<staging-domain>,https://<prod-domain>"
   npm run supabase:golive
   ```
3. **Verify Dashboard Auth Settings (Supabase Dashboard → Authentication):**
   - **URL Configuration:** Set Site URL to your staging domain and add Redirect URLs:
     - `http://localhost:3000/reset-password`
     - `https://<staging-domain>/reset-password`
     - `https://<prod-domain>/reset-password`
   - **Email Templates → Reset Password:** Paste the HTML from `database/supabase/templates/recovery.html` (ensuring `{{ .Token }}` is present).
   - **Providers → Email:** Confirm **Enable Sign Ups** is OFF (staff join via manager invitation).
4. **Configure Frontend `.env.local` & Verify Staging Role Sign-Ins:**
   - Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only) in `frontend/apps/dashboards/.env.local`.
   - Sign in with real `manager`, `waiter`, and `cashier` accounts on staging and confirm `/` routes each to `/dashboard`, `/waiter`, and `/cashier`.
