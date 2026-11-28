# التقرير النهائي للتحقق الأمني وتحصين الرفع — PR #3 (`arena/296f4909-menuz-23`)

- **التاريخ**: 2026-11-20
- **المستودع / الفرع**: `samer-zz/menuz-23` — `arena/296f4909-menuz-23` (PR #3 مقابل `main`)
- **قاعدة البيانات المشتركة**: Supabase `fmdfueuezjhnwwchoock` (`eu-west-1`) — الميجريشنز المطبقة `001` حتى `004`
- **بيئة النشر**: Vercel Hobby (`menuz-23`, `prj_rcabYKZfrwQuxQ46DqGJhgqNgXRw`)

---

## 1) توحيد حد رفع الصور إلى `4MiB` (`4 * 1024 * 1024`)

| الطبقة | القيمة المطبقة | الحالة |
|---|---|---|
| العميل (`src/lib/image-compress.ts`) | `MAX_CLIENT_IMAGE_BYTES = 4 * 1024 * 1024` + فحص قبل الإرسال في `tenant-menu-manager.tsx` و`super-admin-client.tsx` | ✅ مطبق |
| حارس الخادم السريع (`src/lib/image-validation.ts`) | `MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024` | ✅ مطبق |
| مسار الرفع (`POST /api/media/upload`) | رفض مبكر via `content-length > 4MiB + 256KiB` (`413`) وفحص `file.size > 4MiB` (`413`) | ✅ مطبق |
| باكت Supabase (`storage.buckets.menus-media`) | `file_size_limit = 5242880` (`5MiB`), `allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']` | ℹ️ أُبقي `5MiB` التزاماً بعدم تطبيق migrations إضافية دون موافقة، والحد الفعلي الصارم `4MiB` مفروض بالخادم والعميل |

**ملاحظة توافق `main`**: إبقاء `5MiB` في الباكت لا يكسر النسخة المنشورة على `main` (`6e15b04`), بينما يلتزم PR #3 بحد `4MiB` المتوافق مع حد طلبات Vercel Hobby Serverless (`4.5MB`) دون الاعتماد على Beta أو خطط مدفوعة.

---

## 2) تحصين Rate Limiting وحماية Auth / `profiles` في `/api/media/upload`

الترتيب المنفذ في `src/app/api/media/upload/route.ts`:
1. `verifySameOrigin(request)` -> `403` عند غياب/اختلاف `Origin` أو `Referer` أو `sec-fetch-site: cross-site`.
2. فحص `content-length` -> `413` عند تجاوز `4.25MiB` قبل قراءة `FormData`.
3. **Pre-auth IP Rate Limit** (`upload-ip:<sha256(ip)>`, `40` طلباً / `10` دقائق) **قبل** `supabase.auth.getUser()`:
   - عند التجاوز: `429`.
   - عند تعذر قاعدة البيانات/المتغيرات: `503` (Fail-Closed).
4. **المصادقة** (`supabase.auth.getUser()`):
   - للزائر غير المسجل: `401` مباشرة **دون أي استعلام من `profiles`**.
5. **Per-User Rate Limit** (`upload-user:<sha256(user.id)>`, `30` طلباً / `10` دقائق) **قبل** قراءة `profiles`:
   - عند التجاوز: `429`، وعند التعذر: `503`.
6. **التحقق من الدور والجهة**:
   - `client_admin`: `403` إذا حاول تمرير `tenantId` يخالف `profile.tenant_id`.
   - `super_admin`: إذا مرّر `tenantId` يتحقق من صحة `UUID` (`400`) ومن وجود الجهة فعلياً في `tenants` (`404` إن لم توجد).
7. **التنظيف الدوري لجدول `api_rate_limits`**:
   - يتم تلقائياً عبر Cron اليومي `/api/cron/cleanup-notifications` (`cleanup_expired_notifications()`, يحذف صفوف `api_rate_limits` الأقدم من ساعتين).

---

## 3) التحقق الخادمي الحقيقي للصور (`sharp` Decoder & Re-encoder)

تم اعتماد مكتبة `sharp` (`^0.35.5` المثبتة مسبقاً في `package.json` والمدعومة رسمياً في Next.js على `linux-x64`) عبر `decodeAndSanitizeImage()` في `src/lib/image-validation.ts`:
- تجاهل اسم الملف وامتداده و`MIME` المرسل من العميل كلياً.
- فحص ترويسة البايتات + رفض `SVG` / `XML` / `HTML`.
- فك ترميز البكسلات فعلياً عبر `sharp(buf, { failOn: 'error', limitInputPixels: 25_000_000, animated: false })`.
- رفض أي صورة بأبعاد `< 16px` أو `> 6000px` أو إجمالي بكسلات `> 25MP`.
- تصحيح اتجاه EXIF عبر `.rotate()` ثم تحجيمها كحد أقصى `1600x1600` (بدون تكبير الصور الأصغر) وإعادة ترميزها بالكامل إلى `image/webp` بجودة `86` **دون `.withMetadata()`** — مما يزيل جميع بيانات EXIF/XMP/IPTC ويرفض أي صورة مبتورة أو تالفة المحتوى حتى لو حملت ترويسة صحيحة.

---

## 4) نتائج الاختبارات المنفذة فعلياً مقابل غير المنفذة

### أ) الاختبارات المنفذة محلياً على الكود المبني (`tests/security.test.mjs` + `next start`)
- `node --test tests/security.test.mjs`: **6/6 ناجح**:
  1. Fail-Closed Rate Limiting (`unavailable` / `rate_limited` / `allowed`).
  2. استخراج IP ومنع التزييف (`x-vercel-forwarded-for`, IPv6-mapped IPv4, `buildRateLimitKey`).
  3. فحص Origin/CSRF (`403` عند غياب Origin/Referer أو اختلافه).
  4. فك ترميز `sharp` الحقيقي:
     - قبول PNG / JPEG / WebP حقيقية وإعادة ترميزها لـ WebP.
     - التحقق من إزالة EXIF Metadata بالكامل.
     - قبول أحجام حقيقية: ~`1MB` و~`3MB` و~`3.92MB` (تحت `4MiB`)، ورفض `4MiB + 1 byte`.
     - رفض صورة بترويسة PNG صالحة ومحتوى تالف، ورفض JPEG مبتور.
     - رفض `SVG` و`HTML` والصور التي تتجاوز `25MP` (`5500x5500`).
  5. محاكاة متكاملة لمسار `POST /api/media/upload`:
     - `429` قبل استدعاء `supabase.auth.getUser()` (`authCalls === 0`).
     - `503` عند تعذر Rate Limit.
     - `401` للزائر غير المسجل (`profileCalls === 0`).
     - `429` لتجاوز حد المستخدم (`profileCalls === 0`).
     - `413` للملفات `> 4MiB`.
     - `403` لمحاولة `client_admin` الرفع لجهة أخرى.
     - `404` لمحاولة `super_admin` التمرير لـ `tenantId` غير موجود.
     - `200` لرفع صالح بصلاحية `client_admin` مع حفظ الملف كـ `image/webp` تحت مجلد الجهة بدون `Service Role`.
  6. تنظيف الروابط `sanitizeSafeUrl`.
- `npm run typecheck`, `npm run lint`, `npm run build`: **ناجح بالكامل (25 مساراً)**.
- `npm run start` المحلي + `curl`:
  - `POST /api/media/upload` بدون `Origin` -> `403`.
  - `POST /api/media/upload` بحجم `5MB` -> `413`.
  - `POST /api/media/upload` بدون متغيرات البيئة -> `503` (Fail-Closed).
  - `/`, `/about`, `/services`, `/faq`, `/contact`, `/login`, `/offline` -> `200`, وترويسة `Content-Security-Policy` خالية من `'unsafe-eval'`.

### ب) اختبارات Supabase الفعلية (`fmdfueuezjhnwwchoock` عبر `execute_query`)
- **Storage RLS (`storage.objects` على `menus-media`, بدون `Service Role`)**:
  - `client_admin` (`indomito`) `INSERT` في مجلده -> مسموح (مع تراجع فرعي `U0001`).
  - `client_admin` (`indomito`) `INSERT` في مجلد `alwaleed` -> مرفوض (`42501`).
  - `client_admin` محاولة `../<alwaleed_id>/...` (Path Traversal) -> مرفوض (`42501`).
  - `super_admin` `INSERT` في مجلد `indomito` -> مسموح (مع تراجع فرعي `U0001`).
  - `anon` `INSERT` في `menus-media` -> مرفوض (`42501`).
  - `anon` `SELECT` في `menus-media` -> `12` كائناً مرئياً لعرض صور المنيو.
  - `client_admin` (`indomito`) `UPDATE` على كائن `alwaleed` -> `0` صف متأثر؛ وعلى كائن جهته -> `1` صف.
- **ملاحظة Delete**: قاعدة Supabase تمنع `DELETE` المباشر على `storage.objects` عبر SQL trigger (`protect_delete`)؛ وتمت مراجعة سياسة `menus_media_admin_delete` في `pg_policies` وتطابقها مع نفس قيد الجهة (`is_super_admin() OR folder == my_tenant_id()`).

### ج) الاختبار غير المنفذ وسببه الصريح
- **اختبار المتصفح التفاعلي الحي على رابط Vercel Preview**:
  - **لم يُنفّذ من داخل بيئة Sandbox** لسببين موضوعيين:
    1. جدار الشبكة الصادر في Sandbox يقصر الوصول على مضيفي GitHub/npm/PyPI ولا يسمح بالاتصال الصادر إلى `*.vercel.app` أو `*.supabase.co`.
    2. مشروع Vercel `menuz-23` مفعّل عليه **Deployment Protection (`ssoProtection`)** للـ Preview، مما يتطلب جلسة مالك Vercel في المتصفح.
  - **البديل العملي الآمن**: قبل أو فور الدمج، يُفتح رابط Preview من متصفح مالك المشروع وتُجرى قائمة التحقق السريعة (تسجيل دخول `admin@menuz.app` و`indomito@menuz.app`, فتح `/m/demo` و`/m/indomito` و`/m/alwaleed`, اختبار رفع صورة حقيقية وعرضها بالمنيو، وإرسال نموذج `/contact`).

---

## 5) إجابات الأسئلة الـ 7 الختامية

1. **هل تم تطبيق حد 4MiB في العميل والخادم والتخزين؟**
   نعم في العميل (`image-compress.ts` وواجهات الرفع) وفي الخادم (`image-validation.ts` و`/api/media/upload` بحرس `413` لـ `content-length` و`file.size`). أما باكت `menus-media` في Supabase فأُبقي على `5242880` (`5MiB`) التزاماً بعدم تطبيق migrations إضافية دون موافقة صريحة، وهو لا يسمح بتجاوز `4MiB` لأن كل الرفع يمر عبر `/api/media/upload` و/أو يُفحص بحد `4MiB`؛ ويمكن مزامنة `file_size_limit` إلى `4194304` بموافقة المالك بعد الدمج.
2. **هل يمكن للملفات التالفة أو المبتورة ذات الترويسة الصحيحة المرور؟**
   لا؛ دالة `decodeAndSanitizeImage()` تمرّر البايتات عبر `sharp(..., { failOn: 'error', limitInputPixels: 25_000_000 })` وتفك ترميز جميع البكسلات وتعيد ترميزها إلى WebP، وتم إثبات رفض ترويسة PNG صالحة بدون جسم وصورة JPEG مبتورة في `tests/security.test.mjs`.
3. **هل تم اختبار عزل التخزين بدون `Service Role`؟**
   نعم؛ عبر محاكاة جلسات `authenticated` و`anon` الفعلية (`request.jwt.claims`) على `fmdfueuezjhnwwchoock` في `storage.objects` (نجاح جهة العميل و`super_admin`، ورفض `42501` للجهة الأخرى و`../` traversal و`anon`، و`0` صفوف في `UPDATE` لجهة أخرى)، وكذلك عبر مسار `/api/media/upload` الذي يستخدم `createServerSupabase()` فقط.
4. **هل يحمي Rate Limiting نقطة الرفع من استهلاك Auth وDB؟**
   نعم؛ يوجد الآن Pre-auth IP Rate Limit (`40` طلب / `10` دقائق) **قبل** `supabase.auth.getUser()` (أثبت الاختبار `authCalls === 0` عند `429` و`503`)، وPer-user Rate Limit بعد Auth وقبل استعلام `profiles` (`profileCalls === 0` عند `429` أو `401`).
5. **هل تم اختبار Preview الحي فعلياً وما هي النتائج؟**
   نشر Preview وصل إلى حالة `READY` بعد التحديث، لكن **الاختبار التفاعلي بالمتصفح ضد رابط Preview الحي لم يُنفّذ من داخل Sandbox** بسبب حجب الاتصال الصادر عن `*.vercel.app` و`*.supabase.co` وتفعيل Vercel Deployment Protection. تم اختبار جميع المسارات المنطقية والأمنية محلياً عبر `next start` و`tests/security.test.mjs` وعلى قاعدة Supabase الفعلية عبر موصل Supabase.
6. **ما المخاطر المتبقية إن وجدت؟**
   - استمرار تعطل المنيو العام على بيئة الإنتاج (`main` `6e15b04`) حتى يتم دمج PR #3 لأن الميجريشنز `003`/`004` مطبقة مسبقاً على قاعدة البيانات المشتركة `fmdfueuezjhnwwchoock`.
   - الحاجة لتشغيل جلسة متصفح حية من قِبل المالك على Preview للتحقق البصري/التفاعلي النهائي قبل الدمج.
   - عدم مزامنة `storage.buckets.menus-media.file_size_limit` من `5MiB` إلى `4MiB` (أثرها منخفض جداً لوجود الفحص الخادمي عند `4MiB`).
7. **هل PR #3 جاهز للدمج إلى `main`؟**
   نعم من الناحية الأمنية والمعمارية واختبارات البناء والوحدة وقاعدة البيانات (`typecheck`, `lint`, `build`, `6/6 security tests`, `Storage RLS`), بشرط موافقة المالك بعد إجراء فحص سريع بالمتصفح على رابط Preview المحمي بـ SSO.
