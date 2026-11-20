# تقرير التحقق والجودة الشامل — QA Report (MENUZ | مينوز)

تاريخ التقرير: 2026-11-20  
المشروع: `samer-zz/menuz-23` | Supabase: `fmdfueuezjhnwwchoock` (`eu-west-1`) | Vercel: `menuz-23` (`prj_rcabYKZfrwQuxQ46DqGJhgqNgXRw`)

---

## 1. ملخص حالة التحقق

| الفئة | الفحص المنفذ | النتيجة | التفاصيل |
|---|---|---|---|
| TypeScript | `npm run typecheck` | نجح (0 أخطاء) | فحص صارم لجميع ملفات `src/` |
| ESLint | `npm run lint` | نجح (0 تحذيرات/أخطاء) | قواعد Next.js + TypeScript |
| Production Build | `npm run build` | نجح | بناء كامل لـ 20 مسار App Router والخطوط المحلية `@fontsource` |
| Unit & Business Logic | `npx tsx` assertions | نجح | تحقق من: قوة كلمة المرور، تطبيع أرقام اليمن (`967`)، توليد رسالة فاتورة واتساب/SMS، انتهاء صلاحية العروض المجدولة |
| Local SSR & Headers | `npm run start` + `curl` | نجح | استجابة `200 OK` للمسارات العامة (`/`, `/about`, `/services`, `/faq`, `/contact`, `/login`, `/offline`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js`, `/branding/*`)، إعادة توجيه `307` لـ `/admin` و`/dashboard` عند عدم المصادقة، وترويسات الأمان (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`)، وتأكيد `<html lang="ar" dir="rtl" class="dark">` |
| Supabase Schema & RLS | SQL via Supabase API | نجح | تفعيل RLS على جميع الجداول العشرة (`rowsecurity = true`)، وجود `23` سياسة RLS في `public` و`4` سياسات على حاوية التخزين `menus-media`، واختبار دالة `record_menu_event` ثم تنظيف سجل الاختبار |
| Seed Data (`indomito`) | SQL via Supabase API | نجح | وجود جهة `indomito` مع `4` أقسام و`13` صنفاً بالأسعار المطابقة تماماً للمواصفات |
| Auth Accounts & Config | Supabase Auth API | نجح | إنشاء `admin@menuz.app` (`super_admin`) و`indomito@menuz.app` (`client_admin`) مع `disable_signup: true` و`site_url: https://menuz-23.vercel.app` |
| Vercel Production Deploy | Vercel Deployment API | نجح (`READY`) | البناء `dpl_2vNDmFffMMDHDXMVVrLHKMHvWbH3` منتهٍ ومُرقّى للإنتاج (`PROMOTED`) على `https://menuz-23.vercel.app` |

---

## 2. تفاصيل البيانات الأولية المُتحقق منها (`indomito`)
1. **سندوتش** (3 أصناف): سندوتش شبس (`100.00`)، سندوتش شبس جبن (`150.00`)، سندوتش دبل خبز جبن (`200.00`).
2. **شبس** (4 أصناف): شبس صغير (`200.00`)، شبس وسط (`300.00`)، شبس كبير (`500.00`)، شبس جبن (`600.00`).
3. **اندوميتو** (4 أصناف): اندوميتو صغير (`300.00`)، اندوميتو وسط (`500.00`)، اندوميتو جبن (`600.00`)، اندوميتو كبير (`1000.00`).
4. **كركديه** (2 صنفان): كركديه وسط (`150.00`)، كركديه كبير (`250.00`).

---

## 3. ملاحظات البيئة والإنتاج
- **بيئة الاختبار المعزولة (Sandbox)**: لا تسمح باتصال صادر من الخادم المحلي إلى `*.supabase.co`؛ لذلك تم التحقق من قاعدة البيانات وسياسات RLS ودوال RPC مباشرة عبر Supabase Management API، وتم التحقق من البناء الإنتاجي وجميع متغيرات البيئة على سحابة Vercel حيث الاتصال المباشر بـ Supabase متاح.
- **حماية Vercel Deployment Protection**: إعداد الفريق الافتراضي في Vercel يفعّل `ssoProtection: all_except_custom_domains` على روابط `.vercel.app`. لإتاحة رابط `/m/indomito` للجمهور مباشرة عبر رابط `.vercel.app` دون طلب تسجيل دخول Vercel، يرجى تعطيل **Vercel Authentication** من إعدادات المشروع في لوحة Vercel (`Settings -> Deployment Protection`) أو ربط نطاق مخصص (Custom Domain).
- **اختبارات التصفح الفعلي بعد النشر**: بعد تعطيل حماية Vercel على `.vercel.app` (إن رُغب في ذلك)، يُنصح بفتح `https://menuz-23.vercel.app/m/indomito` و`https://menuz-23.vercel.app/login` من متصفح الهاتف لتجربة مسح QR وتثبيت PWA وإرسال فاتورة واتساب حية.
