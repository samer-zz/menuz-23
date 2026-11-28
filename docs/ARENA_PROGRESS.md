# سجل التقدم والمتابعة — MENUZ | Arena Progress

> آخر تحديث: 2026-11-28  
> الفرع النشط: `arena/296f4909-menuz-23` (مفرّع من `main` @ `6e15b0417855d4b9af0378bc96a1b9edacf06477`)  
> المرحلة الحالية: **المرحلة 1 — Security & Database (مكتملة)**

---

## 1. ملاحظة مرجعية قبل البدء
- عند بدء هذه المرحلة لم يكن ملف `docs/MENUZ_AUDIT_REPORT.md` أو `docs/ARENA_PROGRESS.md` موجودين في المستودع بعد؛ لذا جرى أولاً تدقيق فعلي للـ Migrations المطبقة (`001_initial_schema`, `002_seed_indomito`, `002_v3_upgrade`)، وصلاحيات الجداول والدوال وسياسات RLS في Supabase (`fmdfueuezjhnwwchoock`)، ومسارات API والرفع وترويسات الأمان في الكود قبل تطبيق أي تعديل.

---

## 2. ما تم تنفيذه في المرحلة الأولى (Security & Database)

### أ. قاعدة البيانات وصلاحيات Supabase (`003_security_hardening` & `004_table_privileges_lockdown`)
1. **إغلاق الثغرة في جدول `tenants`**:
   - تقييد سياسة `tenants_public_read` إلى `(is_active = true or public.is_super_admin() or id = public.my_tenant_id())` لمنع كشف الجهات المعطلة عبر استعلامات `anon`.
   - تطبيق **Column-Level Privileges** لدور `anon` (`REVOKE SELECT` ثم `GRANT SELECT` لأعمدة العرض العام فقط) لإخفاء `suspended_message` و`created_at` و`updated_at` عن REST API العام.
   - تحديث `src/app/m/[slug]/page.tsx` لعرض شاشة التوقف للجهات المعطلة عبر الخادم باستخدام كائن معقم يخفي بيانات التواصل (`phone`, `whatsapp`, `address`, `story`).
2. **منع الحقن المباشر عبر PostgREST في `analytics_events` و`contact_messages`**:
   - إزالة سياسات `analytics_insert_public` و`contact_messages_public_insert` وسحب صلاحية `INSERT` المباشر من `anon` و`authenticated`.
   - تمرير جميع عمليات الإدراج العامة عبر مسارات Next.js المحمية (`POST /api/analytics/event` و`POST /api/contact`).
3. **تشديد دالة `record_menu_event` وحصرها على `service_role`**:
   - التحقق من انتماء `p_item_id` إلى `p_tenant_id` (منع IDOR بين الجهات)، والتحقق من أن `p_metadata` كائن JSON لا يتجاوز `512` بايت.
   - سحب `EXECUTE` من `public, anon, authenticated` وحصرها على `service_role`.
4. **حصر `cleanup_expired_notifications()` على `service_role`**:
   - سحب `EXECUTE` من `public, anon, authenticated` وحصرها على `service_role` فقط، مع إضافة تنظيف سجلات `login_rate_limits` و`api_rate_limits` المنتهية.
5. **تشديد `update_client_tenant_settings`**:
   - سحب `EXECUTE` من `public, anon` وحصرها على `authenticated`، مع إضافة حدود أطوال المدخلات ومنع مخططات الروابط الخطرة (`javascript:`, `data:`, `vbscript:`).
6. **تأسيس Rate Limiting خادمي مشترك في قاعدة البيانات**:
   - إنشاء جدول `public.api_rate_limits` (مع RLS مغلق لـ `service_role` فقط) ودالة `public.check_api_rate_limit(p_key, p_max_hits, p_window_seconds)` لفرض الحدود حتى عبر دوال Vercel Serverless.
