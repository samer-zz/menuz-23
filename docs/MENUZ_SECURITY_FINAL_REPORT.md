# التقرير النهائي للأمن السيبراني والتحصين — MENUZ Security Final Report

- **التاريخ**: 2026-11-20
- **الفرع**: `arena/296f4909-menuz-23`
- **الحالة**: `COMPLETED & TESTED` على مستوى الكود والاختبارات المحلية وقاعدة Supabase الحالية (`001`–`004`)، مع إعداد `005` جاهزة للإغلاق الكامل لرفع Storage المباشر عند موافقة المالك.

---

## 1. طبقات الحماية المطبقة

### أ. حماية مسار الرفع `/api/media/upload` (رفع + حذف آمن)
1. **المسار المعتمد الوحيد**: تم تحويل الرفع في `POST /api/media/upload` ليتم من الخادم عبر `createAdminSupabase()` **فقط بعد** اجتياز جميع فحوصات الجلسة والصلاحية والجهات و`sharp`، مما يتيح إغلاق الرفع المباشر من المتصفح إلى `storage.objects` عبر Migration `005` دون كسر اللوحات ودون كشف `Service Role` للمتصفح إطلاقاً.
2. **فك ترميز الصور والتحقق الحقيقي (`sharp`)**:
   - حد `4MiB` (`4 * 1024 * 1024`) في العميل والخادم وحارس `413` المبكر على `content-length`.
   - فحص Magic Bytes ورفض `SVG` / `XML` / `HTML`.
   - فك ترميز كامل البكسلات عبر `sharp(..., { failOn: "error", limitInputPixels: 25_000_000, animated: false })`، مما يرفض أي ملف تالف أو مبتور حتى لو كانت ترويسته صالحة.
   - تحجيم حتى `1600x1600` (دون تكبير)، تصحيح الاتجاه عبر `.rotate()`، إزالة EXIF/XMP/IPTC كلياً، وإعادة الترميز إلى `image/webp`.
3. **حذف الوسائط الآمن (`DELETE /api/media/upload`)**:
   - يتحقق من `verifySameOrigin`, Rate Limit, جلسة المستخدم، ويقصر `client_admin` على مسارات تبدأ بـ `${profile.tenant_id}/` فقط ويرفض `..` traversal، ويسجل العملية في `audit_logs`.

### ب. Rate Limiting متعدد المستويات ومنع تجميع `unknown`
- **`getRateLimitIdentifier(request)`** في `src/lib/security.ts`:
  - يعطي الأولوية لـ `x-vercel-forwarded-for` ثم `x-real-ip` ثم آخر IP صالح من اليمين في `x-forwarded-for` (IPv4/IPv6 مع تطبيع `::ffff:`).
  - **عند غياب ترويسات IP كلياً**: لا يجمع جميع المستخدمين في `"unknown"` واحد؛ بل يولّد بصمة مميزة `fp:<sha256_prefix(ua|lang|ch-ua|host)>`.
- **Fail-Closed (`503`)**: جميع المسارات الحساسة (`/api/auth/login`, `/api/auth/change-password`, `/api/contact`, `/api/analytics/event`, `/api/demo/ensure`, `/api/media/upload`) تفشل مغلقةً عند تعذر مخزن الحماية، مع مهلة `4000ms`.
- **حماية Auth و`profiles` من الاستنزاف**:
  - في `/api/media/upload` و`/api/auth/change-password`: فحص `Pre-auth IP Rate Limit` قبل استدعاء `supabase.auth.getUser()`، وفحص `Per-User Rate Limit` قبل استعلامات التعديل/التخزين.

### ج. منع SSRF وتشديد Security Headers & CSP
- إضافة `isAllowedStorageMediaUrl()` في `src/lib/security.ts` لقصر جلب الصور الخادمي (مثل توليد أيقونات Manifest) على المسارات المحلية أو باكت `menus-media` الخاص بالمشروع فقط، ومنع عناوين الشبكات الداخلية (`169.254.x.x`, `localhost`, إلخ).
- تعزيز `next.config.ts` بترويسات: `Content-Security-Policy` (خالية من `'unsafe-eval'` في الإنتاج، مع `upgrade-insecure-requests`)، `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`, و`Permissions-Policy` المقيدة.

---

## 2. نتائج اختبارات الأمن (`tests/security.test.mjs`)
- **7 / 7 اختبارات ناجحة**:
  1. Fail-Closed Rate Limiting (`unavailable` / `rate_limited` / `allowed`).
  2. استخراج IP ومنع التزييف + عدم تجميع الطلبات بدون IP في `"unknown"`.
  3. حارس SSRF (`isAllowedStorageMediaUrl`).
  4. فحص Origin / CSRF (`verifySameOrigin`).
  5. فك ترميز `sharp` الحقيقي (`1MB` / `3MB` / `3.92MB` / رفض `4MiB+1` / رفض EXIF / رفض PNG بترويسة فقط وJPEG مبتور / رفض SVG & HTML & `5500x5500`).
  6. مسار `/api/media/upload` (`POST` & `DELETE`: `429` قبل Auth، `503`، `401` بدون `profiles`، `429` User، `413`، `403` عزل الجهات، `404`، `200` نجاح، ومنع `../` عند الحذف).
  7. تعقيم الروابط (`sanitizeSafeUrl`).
