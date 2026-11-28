# سجل التقدم والمتابعة — MENUZ | Arena Progress

> آخر تحديث: 2026-11-28  
> الفرع النشط: `arena/296f4909-menuz-23` (مفرّع من `main` @ `6e15b0417855d4b9af0378bc96a1b9edacf06477`)  
> حالة Pull Request: **PR #3 (`OPEN` / `MERGEABLE`)** — `https://github.com/samer-zz/menuz-23/pull/3`  
> المرحلة الحالية: **المرحلة 1 — Security & Database + Security Review Fixes (مكتملة وجاهزة لمراجعة الدمج؛ لم يُدمج تلقائياً)**

---

## 1. ملاحظة مرجعية
- لم يكن ملف `docs/MENUZ_AUDIT_REPORT.md` موجوداً مسبقاً عند بدء المرحلة 1؛ جرى تدقيق القاعدة والكود والـ Migrations المطبقة فعلياً، ثم تنفيذ المرحلة 1 وتوثيق المراجعة الأمنية الحرجة لـ PR #3 في `docs/PR3_SECURITY_REVIEW.md`.
- المشروع المرتبط بـ Vercel (`production`, `preview`, `development`) في `NEXT_PUBLIC_SUPABASE_URL` هو **`fmdfueuezjhnwwchoock`**، ومطبّقة عليه فعلياً الـ Migrations:
  - `001_initial_schema` (`20261120005318`)
  - `002_seed_indomito` (`20261120005331`)
  - `002_v3_upgrade` (`20261121080716`)
  - `003_security_hardening` (`20261128092618`)
  - `004_table_privileges_lockdown` (`20261128092644`)

---

## 2. ملخص ما نُفّذ في المرحلة 1 + إصلاحات المراجعة الأمنية لـ PR #3

### أ. قاعدة البيانات وصلاحيات Supabase (`003_security_hardening` & `004_table_privileges_lockdown`)
- حصر قراءة `tenants` لـ `anon` على الجهات النشطة والأعمدة العامة فقط (إخفاء `suspended_message`, `created_at`, `updated_at`)، مع تعقيم استجابة الجهة المتوقفة في `src/app/m/[slug]/page.tsx`.
- إغلاق `INSERT` المباشر لـ `anon`/`authenticated` على `analytics_events` و`contact_messages`.
- تشديد `record_menu_event` (تحقق ملكية `item_id` + حد `512B` لـ `metadata`) وحصرها وحصر `cleanup_expired_notifications()` على `service_role`.
- حصر `update_client_tenant_settings` على `authenticated` مع حدود أطوال ومنع مخططات الروابط الخطرة.
- إنشاء جدول `api_rate_limits` ودالة `check_api_rate_limit` (`service_role` فقط) لتطبيق Rate Limiting خادمي مشترك.
- إزالة `image/svg+xml` من حاوية `menus-media` وتقليص صلاحيات الجداول الحساسة.

### ب. إصلاحات المراجعة الأمنية الحرجة لـ PR #3
1. **إصلاح Rate Limiting (Fail-Closed + Timeout)**:
   - إعادة تصميم `enforceRateLimit` في `src/lib/security.ts` لتفريق `"allowed"` و`"rate_limited"` (`429`) و`"unavailable"` (`503`) مع مهلة `4000ms` وعدم تمرير الطلبات الحساسة عند تعطل التحقق (`login`, `contact`, `analytics/event`, `demo/ensure`, `media/upload`).
2. **إصلاح مصدر IP ومنع التلاعب ومفاتيح Rate Limit**:
   - تحديث `getClientIp` لاختيار `x-vercel-forwarded-for` ثم `x-real-ip` ثم آخر IP صالح في `x-forwarded-for` مع فحص `IPv4`/`IPv6` عبر `node:net` (`isIP`) وتطبيع `::ffff:`.
   - إضافة `buildRateLimitKey` (SHA-256 مختصر ثابت الطول) وتوحيد استخدامه في `/api/auth/login` وبقية المسارات لمنع تضخيم `api_rate_limits` و`login_rate_limits`.
3. **تحقق خادمي موثوق من رفع الصور (`POST /api/media/upload`)**:
   - إنشاء `src/lib/image-validation.ts` + `src/app/api/media/upload/route.ts` لفحص Magic Bytes + رفض SVG/HTML + التحقق من الأبعاد الفعلية (`16px..8000px`) وحجم `≤ 5MB` على الخادم، مع الرفع عبر جلسة المستخدم المصادق عليها للحفاظ على Storage RLS دون كشف `Service Role Key`.
   - ربط لوحتي `tenant-menu-manager.tsx` و`super-admin-client.tsx` بمسار الرفع الخادمي.
