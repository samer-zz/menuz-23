# تقرير التحقق والجودة الشامل — QA Report v3.0 (MENUZ | مينوز)

تاريخ التقرير: 2026-11-21  
الإصدار: **v3.0.0** | المستودع: `samer-zz/menuz-23` | Supabase: `fmdfueuezjhnwwchoock` (`eu-west-1`) | Vercel: `menuz-23` (`prj_rcabYKZfrwQuxQ46DqGJhgqNgXRw`)

---

## 1. ملخص حالة التحقق (v3.0)

| الفئة | الفحص المنفذ | النتيجة | التفاصيل |
|---|---|---|---|
| TypeScript | `npm run typecheck` | نجح (0 أخطاء) | فحص صارم لجميع ملفات v3.0 |
| ESLint | `npm run lint` | نجح (0 تحذيرات/أخطاء) | قواعد Next.js + TypeScript |
| Production Build | `npm run build` | نجح | بناء كامل لـ 23 مسار App Router (بما فيها `/api/manifest/[slug]`, `/api/demo/ensure`, `/api/cron/cleanup-notifications`) |
| PWA الديناميكي | `curl /api/manifest/default` + كود `/api/manifest/[slug]` و`m/[slug]/page.tsx` | نجح | يرجع `application/manifest+json` مع `start_url = /m/[slug]`، `scope = /`، `display = standalone` وFallback إلى `/`، وربطه في `<head>` ديناميكياً + `sw.js` (`menuz-pwa-v3`) |
| نظام الإشعارات الفوري | Supabase SQL + RLS + Realtime | نجح | جدول `notifications` مُفعّل عليه RLS والـ Realtime؛ اختبار إدراج إشعار منتهٍ واستدعاء `cleanup_expired_notifications()` أعاد `cleaned_count = 1`؛ جدولة يومية على `/api/cron/cleanup-notifications` |
| المنيو التجريبي (`/m/demo`) | Supabase SQL + `/api/demo/ensure` | نجح | جهة `demo` بعلامة `is_demo = true`، `3` أقسام، `9` أصناف بصور Unsplash، عرضين، محفظتين، وإشعار نشط |
| إندوميتو (`/m/indomito`) | Supabase SQL | نجح | الحفاظ الكامل على `4` أقسام و`13` صنفاً بالأسعار المطابقة + placeholders بتدرج Navy/Orange |
| RTL & التصميم والواجهة | `curl` على `/` والصفحات العامة | نجح | `<html lang="ar" dir="rtl" class="dark">`، وجود شارة `"أول منيو مجاناً لمدة شهر"` وزر `"إنشاء منيو تجريبي"`، عدم ذكر أي مزود بنية تحتية في النص العام الظاهر، وحقوق النشر الحرفية 2027 في تذييل المنيو |
| الأمان وRLS | Supabase SQL + Route Handlers | نجح | عزل تام عبر RLS (`my_tenant_id()` و`is_super_admin()`)، حماية `CRON_SECRET` على `/api/cron/cleanup-notifications`، Rate limiting على `/api/auth/login`، وتنبيه تغيير كلمة المرور خلال 72 ساعة |

---

## 2. توضيح القيود البيئية والبدائل المنفذة
- **`pg_cron` على Supabase Free**: لم يكن مفعّلاً بصلاحيات SQL القياسية في هذا المشروع (`installed_version: null`)؛ لذا تم اعتماد:
  1. تصفية صارمة في سياسات RLS واستعلامات `/m/[slug]` (`expires_at > now()`) بحيث لا يظهر أي إشعار منتهٍ نهائياً.
  2. دالة `public.cleanup_expired_notifications()` مع مهمة **Vercel Cron يومية** (`/api/cron/cleanup-notifications` الساعة `03:00 UTC` محمية بـ `CRON_SECRET`) لحذف الصفوف المنتهية تلقائياً ضمن الباقة المجانية.
- **بيئة Sandbox المعزولة**: الاتصال الصادر إلى `*.supabase.co` مقيد داخل حاوية البناء المحلية، ولذلك تم اختبار المسارات الديناميكية المتصلة بـ Supabase مباشرة عبر Supabase Management API وبناء الإنتاج على سحابة Vercel حيث الاتصال المباشر متاح، كما أن حماية Vercel Team الافتراضية (`ssoProtection: all_except_custom_domains`) تتطلب تعطيل **Vercel Authentication** من إعدادات المشروع في Vercel Dashboard لإتاحة `/m/indomito` و`/m/demo` للجمهور مباشرة عبر رابط `.vercel.app`.

---

## 3. قائمة الفحوصات الميدانية الموصى بها على الإنتاج بعد النشر
1. فتح `https://menuz-23.vercel.app/` والضغط على **"إنشاء منيو تجريبي"** للتأكد من الفتح المباشر على `/m/demo`.
2. فتح `https://menuz-23.vercel.app/m/indomito` على الهاتف، التحقق من الدخلة الترحيبية السريعة، تبديل طريقة العرض (**بطاقات / قائمة / كلاسيكي**)، ثم الضغط على **تثبيت المنيو** للتأكد من أن التطبيق المثبت يفتح على `/m/indomito` مباشرة.
3. الدخول بحساب الجهة في `/dashboard`، إرسال إشعار تجريبي، ومراقبة ظهوره لحظياً في أيقونة الجرس داخل `/m/indomito`.
