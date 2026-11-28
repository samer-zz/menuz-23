# مراجعة قاعدة البيانات والبنية المنطقية — MENUZ Database Review

- **المشروع**: `fmdfueuezjhnwwchoock` (`eu-west-1`)
- **الميجريشنز المطبقة حالياً على الإنتاج**: `001` حتى `004`.
- **الميجريشن الجديدة الجاهزة للمراجعة (غير مطبقة على الإنتاج التزاماً بالقيود)**: `supabase/migrations/005_menuz_v4_platform_hardening.sql`.

---

## 1. مراجعة الجداول والعلاقات والفهارس الحالية
- تمت مراجعة `31` فهرساً فعلياً في `public` (`tenants_slug_key`, `idx_categories_tenant_active_sort`, `idx_menu_items_tenant_cat`, `idx_menu_items_tenant_avail_feat`, `idx_offers_tenant_active`, `idx_wallets_tenant_sort`, `idx_notifications_tenant_expires`, `idx_analytics_tenant_created`, `idx_audit_logs_created`, `idx_profiles_tenant`).
- جميع المفاتيح الأجنبية تربط البيانات بـ `tenants(id)` مع `ON DELETE CASCADE` (أو `ON DELETE SET NULL` حيث يلزم حفظ الأثر).
- جميع استعلامات الخادم في SSR/API تحدد الأعمدة الآمنة صراحةً وتتجنب N+1 عبر `Promise.all(...)` المتوازي.

## 2. مكونات Migration `005_menuz_v4_platform_hardening.sql` (غير مطبقة بعد)
1. **إغلاق الرفع المباشر لـ Storage (`menus-media`)**:
   - سحب سياسات `INSERT` / `UPDATE` / `DELETE` من `authenticated` على `storage.objects` ليصبح الخادم (`/api/media/upload` عبر `service_role`) هو البوابة الوحيدة، ومزامنة `file_size_limit` إلى `4194304` (`4MiB`).
2. **أعمدة ألوان الهوية الاختيارية على `tenants`**:
   - `background_color`, `card_color`, `text_color`, `button_text_color` + دالة `update_client_tenant_appearance` الآمنة (تحقق `client_admin` وصيغة Hex `#RRGGBB`).
3. **جدول `public.orders`**:
   - توثيق الطلبات خادمياً مع قيد منع التكرار `UNIQUE (tenant_id, idempotency_key)` وحساب الإجمالي من `menu_items` بالخادم، وعزل القراءة/التحديث بـ RLS لكل جهة.
4. **جدول `public.order_feedback` (سري لمدير النظام فقط)**:
   - تخزين التقييم (1–5) والملاحظة الاختيارية مع RLS يقصر `SELECT`/`DELETE` على `public.is_super_admin()` فقط ويمنع `client_admin` و`anon` تماماً.
5. **جدول `public.push_subscriptions` وحقول الجدولة في `notifications`**:
   - تخزين اشتراكات Web Push مع عزل كامل (`REVOKE ALL` عن `anon`/`authenticated`) وحقول `scheduled_for`, `push_sent`.
6. **دالة الصيانة الدورية على دفعات (`run_maintenance_cleanup`)**:
   - تنظيف متدرج (`LIMIT 1000` قابل للضبط حتى `5000`) لـ `notifications` المنتهية، `api_rate_limits` الأقدم من ساعتين، `login_rate_limits` الأقدم من 24 ساعة، و`analytics_events` الأقدم من 180 يوماً.

## 3. التوافق المزدوج قبل تطبيق `005`
- الكود الجديد في التطبيق يتعامل بلطف (Graceful Fallback) مع عدم وجود جداول/أعمدة `005` على `fmdfueuezjhnwwchoock` حتى يوافق المالك على تطبيق `005` بعد دمج PR #3، مما يضمن عمل Preview والاختبارات دون أي خطأ `42P01` أو `42703`.