7. **حظر رفع ملفات `SVG` من Storage (`menus-media`)**:
   - إزالة `image/svg+xml` من `allowed_mime_types` في `menus-media` لتقتصر على `image/jpeg`, `image/png`, `image/webp`.
8. **تقليص الصلاحيات الافتراضية على مستوى الجداول (`004_table_privileges_lockdown`)**:
   - سحب جميع صلاحيات `anon` عن `login_rate_limits`, `audit_logs`, `analytics_events`, `contact_messages`, `profiles`، وسحب صلاحيات الكتابة/DDL غير الضرورية عن `anon` و`authenticated`.

### ب. طبقة API وCSRF والتحقق من الملفات وترويسات الأمان
1. **إصلاح `verifySameOrigin` في `src/lib/security.ts`**:
   - رفض الطلبات التي تفتقد `Origin` و`Referer` معاً (بدلاً من تمريرها سابقاً)، وفحص `Sec-Fetch-Site` (`cross-site` مرفوض)، والتحقق من تطابق المضيف مقابل `host` / `x-forwarded-host` / `NEXT_PUBLIC_SITE_URL`.
   - إضافة `getClientIp`, `enforceRateLimit`, و`sanitizeSafeUrl`.
2. **تأمين `POST /api/demo/ensure`**:
   - منع الزوار العامين من استخدام `Service Role` أو إعادة تفعيل جهة `demo` معطلة؛ يُسمح بالتحقق العام للقراءة فقط عبر الجلسة العادية، بينما تبقى إعادة التفعيل/الإنشاء محصورة على `super_admin` مسجل مع تسجيل `audit_logs`.
3. **إنشاء `POST /api/analytics/event` وتحديث `public-menu-client.tsx`**:
   - استبدال استدعاءات `supabase.rpc("record_menu_event")` من المتصفح بـ `POST /api/analytics/event` المحمي بـ `verifySameOrigin` + `enforceRateLimit` (60/دقيقة) + `Zod` schema صارم.
4. **تقوية `POST /api/contact` و`/api/auth/*` و`/api/admin/*` و`/api/health`**:
   - إضافة Rate Limit لـ `/api/contact` (5 طلبات / 15 دقيقة لكل IP) + Honeypot (`website`) + Regex للهاتف + حدود أطوال قصوى.
   - حدود أطوال لكلمات المرور (`max(128)`), فحص UUID، التحقق من صيغة الألوان السداسية، وتعقيم روابط الشعار والغلاف في `/api/admin/tenants`، ومنع تسريب رسائل أخطاء قاعدة البيانات في `/api/health`.
