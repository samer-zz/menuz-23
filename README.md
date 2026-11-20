# مينوز | MENUZ — منصة المنيو الرقمي الذكي

<div align="center">
  <img src="public/branding/menuz2_logo.png" alt="MENUZ Logo" width="240" />
  <p><strong>امسح .. اطلب .. واستمتع | SCAN • ORDER • ENJOY</strong></p>
  <p>من تطوير <strong>شركة سامرز للحلول الذكية (Samerz Smart Solutions)</strong></p>
</div>

---

## نظرة عامة (Overview)

**مينوز | MENUZ** هي منصة سحابية متكاملة متعددة الجهات (Multi-Tenant SaaS) لإدارة القوائم الرقمية (Digital QR Menus) للمطاعم والكافيهات وعربات الطعام، مبنية بـ **Next.js (App Router)** و**TypeScript** و**Tailwind CSS** و**Supabase** و**Vercel**.

### المميزات الرئيسية (Key Features)
- **تصميم عربي فائق الفخامة (RTL-First)**: دعم كامل للغة العربية، وضع ليلي افتراضي مع تبديل للوضع النهاري، وحركات سلسة عبر Framer Motion.
- **تجربة منيو تفاعلية (`/m/[slug]`)**:
  - شريط عروض مجدولة متحرك (يختفي تلقائياً بعد انتهاء التاريخ).
  - عرض الأصناف المميزة + أقسام لاصقة للتنقل السريع + بحث وفلترة بالشارات.
  - سلة طلبات منزلقة بعدّاد حي وشاشة فاتورة قابلة للتعديل.
  - دعم الدفع النقدي والمحافظ الإلكترونية (مع نسخ رقم المحفظة وإدخال رقم العملية).
  - إرسال الفاتورة مباشرة عبر **واتساب** أو **SMS**.
- **عزل أمني صارم (Row Level Security)**:
  - `Guest`: تصفح المنيو العام فقط.
  - `Client Admin`: إدارة أقسام وأصناف وعروض ومحافظ وإحصائيات جهته فقط دون تعديل اسم الجهة أو الشعار أو رؤية بيانات غيره.
  - `Super Admin`: تحكم كامل بالجهات، الحسابات، الصلاحيات، إيقاف/تشغيل أي منيو برسالة مخصصة، مقارنة الأداء، وسجل التدقيق (Audit Log).
- **PWA + Offline**: تطبيق ويب تقدمي قابل للتثبيت مع تخزين مؤقت ذكي وصفحة مخصصة عند انقطاع الإنترنت.
- **الأداء والوسائط**: ضغط تلقائي للصور في المتصفح قبل الرفع إلى Supabase Storage، وتوليد رموز QR بصيغتي PNG وSVG.

---

## البنية التقنية (Tech Stack)

| الطبقة | التقنية |
|---|---|
| Frontend & Edge | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend & Database | Supabase Postgres + Row Level Security (RLS) |
| Authentication | Supabase Auth + SSR Cookies + DB-backed Login Rate Limiting |
| Storage | Supabase Storage (`menus-media` bucket) with client-side WebP compression |
| Deployment | Vercel Hobby Plan (Free Tier) |

---

## التثبيت والتشغيل المحلي (Local Setup)

1. استنساخ المستودع وتثبيت الحزم:
   ```bash
   git clone https://github.com/samer-zz/menuz-23.git
   cd menuz-23
   npm install
   ```

2. نسخ ملف البيئة وتعبئة بيانات Supabase:
   ```bash
   cp .env.example .env.local
   ```

3. تنفيذ التهجير (Migrations) على مشروع Supabase من مجلد `supabase/migrations/`:
   - `001_initial_schema.sql`: الجداول، الفهارس، الدوال، سياسات RLS، ومخزن الصور.
   - `002_seed_indomito.sql`: البيانات الأولية لجهة إندوميتو (INDOMITO).

4. تشغيل خادم التطوير:
   ```bash
   npm run dev
   ```

---

## حدود الخطة المجانية (Free Tier Limits & Scaling Notes)
- **Supabase Free**: قاعدة بيانات 500MB، مساحة تخزين 1GB، و50,000 مستخدم نشط شهرياً. يستوعب النظام **50+ جهة** بكفاءة عالية بفضل الفهارس المخصصة وضغط الصور التلقائي، مع ملاحظة أن التوسع فوق عدة آلاف من الصور عالية الدقة قد يتطلب الترقية لخطة Supabase Pro.
- **Vercel Hobby**: استضافة مجانية غير محدودة للمواقع التجارية الصغيرة/المشاريع الأولية مع حد تنفيذ Serverless مناسب، ومهمة Cron يومية واحدة للحفاظ على جاهزية قاعدة البيانات.
- **GitHub Free**: مستودع خاص أو عام غير محدود.

---

## الترخيص (License)
هذا المشروع مرخص بموجب رخصة [MIT](LICENSE) — © 2026 شركة سامرز للحلول الذكية.
