# التقرير المرجعي للتدقيق الشامل — MENUZ Master Audit

- **التاريخ**: 2026-11-20
- **الفرع**: `arena/296f4909-menuz-23` (انطلاقاً من الالتزام `6939dd2d17836bea6f9f95696dc057a28a357715`)
- **الهدف المرجعي**: تدقيق كامل لمستودع `samer-zz/menuz-23` وقاعدة Supabase `fmdfueuezjhnwwchoock` قبل تنفيذ مراحل التطوير والتحصين (2 إلى 14).

---

## 1. ملخص الوضع الحالي للبنية والمسارات

### أ. الصفحات العامة ولوحات الإدارة
| المسار | النوع | الحالة قبل التطوير | الملاحظات المكتشفة |
|---|---|---|---|
| `/` | Static (`LandingView`) | يعمل | زر CTA الأساسي مكتوب «إنشاء منيو تجريبي» والمطلوب تغييره إلى «عرض المنيو التجريبي». |
| `/about` | Static | يعمل | يذكر أسماء أطر وتقنيات برمجية (`Next.js`, `Supabase`, `Vercel`) في النص التسويقي العام؛ يجب إزالتها والتركيز على قيمة المنصة. |
| `/services`, `/faq`, `/contact` | Static | يعمل | مترابطة؛ نموذج `/contact` محمي بـ honeypot وOrigin وRate Limit؛ يمكن تحسين بيانات Open Graph وSEO. |
| `/login` | Dynamic / Client | يعمل | محمي بـ `POST /api/auth/login` وRate Limit وMiddleware. |
| `/m/[slug]` | Dynamic SSR + `PublicMenuClient` | يعمل (مع PR #3) | يفرض ألوان الكحلي/البرتقالي في معظم العناصر رغم وجود `primary_color`/`accent_color`؛ يفتقر لتقييم التجربة (للـ Super Admin)، وشاشة الشكر «بالعافية»، وجعل الاسم والهاتف غير إلزاميين، وأيقونات التواصل أعلى/أسفل المنيو، وFooter MENUZ الكامل. |
| `/dashboard` | Dynamic SSR + `ClientDashboardClient` | يعمل | يفتقر لإدارة ألوان الجهة وتأكيدات التراجع وسجل الطلبات وإدارة Web Push. |
| `/admin` | Dynamic SSR + `SuperAdminClient` | يعمل | يفتقر لتبويب تقييمات تجربة العملاء (`order_feedback`)، وحالة الخدمات الحية، وإدارة الإشعارات المركزية، وجلب كامل الجداول دفعة واحدة بدون pagination للجميع. |
| `/offline`, `/error`, `/not-found` | Static / Client | يعمل | صفحات واضحة؛ تحتاج ربطاً أفضل مع مؤشر Offline حي داخل المنيو. |

### ب. مسارات API ووظائف الخادم
- المسارات القائمة:
  - `POST /api/auth/login` و`/api/auth/logout` و`/api/auth/change-password`
  - `POST/PATCH/DELETE /api/admin/tenants` و`POST/PATCH /api/admin/users`
  - `POST /api/media/upload` (محصّن بـ `4MiB` و`sharp` وPre-auth IP Rate Limit)
  - `POST /api/analytics/event` (محصّن بـ Origin + Zod + Rate Limit)
  - `POST /api/contact`, `POST /api/demo/ensure`, `GET /api/health`, `GET /api/cron/cleanup-notifications`, `GET /api/manifest/[slug]`
- **الفجوات المكتشفة**:
  1. **تجاوز الرفع المباشر لـ Supabase Storage**: سياسة `menus_media_admin_upload` في Supabase لا تزال تسمح لـ `authenticated` بالرفع مباشرة عبر Supabase Storage API؛ يلزم جعل الرفع من الخادم عبر `createAdminSupabase()` بعد التحقق الصارم وإعداد Migration لإغلاق الرفع المباشر في `storage.objects`.
  2. **مفتاح `unknown` الموحد عند غياب IP**: `getClientIp()` يعيد `"unknown"` إذا خلت جميع الترويسات، مما قد يجمع مستخدمين متعددين في مفتاح Rate Limit واحد في بيئات proxy غير قياسية.
  3. **الأدمن وتغيير كلمة المرور**: بعض مسارات الإدارة وتغيير كلمة المرور تعتمد فقط على الجلسة دون Rate Limit مستقل للمستخدم.
  4. **مسارات مفقودة لوظائف المرحلة 5–10**: لا يوجد مسار خادمي للطلبات (`POST /api/orders`) يتحقق من الأسعار من DB ويمنع التكرار، ولا مسار لتقييم الطلب (`POST /api/feedback`) معزول عن `client_admin`، ولا مسارات Web Push (`/api/push/subscribe`, `/api/push/send`)، ولا مسار أيقونات Manifest لصور Supabase (`/api/manifest/[slug]/icon`).

---

## 2. تدقيق قاعدة البيانات وRLS والتخزين (`fmdfueuezjhnwwchoock`)

- **الميجريشنز المطبقة فعلياً**: `001_initial_schema`, `002_seed_indomito`, `002_v3_upgrade`, `003_security_hardening`, `004_table_privileges_lockdown`.
- **الفهارس القائمة**: `31` فهرساً تغطي `tenants`, `categories`, `menu_items`, `offers`, `wallets`, `notifications`, `analytics_events`, `audit_logs`, `contact_messages`, `profiles`.
- **الاحتياجات البنيوية (تُعدّ في `005_menuz_v4_platform_hardening.sql` دون تطبيق على الإنتاج إلا بموافقة المالك)**:
  1. قفل `INSERT`/`UPDATE` المباشر في `storage.objects` على `menus-media` للـ `authenticated` وتوحيد `file_size_limit = 4194304`.
  2. حقول ألوان إضافية على `tenants` (`background_color`, `card_color`, `text_color`, `button_text_color`).
  3. جدول `orders` مع `idempotency_key` فريد لكل جهة والتحقق الخادمي من الأسعار.
  4. جدول `order_feedback` مع RLS يخصّ `super_admin` فقط بالقراءة ويحجب `client_admin` و`anon` تماماً.
  5. جدول `push_subscriptions` لربط اشتراكات Web Push بالجهة بأمان.
  6. تحسين دالة الصيانة الدورية (`cleanup_expired_notifications` / `run_maintenance_cleanup`) لتنظيف الدفعات الآمن مع حماية البيانات الحديثة.

---

## 3. تدقيق PWA والعمل دون إنترنت (`public/sw.js` + `manifest/[slug]`)

1. **مشكلة أيقونات Supabase الخارجية**: `src/app/api/manifest/[slug]/route.ts` يرفض `tenant.logo_url` إذا بدأ بـ `https://`، وبالتالي تظهر أيقونة MENUZ العامة بدل شعار المطعم في Manifest وApple Touch Icon. الحل: مسار خادمي محلي `/api/manifest/[slug]/icon?size=192|512` يجلب الشعار من النطاقات المسموحة فقط (منع SSRF) ويعيد توليد PNG نظيف بالأبعاد المطلوبة عبر `sharp`.
2. **حذف Caches في `sw.js`**: حدث `activate` يحذف جميع الـ Caches التي لا تساوي `CACHE_NAME`؛ يجب حصر الحذف على `key.startsWith("menuz-")`.
3. **بيانات Offline**: يفتقر المنيو لمؤشر واضح عند العرض من الـ Cache دون اتصال، ولا يوجد حد أقصى لعدد الصور المخزنة في الـ Cache، كما لا توجد معالجة `push` و`notificationclick` في `sw.js`.

---

## 4. خارطة التنفيذ اللاحقة
بناءً على هذا التدقيق، سيتم تنفيذ المراحل 2 إلى 14 بالتتابع مع الالتزام الصارم بـ:
- الحفاظ على التوافق التام مع قاعدة `fmdfueuezjhnwwchoock` الحالية (Graceful fallback لأي جدول/عمود جديد في `005`).
- عدم دمج PR #3 وعدم النشر إلى Production وعدم تطبيق أي Migration على قاعدة الإنتاج.
- اختبار وتوثيق كل مرحلة بالتفصيل في تقارير `docs/MENUZ_*.md`.
