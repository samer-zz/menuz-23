# MENUZ — Final Master Engineering, Security, QA & Production Readiness Report

**Date:** 2026-11-20 (UTC)  
**Branch / PR:** `arena/296f4909-menuz-23` / PR #3 (`samer-zz/menuz-23`)  
**Production URL:** `https://menuz-23.vercel.app/`  
**Supabase Project:** `fmdfueuezjhnwwchoock`

---

## 1. Executive Summary of Hardening & Bug Fixes Completed

During the final ground-truth engineering audit across source code, Supabase live schema, and Vercel project configuration, the following critical production defects and security gaps were identified and resolved:

1. **Cron Maintenance Schema & Parameter Alignment (`src/app/api/cron/cleanup-notifications/route.ts` & `005`):**
   - Fixed RPC parameter mismatch from `p_batch_size` to `p_batch_limit` matching PostgreSQL `public.run_maintenance_cleanup(p_batch_limit integer)`.
   - Fixed legacy fallback table/column from non-existent `rate_limits.window_started_at` to actual `public.api_rate_limits.window_start`.
   - Stopped swallowing genuine DB/permission errors into legacy fallback (now returns HTTP `500` on non-missing-function errors).
   - Added due scheduled notification Web Push dispatch (`scheduled_for <= now() AND push_sent = false`).

2. **Atomic Order Idempotency, Least-Privilege Orders & History Retention (`005` & `src/app/api/orders/route.ts`):**
   - Replaced racy two-step `SELECT` + `INSERT` with atomic PostgreSQL RPC `public.create_order_atomic(...)` using `ON CONFLICT (tenant_id, idempotency_key) DO NOTHING` + `payload_hash` comparison.
   - Reused `idempotencyKey` with identical payload returns `200` (`duplicate: true`) without re-recording `order_submit` analytics or re-issuing feedback tokens; reused `idempotencyKey` with different payload returns **`409 Conflict`**.
   - Validated `walletId` strictly belongs to the target `tenantId` and `is_active = true` (`400` otherwise).
   - Removed broad `UPDATE` privilege on `public.orders` from `authenticated`; introduced safe `public.update_tenant_order_status(p_order_id, p_new_status)` RPC enforcing valid forward transitions (`sent -> confirmed -> completed` or `cancelled`).
   - Changed `orders.tenant_id` FK from `ON DELETE CASCADE` to `ON DELETE SET NULL` with `tenant_name_snapshot` so historical order records survive even if a tenant row is removed.

3. **Cryptographic Order-Eligibility Verification on Feedback (`005` & `src/app/api/feedback/route.ts`):**
   - `/api/orders` generates a CSPRNG `feedbackToken`, stores its SHA-256 `feedback_token_hash` on `public.orders`, and returns `feedbackToken` only in the order creation response.
   - `/api/feedback` verifies `orderId`, `tenantId`, and `timingSafeEqual(sha256(feedbackToken), feedback_token_hash)`, enforces unique `(order_id)` constraint (`409` on duplicate), and never returns fake `ok: true` on persistence failure.
   - Strict `super_admin`-only access on `public.order_feedback` verified on live PostgreSQL (`client_admin` and `anon` denied).

