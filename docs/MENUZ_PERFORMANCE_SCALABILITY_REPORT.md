# تقرير الأداء والتوسع — MENUZ Platform (Stage 9)

**التاريخ:** 2026-11-20  
**النطاق:** تهيئة المنصة لاستيعاب **150–200 جهة ومطعم**، **100,000+ صنف**، **150 مدير مطعم**، و**1,000 زائر متزامن** ضمن البنية الحالية (Next.js + Vercel + Supabase Free/Pro Tier) دون تكلفة إضافية.

---

## 1. التحسينات المعمارية المطبّقة في المرحلة 9

| التحسين | الموقع | الأثر |
|---|---|---|
| **التحميل المقيّد والطلب الفوري (On-Demand Tenant Menu)** | `src/app/admin/page.tsx`, `src/app/api/admin/tenant-menu/route.ts`, `src/components/admin/super-admin-client.tsx` | لم تعد لوحة Super Admin تحمّل 2000+ صنف من كل المطاعم في الطلب المبدئي؛ يتم جلب بيانات منيو جهة محددة عند الحاجة فقط عبر `/api/admin/tenant-menu?tenantId=...`، مما يُبقي حجم RSC Payload ثابتاً حتى مع 100,000 صنف. |
| **ترقيم وبحث الجهات (Client/Server Bounded Queries)** | `src/components/admin/super-admin-client.tsx`, `src/app/admin/page.tsx` | عرض 12 جهة لكل صفحة مع بحث فوري وتحديد سقف الاستعلامات (`limit(300)` للجهات، `limit(2000)` للتحليلات، `limit(200)` للطلبات والتقييمات). |
| **استعلامات متوازية خالية من N+1** | `src/app/m/[slug]/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/api/orders/route.ts` | استخدام `Promise.all` ومؤشر `.in("id", requestedIds)` بدلاً من حلقات الاستعلام الفردية. |
| **فهارس مركبة للتسريع (في Migration `005`)** | `supabase/migrations/005_menuz_v4_platform_hardening.sql` | `idx_categories_tenant_active_order`, `idx_menu_items_tenant_cat_order`, `idx_offers_tenant_active_window`, `idx_orders_tenant_created`, `idx_analytics_tenant_type_created`. |
| **ضغط الصور والكسل التحميلي** | `src/lib/image-compress.ts`, `src/app/api/media/upload/route.ts`, `src/components/menu/public-menu-client.tsx` | تحويل الصور إلى WebP خفيف عبر `sharp` وتطبيق `loading="lazy"` على بطاقات الأصناف. |

---

## 2. نتائج اختبارات الحمل والتوسع المعزولة (`tests/performance-scale.test.mjs`)

تم تشغيل محاكاة معزولة عبر `node --experimental-strip-types --test tests/performance-scale.test.mjs`:

1. **مقياس 200 جهة و100,000 صنف (500 صنف × 200 مطعم):**
   - تهيئة وفهرسة 100,000 سجل في الذاكرة: **57.2 ms**
   - التصفية والترقيم والبحث عبر 100k صنف: **0.14 ms** (أقل بكثير من عتبة 100 ms)
   - **الحالة:** `COMPLETED & TESTED` (محاكاة محلية في الذاكرة؛ اختبار الحمل الحي على قاعدة البيانات الفعلية يتطلب تطبيق `005` وبيئة Staging).
2. **محاكاة 150 مدير مطعم متزامن (عزل مفاتيح Rate Limit + حساب تباين الألوان WCAG):**
   - 150 سياقاً متزامناً مستقلاً + فحص تباين `>= 4.5`: **7.49 ms**
3. **محاكاة 1,000 زائر متزامن (تأكيد عدم تكرار الطلبات وحساب الأسعار الخادمي):**
   - 1,000 عملية متزامنة (950 طلباً فريداً + 50 إعادة إرسال مكررة تم منع تكرارها): **4.03 ms**

---

## 3. توصيات المرحلة التالية لتطبيق الإنتاج
- مراجعة وتطبيق `supabase/migrations/005_menuz_v4_platform_hardening.sql` لتفعيل الفهارس المركبة الجديدة على قاعدة البيانات الحية.
- مراقبة استهلاك Supabase Bandwidth وConnection Pooler عند تجاوز 100 مطعم نشط.
