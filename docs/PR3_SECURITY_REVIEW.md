# تقرير المراجعة الأمنية الحرجة — MENUZ PR #3 (Security Review & Critical Fixes)

تاريخ المراجعة: 2026-11-28  
المستودع: `samer-zz/menuz-23`  
الفرع: `arena/296f4909-menuz-23` | طلب السحب: **PR #3**  
مشروع Supabase المرتبط بـ Vercel (`production` / `preview` / `development`): **`fmdfueuezjhnwwchoock`**

---

## 1. الخلاصة التنفيذية وحالة التوافق الحرجة (Supabase ↔ الإنتاج)

### أ. التحقق من بيئة Supabase والإنتاج (دون كشف أي أسرار)
- بالتحقق من إعدادات Vercel (`prj_rcabYKZfrwQuxQ46DqGJhgqNgXRw`)، يشير متغير `NEXT_PUBLIC_SUPABASE_URL` في جميع البيئات (`production`, `preview`, `development`) إلى المشروع **`fmdfueuezjhnwwchoock`**.
- الـ Migrations المسجلة فعلياً في `supabase_migrations.schema_migrations` على `fmdfueuezjhnwwchoock` هي:
  1. `20261120005318` — `001_initial_schema`
  2. `20261120005331` — `002_seed_indomito`
  3. `20261121080716` — `002_v3_upgrade`
  4. `20261128092618` — `003_security_hardening`
  5. `20261128092644` — `004_table_privileges_lockdown`
- البيانات الفعلية للجهات الموجودة في `public.tenants`:
  - `indomito`: نشط (`is_active = true`, `is_demo = false`), `4` أقسام نشطة، `13` صنفاً، `1` محفظة.
  - `alwaleed`: نشط (`is_active = true`, `is_demo = false`), `1` قسم نشط، `1` صنف، `0` محافظ.
  - `demo`: نشط (`is_active = true`, `is_demo = true`), `3` أقسام نشطة، `9` أصناف، `3` محافظ.

### ب. تنبيه حرج حول التوافق بين `main` المنشور حالياً وقاعدة البيانات
- **المشكلة المكتشفة**: الـ Migration `003_security_hardening` المطبقة مسبقاً على `fmdfueuezjhnwwchoock` سحبت صلاحية `SELECT *` لـ `anon` على `public.tenants` وحصرتها في قائمة أعمدة محددة (بدون `suspended_message`, `created_at`, `updated_at`)، وسحبت `EXECUTE` لدالة `record_menu_event` من `anon`.
- **أثر ذلك على نسخة `main` (`6e15b04`) المنشورة حالياً على `menuz-23.vercel.app`**:
  - نسخة `main` لا تزال تستخدم `.from("tenants").select("*")` في `src/app/m/[slug]/page.tsx` وتستدعي `record_menu_event` من المتصفح بـ `anon`.
  - اختبار محاكاة `SET LOCAL ROLE anon; SELECT * FROM public.tenants WHERE slug = 'indomito';` على `fmdfueuezjhnwwchoock` فشل فعلياً بالخطأ: `permission denied for table tenants`.
- **التوافق مع فرع PR #3 (`arena/296f4909-menuz-23`)**:
  - فرع PR #3 يطلب صراحةً الأعمدة الممنوحة فقط (`PUBLIC_TENANT_COLUMNS`) وينقل التحليلات إلى `POST /api/analytics/event`؛ وقد نجح اختبار المحاكاة بـ `anon` على `fmdfueuezjhnwwchoock` لجميع الجهات الثلاث (`demo`, `indomito`, `alwaleed`).
- **الإجراء المطلوب من المالك (لم ننفذ Rollback ولم ندمج تلقائياً)**:
  - **دمج PR #3 ونشره إلى الإنتاج** هو الحل النظيف والموصى به فوراً لإعادة التوافق الكامل بين التطبيق وقاعدة البيانات مع الإبقاء على التشديد الأمني. (وإذا رغب المالك مؤقتاً قبل الدمج، يمكنه استعادة `GRANT SELECT` مؤقتاً على `tenants` ثم تطبيقها مجدداً بعد الدمج).

---

## 2. جدول المشاكل المراجعة والإصلاحات المنفذة

