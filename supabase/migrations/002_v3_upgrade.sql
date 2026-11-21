-- ============================================================================
-- MENUZ (مينوز) v3.0 Upgrade Migration
-- Adds: tenants.is_demo, performance indexes for 150+ tenants,
--       notifications table with strict RLS + Supabase Realtime,
--       auto-cleanup function + optional pg_cron schedule,
--       and complete 'demo' tenant seed with Unsplash open-source photography.
-- ============================================================================

-- 1. Add is_demo column to tenants (non-breaking)
alter table public.tenants
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_tenants_is_demo_created
  on public.tenants (is_demo, created_at desc);

create index if not exists idx_categories_tenant_active_sort
  on public.categories (tenant_id, is_active, sort_order);

create index if not exists idx_menu_items_tenant_avail_feat
  on public.menu_items (tenant_id, is_available, is_featured);

-- 2. In-App Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  body text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_tenant_expires
  on public.notifications (tenant_id, expires_at desc, created_at desc);

alter table public.notifications enable row level security;

-- Drop if re-running safely
drop policy if exists "Public reads active non-expired notifications" on public.notifications;
drop policy if exists "Tenant admins manage own notifications" on public.notifications;

create policy "Public reads active non-expired notifications"
  on public.notifications for select
  to anon, authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.tenants t
      where t.id = notifications.tenant_id
        and t.is_active = true
    )
  );

create policy "Tenant admins manage own notifications"
  on public.notifications for all
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.my_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.my_tenant_id()
  );

-- Enable Realtime on notifications safely
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when others then
  raise notice 'Realtime publication setup skipped: %', sqlerrm;
end $$;

-- 3. Automatic 7-day notification cleanup function (+ pg_cron if supported on plan)
create or replace function public.cleanup_expired_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.notifications where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
begin
  create extension if not exists pg_cron with schema extensions;
  perform cron.unschedule('menuz_cleanup_expired_notifications');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule(
    'menuz_cleanup_expired_notifications',
    '0 3 * * *',
    $cron$select public.cleanup_expired_notifications();$cron$
  );
exception when others then
  raise notice 'pg_cron schedule skipped (use /api/cron/cleanup-notifications fallback): %', sqlerrm;
end $$;

-- 4. Seed 'demo' tenant (is_demo = true) with full menu, offers, wallets, and notification
do $$
declare
  v_demo_id uuid;
  v_cat_fast uuid;
  v_cat_drinks uuid;
  v_cat_sweets uuid;