5. **فحص Magic Bytes للصور المرفوعة (`src/lib/image-compress.ts`)**:
   - إضافة `validateImageFile(file)` للتحقق من الحجم (`≤ 5MB`), منع `SVG`، ومطابقة الترويسة الثنائية الفعلية (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`) قبل الضغط والرفع في لوحتي العميل والسوبر أدمن.
6. **ترويسات الأمان في `next.config.ts`**:
   - إضافة `Content-Security-Policy` (متوافقة مع Next.js 15 + Supabase + Unsplash), `Strict-Transport-Security`, و`X-Frame-Options: DENY`.

---

## 3. الملفات والـ Migrations التي تغيرت
- **Migrations جديدة مطبقة في Supabase (`fmdfueuezjhnwwchoock`)**:
  - `supabase/migrations/003_security_hardening.sql` (version `20261128092618`)
  - `supabase/migrations/004_table_privileges_lockdown.sql` (applied & recorded)
- **ملفات الكود المعدلة/المضافة**:
  - `src/lib/security.ts`
  - `src/lib/image-compress.ts`
  - `src/app/api/analytics/event/route.ts` (جديد)
  - `src/app/api/demo/ensure/route.ts`
  - `src/app/api/contact/route.ts`
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/change-password/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/tenants/route.ts`
  - `src/app/api/health/route.ts`
  - `src/app/m/[slug]/page.tsx`
  - `src/app/contact/page.tsx`
  - `src/components/menu/public-menu-client.tsx`
  - `src/components/dashboard/tenant-menu-manager.tsx`
  - `src/components/admin/super-admin-client.tsx`
  - `next.config.ts`
  - `docs/ARENA_PROGRESS.md` (جديد)

---

## 4. نتائج الاختبارات الفعلية
| الاختبار | البيئة | النتيجة | التفاصيل |
|---|---|---|---|
| `npm run typecheck` | محلي | نجح (0 أخطاء) | تحقق كامل بعد آخر تعديل |
| `npm run lint` | محلي | نجح (0 تحذيرات/أخطاء) | ESLint Next.js + TS |
| `npm run build` | محلي | نجح | بناء 24 مساراً شاملاً `/api/analytics/event` |
| فحص صلاحيات Postgres (`anon`/`authenticated`) | Supabase (`fmdfueuezjhnwwchoock`) | نجح | `anon` محروم من `login_rate_limits`, `api_rate_limits`, `audit_logs`, `contact_messages INSERT`, `analytics_events INSERT`, `tenants.suspended_message`, وRPCs الإدارية |
| اختبار IDOR وRate Limit وعزل `client_admin` | Supabase (`do $$ ... $$`) | نجح | رفض `item_id` لجهة أخرى، رفض `metadata > 512B`، نجاح `check_api_rate_limit(2)`، ومنع `indomito` من قراءة `audit_logs` أو `demo.analytics_events` أو تعديل `demo.categories` |
| Security Headers + CSRF/Origin + Validation + Honeypot | خادم Next.js المحلي (`http://127.0.0.1:3000`) | نجح | ترويسات CSP/HSTS/XFO حاضرة؛ رفض غياب Origin/Referer وOrigin خارجي و`Sec-Fetch-Site: cross-site` بـ `403`؛ رفض `/api/cron` بدون سر بـ `401`؛ قبول Honeypot بـ `200` دون حفظ |

### الاختبارات غير المنفذة محلياً وسببها
- اختبار جلسات المصادقة الفعلية (`/api/auth/login`, `/api/admin/*` بـ Cookie حية) ورفع الملفات الفعلي عبر واجهة المتصفح على `http://127.0.0.1:3000`: لم يُشغّل محلياً لعدم توفر `.env.local` داخل حاوية Sandbox المعزولة وعدم وجود اتصال صادر مباشر من حاوية Sandbox إلى `*.supabase.co`. تم التحقق من منطق RLS وعزل الجداول مباشرة داخل Supabase عبر Management API، ويلزم التحقق الميداني بعد فتح PR/Preview على Vercel.

---

## 5. المخاطر المتبقية والخطوة التالية
1. **تحديث Supabase SDK مباشرة من المتصفح (`tenant-menu-manager.tsx` / `super-admin-client.tsx`)**: لا يزال رفع الصور إلى `menus-media` يتم من المتصفح (محمياً بـ RLS ومجلد `my_tenant_id()` وفحص Magic Bytes في الواجهة وإزالة SVG من الحاوية)، ويمكن مستقبلاً إضافة فحص خادمي أو Signed Upload URL عند التوسع إذا رُغبت طبقة فحص ثنائية على الخادم.
2. **تغطية CSP**: تحتوي `script-src` على `'unsafe-inline' 'unsafe-eval'` لتوافق Next.js 15؛ الانتقال إلى Nonce-based CSP يتطلب ضبط Middleware مخصص في مرحلة لاحقة دون كسر التوافق الحالي.
3. **العمل التالي المحدد**: بعد مراجعة ودمج PR المرحلة الأولى، الانتقال إلى **المرحلة 2 — UI/UX & Branding** (ألوان الجهات المستقلة، البطاقات المربعة، شاشة الترحيب 3–4 ثوانٍ، تحريك المنتجات المميزة، تعديل نص زر المنيو التجريبي، تنظيف صفحة من نحن، قنوات التواصل، وتذييل MENUZ).