| # | المشكلة | السبب | الحل المنفذ | الملفات المتأثرة | نتيجة الاختبار |
|---|---|---|---|---|---|
| 1 | **Rate Limiting Fail-Open** | `enforceRateLimit` كانت تعيد `true` عند خطأ RPC أو انقطاع الاتصال، مما يمرر الطلبات عند تعطل الحماية | إعادة التصميم إلى `{ status: "allowed" \| "rate_limited" \| "unavailable", allowed: boolean }` مع مهلة `4000ms` (Timeout) وFail-Closed (`503`) على `/api/auth/login` و`/api/contact` و`/api/demo/ensure` و`/api/analytics/event` و`/api/media/upload` مع عدم كشف تفاصيل الأخطاء الداخلية | `src/lib/security.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/contact/route.ts`, `src/app/api/analytics/event/route.ts`, `src/app/api/demo/ensure/route.ts`, `src/app/api/media/upload/route.ts` | نجح (اختبارات الوحدة + HTTP `503` عند غياب مخزن الحماية) |
| 2 | **الثقة العمياء في `x-forwarded-for` وتضخيم المفاتيح** | الاعتماد على أول قيمة في `x-forwarded-for` يسمح بتزوير IP وتخزين نصوص عشوائية في `login_rate_limits` / `api_rate_limits` | اعتماد `x-vercel-forwarded-for` ثم `x-real-ip` ثم آخر IP صالح من اليمين، التحقق الصارم من IPv4/IPv6 عبر `node:net` (`isIP`) وتطبيع `::ffff:`, وتوليد مفاتيح Rate Limit ثابتة الطول عبر `buildRateLimitKey` (SHA-256 مختصر) وتوحيد ذلك في `/api/auth/login` | `src/lib/security.ts`, `src/app/api/auth/login/route.ts` | نجح (اختبار وحدة للتلاعب بالترويسات + `IPv4`/`IPv6`) |
| 3 | **فحص الصور في المتصفح فقط** | الاعتماد على `validateImageFile()` في المتصفح كان يمكن تجاوزه بإرسال طلب مباشر إلى Supabase Storage | إنشاء مسار خادمي `POST /api/media/upload` يفحص `Origin` والمصادقة والصلاحيات (`super_admin` أو `client_admin` لجهته فقط) وRate Limit (`30/10m`) ويفحص في الخادم Magic Bytes + الأبعاد الفعلية للـ PNG/JPEG/WebP (`16px..8000px`) وحجم `≤ 5MB` ويرفض SVG والملفات التالفة، ثم يرفع بجلسة المستخدم المصادق عليها للحفاظ على Storage RLS دون كشف `Service Role` | `src/lib/image-validation.ts`, `src/app/api/media/upload/route.ts`, `src/components/dashboard/tenant-menu-manager.tsx`, `src/components/admin/super-admin-client.tsx` | نجح (اختبار وحدة لـ PNG/JPEG/WebP، SVG، HTML XSS، الأبعاد التالفة/العملاقة، وHTTP `503`/`403`) |
| 4 | **وجود `'unsafe-eval'` في Production CSP** | كانت `script-src` تتضمن `'unsafe-eval'` في جميع البيئات | إزالة `'unsafe-eval'` في بيئة الإنتاج (`process.env.NODE_ENV === "production"`), وحصره على التطوير المحلي فقط | `next.config.ts` | نجح (ترويسة Production لا تحتوي على `'unsafe-eval'`) |
| 5 | **توحيد Fail-Closed في مصادقة الرفع** | مسار `/api/media/upload` كان يرمي `500` عند تعذر تهيئة عميل المصادقة | تغليف التحقق من الجلسة بـ `try/catch` وإرجاع `503` واضح بدون تفاصيل داخلية عند تعذر الخدمة و`401` عند غياب الجلسة | `src/app/api/media/upload/route.ts` | نجح (HTTP `503` محلياً بدون `.env`، و`403` عند غياب Origin) |

---