4. **إزالة `'unsafe-eval'` من Production CSP**:
   - تقييد `'unsafe-eval'` في `next.config.ts` على بيئة التطوير فقط وإزالته في الإنتاج، مع توثيق سبب بقاء `'unsafe-inline'` في `docs/PR3_SECURITY_REVIEW.md`.
5. **اختبارات الوحدة الآلية**:
   - إضافة `tests/security.test.mjs` لتغطية Fail-Closed Rate Limit، تزوير IP، CSRF/Origin، فحص الصور، وتعقيم الروابط.

---

## 3. الملفات والـ Migrations المرتبطة بـ PR #3
- **Migrations مطبقة في Supabase (`fmdfueuezjhnwwchoock`)**:
  - `supabase/migrations/003_security_hardening.sql`
  - `supabase/migrations/004_table_privileges_lockdown.sql`
- **ملفات الكود والاختبارات والوثائق**:
  - `src/lib/security.ts`
  - `src/lib/image-compress.ts`
  - `src/lib/image-validation.ts` (جديد)
  - `src/app/api/media/upload/route.ts` (جديد)
  - `src/app/api/analytics/event/route.ts` (جديد)
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/change-password/route.ts`
  - `src/app/api/contact/route.ts`
  - `src/app/api/demo/ensure/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/tenants/route.ts`
  - `src/app/api/health/route.ts`
  - `src/app/m/[slug]/page.tsx`
  - `src/app/contact/page.tsx`
  - `src/components/menu/public-menu-client.tsx`
  - `src/components/dashboard/tenant-menu-manager.tsx`
  - `src/components/admin/super-admin-client.tsx`
  - `next.config.ts`
  - `tests/security.test.mjs` (جديد)
  - `docs/PR3_SECURITY_REVIEW.md` (جديد)
  - `docs/ARENA_PROGRESS.md`

---

## 4. نتائج الاختبارات الفعلية (آخر تشغيل)
- `node --test tests/security.test.mjs`: **نجح (5 / 5)**.
- `npm run typecheck`: **نجح (0 أخطاء)**.
- `npm run lint`: **نجح (0 تحذيرات/أخطاء)**.
- `npm run build`: **نجح (25 مساراً)**.
- فحص HTTP على الخادم الإنتاجي المحلي (`next start`): تأكيد غياب `'unsafe-eval'` في Production CSP، وإرجاع `503` Fail-Closed على `login`, `contact`, `analytics/event`, `demo/ensure`, `media/upload` عند غياب مخزن الحماية، وإرجاع `200` للصفحات العامة، و`403` لغياب Origin.
- فحص Supabase (`fmdfueuezjhnwwchoock`): تأكيد توافق استعلام الأعمدة الصريحة لـ `anon` على `demo`, `indomito`, `alwaleed`، وتأكيد فشل `SELECT *` لـ `anon` (مما يجعل دمج PR #3 ضرورياً لإعادة توافق الإنتاج)، وتأكيد منع تصعيد الصلاحيات على `profiles` ومنع الوصول المتقاطع إلى `alwaleed`.

---

## 5. المخاطر المتبقية والخطوة التالية
1. **التوافق المؤقت على `main` الحالي**: نسخة `main` (`6e15b04`) المنشورة قبل دمج PR #3 تستخدم `select("*")` على `tenants` و`record_menu_event` من المتصفح، وهو ما تمنعه `003_security_hardening` في `fmdfueuezjhnwwchoock`؛ يُحل فوراً عند موافقة المالك على دمج PR #3.
2. **الاختبار الميداني على Vercel Preview**: اختبار تسجيل الدخول الحي، رفع صورة حقيقية من المتصفح، والتنقل في `/m/demo`, `/m/indomito`, `/m/alwaleed` بعد النشر على Preview (حيث حاوية Sandbox لا تتصل مباشرة بـ `*.supabase.co`).
3. **الخطوة التالية**: مراجعة المالك لـ `docs/PR3_SECURITY_REVIEW.md` والموافقة على دمج **PR #3** إلى `main`، وبعدها فقط الانتقال إلى **المرحلة 2 — UI/UX & Branding**.
