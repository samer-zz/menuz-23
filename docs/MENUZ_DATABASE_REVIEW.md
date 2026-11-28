# مراجعة قاعدة البيانات والبنية المنطقية — MENUZ Database Review

- **المشروع**: `fmdfueuezjhnwwchoock` (`eu-west-1`)
- **الميجريشنز المطبقة على الإنتاج**: `001` حتى `006` (`005_menuz_v4_platform_hardening` و `006_notification_push_delivery_tracking`).

---

## 1. مراجعة الجداول والعلاقات والفهارس الحالية
- تمت مراجعة الفهارس الفعلية في `public` (`tenants_slug_key`, `idx_categories_tenant_active_sort`, `idx_menu_items_tenant_cat`, `idx_menu_items_tenant_avail_feat`, `idx_offers_tenant_active`, `idx_wallets_tenant_sort`, `idx_notifications_tenant_expires`, `idx_notifications_due_push`, `idx_analytics_tenant_created`, `idx_audit_logs_created`, `idx_profiles_tenant`).
- جميع المفاتيح الأجنبية تربط البيانات بـ `tenants(id)` مع `ON DELETE CASCADE` (و`ON DELETE SET NULL` في `orders` مع `tenant_name_snapshot` لحفظ سجل الطلبات التاريخي).
- جميع استعلامات الخادم في SSR/API تحدد الأعمدة الآمنة صراحةً وتتجنب N+1 عبر `Promise.all(...)` المتوازي.

## 2. مكونات Migration `005_menuz_v4_platform_hardening.sql` (مطبقة ومختبرة)
1. **إغلاق الرفع المباشر لـ Storage (`menus-media`)**:
   - سحب سياسات `INSERT` / `UPDATE` / `DELETE` من `authenticated` على `storage.objects` ليصبح الخادم (`/api/media/upload` عبر `service_role`) هو البوابة الوحيدة، ومزامنة `file_size_limit` إلى `4194304` (`4MiB`).
2. **أعمدة ألوان الهوية الاختيارية على `tenants`**:
   - `background_color`, `card_color`, `text_color`, `button_text_color` + دالة `update_client_tenant_appearance` الآمنة (تحقق `client_admin` وصيغة Hex `#RRGGBB`).
3. **جدول `public.orders` ودالة `create_order_atomic` و`update_tenant_order_status`**:
   - توثيق الطلبات خادمياً ذرياً عبر `ON CONFLICT (tenant_id, idempotency_key)` مع `payload_hash` و`feedback_token_hash`، وحصر تغيير الحالة بانتقالات صالحة عبر RPC.
4. **جدول `public.order_feedback` (سري لمدير النظام فقط)**:
   - تخزين التقييم (1–5) والملاحظة الاختيارية مع قيد فرادة لكل طلب `UNIQUE (order_id)` وRLS يقصر `SELECT`/`DELETE` على `public.is_super_admin()` فقط.
5. **جدول `public.push_subscriptions` وحقول الجدولة في `notifications`**:
   - تخزين اشتراكات Web Push مع عزل كامل (`REVOKE ALL` عن `anon`/`authenticated`).
6. **دالة الصيانة الدورية على دفعات (`run_maintenance_cleanup(p_batch_limit integer)`)**:
   - تنظيف متدرج حتى `5000` صفاً لـ `notifications` المنتهية، `api_rate_limits`، `login_rate_limits`، و`analytics_events`.

## 3. مكونات Migration `006_notification_push_delivery_tracking.sql` (مطبقة ومختبرة)
1. **تتبع حالة الدفع بدقة على `public.notifications`**:
   - إضافة الأعمدة `push_status` (`pending`, `sent`, `partial`, `failed`, `vapid_not_configured`, `no_subscribers`), `push_attempts`, `push_last_error`, `push_last_attempt_at`, `push_sent_at`، وفهرس `idx_notifications_due_push`.
2. **جدول `public.notification_push_deliveries` لمنع تكرار الإرسال عند إعادة المحاولة**:
   - مفتاح أساسي مركب `(notification_id, subscription_id)` يحفظ حالة كل جهاز (`sent` / `failed`) مع تفعيل RLS وسحب كل صلاحيات `public`, `anon`, `authenticated` ليُدار حصرياً عبر `service_role`.