## 3. توثيق استثناءات Content Security Policy (CSP)
- **تمت إزالته في الإنتاج**: `'unsafe-eval'` غير موجود في `script-src` على الإنتاج.
- **الاستثناءات المتبقية وسبب تعذر إزالتها حالياً بدون تغيير بنية الصفحات الثابتة**:
  - `script-src 'self' 'unsafe-inline'`: لأن الصفحات التسويقية وبوابة الدخول (`/`, `/about`, `/services`, `/faq`, `/contact`, `/login`) مُولّدة كصفحات ثابتة (Static Pre-rendered) وتعتمد على سكربتات Next.js Hydration المضمنة؛ التحول إلى Nonce-based CSP يتطلب جعل كافة الصفحات ديناميكية (`force-dynamic`) مما يرفع استهلاك Vercel Functions على الباقة المجانية.
  - `style-src 'self' 'unsafe-inline'`: مطلوب لعمل Tailwind runtime styles و`framer-motion` وتخصيص ألوان الهوية الديناميكية.

---

## 4. ملخص نتائج الاختبارات المنفذة فعلياً

| الاختبار | الأداة / البيئة | النتيجة | ما تم التحقق منه |
|---|---|---|---|
| `node --test tests/security.test.mjs` | Node v22.22.3 | **5 / 5 نجح** | Fail-Closed `enforceRateLimit`، مقاومة تزوير IP، `IPv4`/`IPv6`، `buildRateLimitKey`، `verifySameOrigin`، `validateImageBuffer` (SVG/HTML/أبعاد تالفة/5MB+)، و`sanitizeSafeUrl` |
| `npm run typecheck` | TypeScript `tsc --noEmit` | **نجح (0 أخطاء)** | جميع الملفات المعدلة والمضافة |
| `npm run lint` | Next.js ESLint | **نجح (0 أخطاء/تحذيرات)** | جودة الكود والقواعد |
| `npm run build` | Next.js 15.5.29 | **نجح (25 مساراً)** | بناء الإنتاج متضمناً `/api/media/upload` و`/api/analytics/event` |
| اختبارات HTTP على الإنتاج المحلي (`next start`) | `curl` ضد `127.0.0.1:3000` | **نجح** | غياب `'unsafe-eval'` في Production CSP؛ رجوع `503` Fail-Closed على `login`, `contact`, `analytics/event`, `demo/ensure`, `media/upload` عند تعذر مخزن التحقق؛ رجوع `200` للصفحات العامة؛ رجوع `403` لغياب Origin |
| اختبارات التوافق وRLS ومنع تصعيد الصلاحيات | Supabase `fmdfueuezjhnwwchoock` | **نجح** | نجاح قراءة `demo`, `indomito`, `alwaleed` بالأعمدة الصريحة عبر `anon`؛ فشل `SELECT *` لـ `anon` (تثبت ضرورة دمج PR #3)؛ منع `indomito` (`client_admin`) من تصعيد `profiles.role` أو تعديل `alwaleed.menu_items` أو إدراج إشعار في `alwaleed` |

### اختبارات تتطلب بيئة Vercel Preview (بعد دفع هذه التعديلات)
- تصفح حي من المتصفح لـ `/m/demo` و`/m/indomito` و`/m/alwaleed` و`/` و`/contact`.
- تسجيل الدخول الفعلي (`admin@menuz.app`, `indomito@menuz.app`)، وإرسال نموذج تواصل، ورفع صورة فعلية من لوحة التحكم عبر `/api/media/upload` (تحتاج متصفحاً/جلسة حقيقية متصلة بـ Supabase حيث حاوية Sandbox معزولة عن الاتصال الخارجي بـ `*.supabase.co` وتحتوي Vercel Preview على حماية Vercel Team الافتراضية).

---

## 5. المخاطر المتبقية والقرار النهائي حول PR #3
1. **عدم التوافق المؤقت لـ `main` الحالي مع `003_security_hardening` في الإنتاج**: يُغلق فور دمج **PR #3** وإتمام بناء Vercel Production.
2. **بقاء `'unsafe-inline'` في `script-src`/`style-src`**: موثق أعلاه كحد عملي للتوافق مع Static Pre-rendering على Vercel Hobby.
3. **قرار الجاهزية**: بعد تطبيق إصلاحات Fail-Closed وتوحيد مصدر IP وفحص الصور الخادمي وإزالة `'unsafe-eval'`، يُعد **PR #3 جاهزاً من الناحية الهندسية والأمنية للمراجعة الميدانية على Vercel Preview ثم الدمج** (مع تأكيد عدم الدمـج التلقائي إلا بموافقة المالك).