begin
  insert into public.tenants (
    slug,
    name_ar,
    name_en,
    story,
    description,
    address,
    phone,
    whatsapp,
    instagram,
    has_delivery,
    delivery_note,
    logo_url,
    cover_url,
    primary_color,
    accent_color,
    currency,
    is_active,
    is_demo
  )
  values (
    'demo',
    'مطعم مينوز التجريبي',
    'MENUZ DEMO',
    'منيو تجريبي تفاعلي يستعرض إمكانات منصة مينوز v3.0 من شركة سامرز للحلول الذكية — تصفح الأقسام، بدّل طرق العرض، جرّب السلة، وأرسل فاتورة واتساب نموذجية.',
    'نموذج حي لمنيو رقمي متكامل: وجبات سريعة، مشروبات منعشة، وحلويات فاخرة.',
    'صنعاء - شارع القيادة - نموذج عرض تفاعلي',
    '776951100',
    '967776951100',
    'menuz.app',
    true,
    'توصيل تجريبي سريع خلال 30 دقيقة',
    '/branding/menuz_mark_white.png',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
    '#0B2D5B',
    '#FF7A00',
    'ر.ي',
    true,
    true
  )
  on conflict (slug) do update set
    is_demo = true,
    is_active = true,
    phone = excluded.phone,
    whatsapp = excluded.whatsapp
  returning id into v_demo_id;

  select id into v_cat_fast from public.categories where tenant_id = v_demo_id and name = 'وجبات سريعة';
  if v_cat_fast is null then
    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_demo_id, 'وجبات سريعة', 'برجر، بيتزا، ومقرمشات طازجة', 1, true)
    returning id into v_cat_fast;
  end if;

  select id into v_cat_drinks from public.categories where tenant_id = v_demo_id and name = 'مشروبات';
  if v_cat_drinks is null then
    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_demo_id, 'مشروبات', 'قهوة مختصة وعصائر باردة', 2, true)
    returning id into v_cat_drinks;
  end if;

  select id into v_cat_sweets from public.categories where tenant_id = v_demo_id and name = 'حلويات';
  if v_cat_sweets is null then
    insert into public.categories (tenant_id, name, description, sort_order, is_active)
    values (v_demo_id, 'حلويات', 'كيك وحلويات يومية فاخرة', 3, true)
    returning id into v_cat_sweets;
  end if;

  if not exists (select 1 from public.menu_items where tenant_id = v_demo_id) then
    insert into public.menu_items (
      tenant_id, category_id, name, description, ingredients, price, original_price,
      image_url, is_available, is_featured, badges, sort_order
    ) values
      (
        v_demo_id, v_cat_fast, 'برجر سماش كلاسيك دبل',
        'شريحتا لحم أنجوس مشوي مع جبن شيدر ذائب وصوص مينوز الخاص',
        'لحم طازج، جبن شيدر، مخلل، بصل مكرمل، خبز بريوش',
        1800, 2200,
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
        true, true, array['best_seller']::text[], 1
      ),
      (
        v_demo_id, v_cat_fast, 'بيتزا مارغريتا إيطالية',
        'عجينة مخمرة 48 ساعة مع صلصة طماطم سان مارزانو وموزاريلا طازجة',
        'دقيق إيطالي، طماطم، موزاريلا، ريحان طازج',
        2400, null,
        'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80',
        true, true, array['new']::text[], 2
      ),
      (
        v_demo_id, v_cat_fast, 'بطاطس كرسبي بالجبن والهلابينو',
        'بطاطس مقرمشة مغطاة بصوص الشيدر الدافئ وشرائح الهلابينو',
        'بطاطس، صوص جبن، هلابينو، بهارات مدخنة',
        900, null,
        'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
        true, false, array['limited_offer']::text[], 3
      ),
      (
        v_demo_id, v_cat_drinks, 'آيس سبانيش لاتيه',
        'إسبريسو مزدوج مع حليب مبخر بارد ولمسة حليب مكثف محلى',
        'قهوة مختصة، حليب بارد، ثلج، حليب مكثف',
        1100, null,
        'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80',
        true, true, array['best_seller']::text[], 4
      ),
      (
        v_demo_id, v_cat_drinks, 'موهيتو باشن فروت',
        'مشروب غازي منعش بنكهة الباشن فروت والنعناع والليمون الطازج',
        'باشن فروت، نعناع، ليمون، صودا',
        850, null,
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
        true, false, array['new']::text[], 5
      ),
      (
        v_demo_id, v_cat_drinks, 'عصير مانجو طازج',
        'مانجو طبيعي 100% بدون سكر مضاف',
        'مانجو طازج مبرد',
        750, null,
        'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=900&q=80',
        true, false, array[]::text[], 6
      ),
      (
        v_demo_id, v_cat_sweets, 'تشيز كيك التوت البري',
        'تشيز كيك مخبوز بقوام كريمي وصوص التوت البري الطبيعي',
        'جبن كريمي، بسكويت زبدة، توت بري',
        1400, 1650,
        'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80',
        true, true, array['best_seller']::text[], 7
      ),
      (
        v_demo_id, v_cat_sweets, 'براونيز الشوكولاتة الساخن',
        'قطع براونيز غنية بالشوكولاتة الداكنة مع رشة فستق',
        'شوكولاتة داكنة، زبدة، كاكاو، فستق',
        1200, null,
        'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=900&q=80',
        true, false, array['limited_offer']::text[], 8
      ),
      (
        v_demo_id, v_cat_sweets, 'تيراميسو إيطالي أصلي',
        'طبقات بسكويت سافوياردي مشبعة بالإسبريسو وكريمة الماسكربوني',
        'ماسكربوني، إسبريسو، كاكاو، بسكويت',
        1500, null,
        'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80',
        false, false, array['unavailable']::text[], 9
      );
  end if;

  if not exists (select 1 from public.offers where tenant_id = v_demo_id) then
    insert into public.offers (tenant_id, title, description, badge_text, discount_text, starts_at, ends_at, is_active)
    values
      (v_demo_id, 'كومبو الغداء الذكي', 'برجر سماش دبل + بطاطس كرسبي + موهيتو بسعر موحد', '🔥 عرض اليوم', 'وفر 25%', now() - interval '1 day', now() + interval '30 days', true),
      (v_demo_id, 'أول منيو مجاناً لمدة شهر', 'جرّب منصة مينوز v3.0 لمنشأتك مجاناً لمدة 30 يوماً', '🎁 عرض الإطلاق', 'شهر مجاني', now() - interval '1 day', now() + interval '60 days', true);
  end if;

  if not exists (select 1 from public.wallets where tenant_id = v_demo_id) then
    insert into public.wallets (tenant_id, name, account_number, account_name, is_active, sort_order)
    values
      (v_demo_id, 'جيب (نموذج تجريبي)', '776951100', 'حساب مينوز التجريبي', true, 1),
      (v_demo_id, 'ون كاش (نموذج تجريبي)', '776951100', 'شركة سامرز للحلول الذكية', true, 2);
  end if;

  if not exists (select 1 from public.notifications where tenant_id = v_demo_id) then
    insert into public.notifications (tenant_id, title, body, expires_at)
    values
      (v_demo_id, 'مرحباً بك في مينوز v3.0 التجريبي', 'يمكنك الآن تبديل طريقة العرض (بطاقات / قائمة / كلاسيكي) وتثبيت هذا المنيو كتطبيق مستقل مباشرة على جهازك!', now() + interval '7 days');
  end if;
end $$;