4. **Web Push SSRF Protection & Lifecycle (`src/lib/push-security.ts`, `src/lib/web-push-dispatch.ts`, `/api/push/{subscribe,send}`):**
   - Enforced strict HTTPS default-port allowlist of recognized browser Push Services (`fcm.googleapis.com`, `android.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`, `*.webpush.microsoft.com`).
   - Added DNS lookup verification rejecting all private/loopback/link-local/metadata IPv4 and IPv6 addresses (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`).
   - Added rate limiting to `DELETE /api/push/subscribe`, bounded batch concurrency (`10`) + `5000ms` timeout in `webPush.sendNotification`, automatic cleanup on HTTP `404`/`410`, and `push_sent` tracking.

5. **Image Decoder & Storage Hardening (`src/lib/image-validation.ts`, `src/app/api/manifest/[slug]/icon/route.ts`, `005`):**
   - Tightened `sharp` decode policy to `failOn: "warning"` in both upload sanitization and dynamic PWA icon generation, with `validateImageBuffer` pre-checks.
   - Applied `005` dropping direct `authenticated` write policies (`menus_media_admin_upload`, `menus_media_admin_update`, `menus_media_admin_delete`) on `storage.objects` and setting `menus-media` bucket limit to `4194304` bytes (4 MiB).

6. **Dashboard & Menu UX Completion:**
   - Added Tenant Appearance Colors customization card inside `TenantMenuManager` -> Settings tab (calling `update_client_tenant_appearance` RPC with live WCAG contrast ratio indicator).
   - Added Scheduled Notification date/time picker in `TenantMenuManager` -> Notifications tab.
   - Added Order Status progression controls (`تأكيد` / `إكمال` / `إلغاء`) inside `ClientDashboardClient` -> Orders tab using `update_tenant_order_status` RPC.
   - Converted `NEXT_PUBLIC_VAPID_PUBLIC_KEY` via `urlBase64ToUint8Array` for cross-browser Safari/iOS/Firefox `pushManager.subscribe` compatibility.

---

## 2. Database Migration & Rollback Verification (`fmdfueuezjhnwwchoock`)

- **Pre-Migration Backup:** Logical JSON snapshot of `tenants` (3), `categories` (8), `menu_items` (23), `offers` (4), `wallets` (4), `notifications` (2), `profiles` (4) verified via Supabase `execute_query` before migration.
- **Migration Applied:** `005_menuz_v4_platform_hardening` applied atomically via `supabase:create_migration`.
- **Post-Migration Data Integrity Check:** All existing records preserved (`tenants=3`, `categories=8`, `menu_items=23`, `offers=4`, `wallets=4`, `storage.objects=12`, `analytics_events=83`).
- **Live PostgreSQL RLS & Privilege Assertions (`DO $$` verification):**
  - `anon` denied on `orders`, `order_feedback`, `push_subscriptions`.
  - Cross-tenant `client_admin` (`indomito`) blocked from reading `demo` orders, blocked from reading ANY `order_feedback`, blocked from direct `UPDATE` on `orders`, and blocked from mutating `demo` order status.
  - `super_admin` verified reading `order_feedback` and advancing order status `sent -> confirmed -> completed` with terminal state protection.
  - `create_order_atomic` verified `created`, `duplicate`, and `conflict` outcomes; `run_maintenance_cleanup(5000)` verified.
  - All temporary verification rows removed cleanly after assertion (`orders=0`, `order_feedback=0`, `analytics_events=83`).

### Emergency Rollback Plan (If Needed)
Migration `005` is additive for all existing tables (`tenants`, `categories`, `menu_items`, `offers`, `wallets`, `notifications`, `profiles`) and drops only legacy direct Storage upload policies. If an emergency revert is ever required without losing customer orders:
1. Revert the application deployment in Vercel to the previous Production deployment (`dpl_34JufLApW8K7bqvoNCDGB3E9hrU8`).
2. Restore Storage policies only if legacy direct client uploads were temporarily re-enabled (not recommended).
3. Keep `orders` and `order_feedback` tables intact so zero recorded orders are ever lost.

---

## 3. Verification & Test Matrix

| Check | Result | Scope / Evidence |
|---|---|---|
| `npm run typecheck` | Pass | 0 TypeScript errors |
| `npm run lint` | Pass | 0 ESLint warnings/errors |
| `node --test tests/*.test.mjs` | Pass (17/17) | Security, Sharp, Cron contract, Atomic Orders + Feedback, Push SSRF/DNS, Scalability simulation |
| `npm run build` | Pass | Production build clean (30 routes + Middleware) |
| Live Local Production (`next start`) | Pass | HTTP 200 on 10 public/API/manifest routes, strict prod CSP/XFO headers, `/admin` & `/dashboard` `307 -> /login`, negative `403`/`401` checks |
| HTTP Load Test (Local Prod) | Pass | 120 requests at concurrency 20 across 6 routes (`0` errors, `p50=38.0ms`) |
| Live Supabase RLS/RPC Check | Pass | Applied `005`, verified `anon`/`client_admin`/`super_admin` isolation & Storage lockdown |

---

## 4. Vercel Environment Variables (`menuz-23`)

| Key | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Configured | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Configured | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Configured (Encrypted) | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | Configured | Production, Preview, Development |
| `CRON_SECRET` | Configured (Encrypted) | Production, Preview, Development |
| `VAPID_SUBJECT` | Configured (`mailto:admin@menuz.app`) | Production, Preview, Development |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Owner Action Optional | Generate locally via `npx web-push generate-vapid-keys` and add in Vercel Settings to enable external browser Web Push (In-App Realtime Notifications are active without it) |
| `VAPID_PRIVATE_KEY` | Owner Action Optional | Set as Sensitive in Vercel alongside `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
