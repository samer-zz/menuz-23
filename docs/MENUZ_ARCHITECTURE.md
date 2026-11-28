# المعمارية الهندسية لمنصة MENUZ v4

## 1. طبقات النظام
1. **طبقة العرض والعميل (Next.js App Router + React 19 + Tailwind CSS)**:
   - صفحات تسويقية سريعة pre-rendered (`/`, `/about`, `/services`, `/faq`, `/contact`).
   - بوابة المنيو العام (`/m/[slug]`) بدعم SSR + نظام ألوان ديناميكي حسب الجهة + PWA + Realtime notifications + وضع Offline.
   - لوحتا إدارة معزولتان عبر Middleware + SSR + RLS (`/dashboard` لـ `client_admin`، `/admin` لـ `super_admin`).
2. **طبقة API والأمان (Route Handlers)**:
   - حراسة شاملة بـ `verifySameOrigin`, `getRateLimitIdentifier` (IP/Fingerprint غير مجمع)، Fail-Closed Rate Limiting (`503`)، Zod validation، و`writeAuditLog`.
   - رفع الوسائط الخادمي الصارم (`POST/DELETE /api/media/upload`) عبر `sharp` (`4MiB`, WebP re-encode, EXIF strip).
   - حساب وتوثيق الطلبات (`POST /api/orders`)، تقييم التجربة المعزول (`POST /api/feedback`)، اشتراكات وإرسال Push (`/api/push/subscribe`, `/api/push/send`)، وتوليد Manifest وأيقونات الجهات (`/api/manifest/[slug]`, `/api/manifest/[slug]/icon`).
3. **طبقة البيانات والتخزين (Supabase PostgreSQL + Auth + Storage)**:
   - عزل متعدد الجهات (`multi-tenant isolation`) عبر `Row Level Security` ودوال `SECURITY DEFINER` محكمة الصلاحيات.
   - باكت `menus-media` للصور العامة للمنيو فقط، مع التدرج نحو إغلاق الرفع المباشر في `005`.
4. **طبقة الموثوقية والصيانة (Vercel Hobby + Cron)**:
   - Cron يومي `/api/health` و`/api/cron/cleanup-notifications` بصيانة دفعية غير مؤثرة على التقارير الحديثة.
