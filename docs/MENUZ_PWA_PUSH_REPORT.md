# تقرير تطبيق الويب التقدمي وإشعارات الويب (Stages 6 & 7 — v4.1) — MENUZ

**التاريخ:** 2026-11-20  
**الحالة:**
- Manifest الديناميكي + Icon Resizer + SW Scope (`menuz-pwa-v5`) + Offline UI + Splash: `COMPLETED & VERIFIED`
- Web Push via VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`): `CONFIGURED IN VERCEL & UNIT/DISPATCH TESTED` (يخضع الإرسال الفعلي لجهاز متصفح حيّ لاشتراك جهاز حقيقي في المتصفح)

---

## 1. تجربة التثبيت والتشغيل دون اتصال (`public/sw.js`, `/api/manifest/[slug]`)
- **أيقونات لكل جهة:** مسار `/api/manifest/[slug]/icon?size=180|192|512` يحوّل شعار المطعم (محلياً أو من `menus-media` مع SSRF Guard و`sharp` `failOn: "warning"`) إلى PNG قياسي، ويدعم `apple-touch-icon` على iOS.
- **تنظيف Cache آمن:** `activate` في `public/sw.js` يحذف فقط المفاتيح القديمة التي تبدأ بـ `menuz-` (الإصدار الحالي `menuz-pwa-v5`).
- **حماية البيانات الحساسة:** يتجاهل Service Worker مسارات `/api/`, `/admin`, `/dashboard`, `/login`, `/auth` بالكامل، ويوفر استجابة احتياطية آمنة عند تعذر وجود `/offline` في الكاش.
- **حد أقصى لـ Image Cache:** يتم تقليم `menuz-images-v4` تلقائياً إلى 80 صورة بحد أقصى.
- **شاشة الترحيب وتلميح التثبيت:** شاشة ترحيب لمدة 3.2 ثانية مرة واحدة بالجلسة مع زر «تخطي» واحترام `prefers-reduced-motion`، وتلميح تثبيت أول زيارة (`PwaOnboardingHint`) يظهر فقط عند دعم التثبيت الفعلي.
- **وضع Offline:** شريط تنبيه أعلى المنيو عند انقطاع الاتصال يوضح أن الأسعار أو التوفر قد لا تعكس آخر تحديث مع زر «تحديث».

## 2. إشعارات الويب (`src/lib/push-security.ts`, `src/lib/web-push-dispatch.ts`, `/api/push/*`, `/api/cron/cleanup-notifications`)
- **اشتراك اختياري صريح (Opt-in):** من زر الإشعارات في المنيو العام باستخدام `urlBase64ToUint8Array` لضمان توافق Safari/iOS/Firefox/Chrome، مع حفظ الاشتراك في `push_subscriptions`.
- **حماية SSRF مع التمييز الدقيق لأخطاء DNS:**
  - تتحقق `verifyPublicPushEndpoint` من HTTPS والمنفذ الافتراضي ونطاقات خدمات الدفع المعتمدة (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`, `*.webpush.microsoft.com`) ومنع جميع العناوين الخاصة/الداخلية.
  - يتم التمييز بين الخطأ الدائم (`invalid_url`, `private_ip`, وHTTP `404`/`410`) الذي يحذف الاشتراك، وبين أخطاء DNS المؤقتة (`dns_transient_error` مثل `SERVFAIL`/`EAI_AGAIN`) أو `429`/`5xx` التي **تُبقي الاشتراك سليماً** لإعادة المحاولة لاحقاً.
- **عدم تكرار الإرسال ودقة `push_sent` / `push_status`:**
  - عبر جدول `notification_push_deliveries` (`006`)، عند حدوث فشل جزئي (`web_push_partial`) تُعاد المحاولة للأجهزة المتبقية فقط دون تكرار الإرسال للأجهزة التي استلمت الإشعار مسبقاً.
  - لا يُضبط `push_sent = true` أبداً عند نقص VAPID أو فشل الإرسال أو عدم وجود مشتركين.
- **قيود iOS الموثّقة:** على أجهزة iPhone/iPad يعمل Web Push فقط بعد تثبيت المنيو على الشاشة الرئيسية (Add to Home Screen) في إصدار iOS 16.4 فأحدث.
