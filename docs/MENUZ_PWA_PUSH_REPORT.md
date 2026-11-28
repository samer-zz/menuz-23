# تقرير تطبيق الويب التقدمي وإشعارات الويب (Stages 6 & 7) — MENUZ

**التاريخ:** 2026-11-20  
**الحالة:**
- Manifest الديناميكي + Icon Resizer + SW Scope + Offline UI + Splash: `COMPLETED & TESTED`
- Web Push End-to-End Delivery via VAPID: `IMPLEMENTED — NOT LIVE-TESTED` (`OWNER ACTION REQUIRED` لإضافة مفاتيح VAPID في البيئة)

---

## 1. تجربة التثبيت والتشغيل دون اتصال (`public/sw.js`, `/api/manifest/[slug]`)
- **أيقونات لكل جهة:** مسار `/api/manifest/[slug]/icon?size=180|192|512` يحوّل شعار المطعم (محلياً أو من `menus-media` مع SSRF Guard) إلى PNG قياسي عبر `sharp`، ويدعم `apple-touch-icon` على iOS.
- **تنظيف Cache آمن:** `activate` في `public/sw.js` يحذف فقط المفاتيح التي تبدأ بـ `menuz-` دون لمس أي cache آخر.
- **حماية البيانات الحساسة:** يتجاهل Service Worker مسارات `/api/`, `/admin`, `/dashboard`, `/login`, `/auth` بالكامل.
- **حد أقصى لـ Image Cache:** يتم تقليم `menuz-images-v4` تلقائياً إلى 80 صورة بحد أقصى.
- **شاشة الترحيب وتلميح التثبيت:** شاشة ترحيب لمدة 3.2 ثانية مرة واحدة بالجلسة مع زر «تخطي» واحترام `prefers-reduced-motion`، وتلميح تثبيت أول زيارة (`PwaOnboardingHint`) يظهر فقط عند دعم التثبيت الفعلي.
- **وضع Offline:** شريط تنبيه أعلى المنيو عند انقطاع الاتصال يوضح أن الأسعار أو التوفر قد لا تعكس آخر تحديث مع زر «تحديث».

## 2. إشعارات الويب (`src/app/api/push/subscribe/route.ts` & `src/app/api/push/send/route.ts`)
- **اشتراك اختياري صريح (Opt-in):** من زر الإشعارات في المنيو العام دون إجبار، مع حفظ الاشتراك في `push_subscriptions` بعد تطبيق `005`.
- **البث المجاني عبر `web-push` (MIT):** عند نشر إشعار من لوحة التحكم عبر `/api/push/send` يُنشر لحظياً داخل المنيو (Realtime) ويُرسل عبر VAPID للمشتركين إن توفرت `NEXT_PUBLIC_VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY`، مع حذف الاشتراكات المنتهية (`404`/`410`) تلقائياً.
- **قيود iOS الموثّقة:** على أجهزة iPhone/iPad يعمل Web Push فقط بعد تثبيت المنيو على الشاشة الرئيسية (Add to Home Screen) في إصدار iOS 16.4 فأحدث.
