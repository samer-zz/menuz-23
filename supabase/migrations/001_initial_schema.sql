-- MENUZ (مينوز) Initial Database Schema, Indexes, Storage & Strict RLS
-- Compatible with Supabase Free Tier & 50+ multi-tenant scale

create extension if not exists "pgcrypto";

-- 1. TENANTS
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar text not null,
  name_en text,
  story text,
  description text,
  address text,
  phone text,
  whatsapp text,
  instagram text,
  facebook text,
  tiktok text,
  has_delivery boolean not null default true,
  delivery_note text default 'خدمة التوصيل متوفرة',
  logo_url text,
  cover_url text,
  primary_color text not null default '#0B2D5B',
  accent_color text not null default '#FF7A00',
  currency text not null default 'ر.ي',
  is_active boolean not null default true,
  suspended_message text not null default 'نعتذر، هذا المنيو متوقف مؤقتاً للصيانة والتحديث. يرجى المحاولة لاحقاً.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenants_slug on public.tenants(slug);
create index if not exists idx_tenants_active on public.tenants(is_active);

-- 2. PROFILES (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('super_admin', 'client_admin')),
  tenant_id uuid references public.tenants(id) on delete set null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_tenant on public.profiles(tenant_id);
create index if not exists idx_profiles_role on public.profiles(role);

-- 3. CATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_tenant_sort on public.categories(tenant_id, sort_order);

-- 4. MENU ITEMS
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  ingredients text,
  price numeric(10,2) not null check (price >= 0),
  original_price numeric(10,2) check (original_price is null or original_price >= 0),
  image_url text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  badges text[] not null default '{}',
  sort_order integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menu_items_tenant_cat on public.menu_items(tenant_id, category_id, sort_order);
create index if not exists idx_menu_items_featured on public.menu_items(tenant_id, is_featured) where is_featured = true;

-- 5. SCHEDULED OFFERS
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  badge_text text not null default 'عرض خاص',
  discount_text text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_offers_tenant_active on public.offers(tenant_id, is_active, starts_at, ends_at);

-- 6. ELECTRONIC WALLETS
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  account_number text not null,
  account_name text,
  logo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallets_tenant_sort on public.wallets(tenant_id, sort_order);

-- 7. ANALYTICS EVENTS
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null check (event_type in ('menu_scan', 'item_view', 'order_submit')),
  item_id uuid references public.menu_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_tenant_created on public.analytics_events(tenant_id, created_at desc);
create index if not exists idx_analytics_type_created on public.analytics_events(event_type, created_at desc);

-- 8. AUDIT LOGS (Super Admin operations)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- 9. CONTACT MESSAGES (Service Requests)
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  business_name text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_messages_created on public.contact_messages(created_at desc);

-- 10. LOGIN RATE LIMITS
create table if not exists public.login_rate_limits (
  key text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

-- UPDATED_AT TRIGGER HELPER
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.handle_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at
before update on public.menu_items
for each row execute function public.handle_updated_at();

-- SECURITY DEFINER HELPERS FOR RLS (prevent recursion)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.my_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- SAFE RPC FOR CLIENT ADMIN TO UPDATE ONLY NON-IDENTITY CONTACT/DELIVERY FIELDS
create or replace function public.update_client_tenant_settings(
  p_story text,
  p_description text,
  p_address text,
  p_phone text,
  p_whatsapp text,
  p_instagram text,
  p_facebook text,
  p_tiktok text,
  p_has_delivery boolean,
  p_delivery_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid() and role = 'client_admin';

  if v_tenant_id is null then
    raise exception 'Unauthorized: only client_admin with an assigned tenant can update settings';
  end if;

  update public.tenants
  set
    story = p_story,
    description = p_description,
    address = p_address,
    phone = p_phone,
    whatsapp = p_whatsapp,
    instagram = p_instagram,
    facebook = p_facebook,
    tiktok = p_tiktok,
    has_delivery = coalesce(p_has_delivery, has_delivery),
    delivery_note = p_delivery_note
  where id = v_tenant_id;
end;
$$;

-- SAFE RPC TO RECORD PUBLIC ANALYTICS & INCREMENT ITEM VIEWS
create or replace function public.record_menu_event(
  p_tenant_id uuid,
  p_event_type text,
  p_item_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('menu_scan', 'item_view', 'order_submit') then
    raise exception 'Invalid event_type';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id and is_active = true) then
    return;
  end if;

  insert into public.analytics_events (tenant_id, event_type, item_id, metadata)
  values (p_tenant_id, p_event_type, p_item_id, coalesce(p_metadata, '{}'::jsonb));

  if p_event_type = 'item_view' and p_item_id is not null then
    update public.menu_items
    set views_count = views_count + 1
    where id = p_item_id and tenant_id = p_tenant_id;
  end if;
end;
$$;

-- ENABLE ROW LEVEL SECURITY ON EVERY TABLE
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.offers enable row level security;
alter table public.wallets enable row level security;
alter table public.analytics_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contact_messages enable row level security;
alter table public.login_rate_limits enable row level security;

-- TENANTS POLICIES
-- Public can read tenant display info (including suspended_message when paused)
create policy "tenants_public_read" on public.tenants
for select to anon, authenticated
using (true);

create policy "tenants_super_admin_insert" on public.tenants
for insert to authenticated
with check (public.is_super_admin());

create policy "tenants_super_admin_update" on public.tenants
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "tenants_super_admin_delete" on public.tenants
for delete to authenticated
using (public.is_super_admin());

-- PROFILES POLICIES
create policy "profiles_select_self_or_super" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_super_admin());

create policy "profiles_insert_super" on public.profiles
for insert to authenticated
with check (public.is_super_admin());

create policy "profiles_update_super" on public.profiles
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "profiles_delete_super" on public.profiles
for delete to authenticated
using (public.is_super_admin());

-- CATEGORIES POLICIES
create policy "categories_read" on public.categories
for select to anon, authenticated
using (
  public.is_super_admin()
  or tenant_id = public.my_tenant_id()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active = true)
);

create policy "categories_write" on public.categories
for all to authenticated
using (public.is_super_admin() or tenant_id = public.my_tenant_id())
with check (public.is_super_admin() or tenant_id = public.my_tenant_id());

-- MENU ITEMS POLICIES
create policy "menu_items_read" on public.menu_items
for select to anon, authenticated
using (
  public.is_super_admin()
  or tenant_id = public.my_tenant_id()
  or exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active = true)
);

create policy "menu_items_write" on public.menu_items
for all to authenticated
using (public.is_super_admin() or tenant_id = public.my_tenant_id())
with check (public.is_super_admin() or tenant_id = public.my_tenant_id());

-- OFFERS POLICIES
create policy "offers_read" on public.offers
for select to anon, authenticated
using (
  public.is_super_admin()
  or tenant_id = public.my_tenant_id()
  or (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active = true)
  )
);

create policy "offers_write" on public.offers
for all to authenticated
using (public.is_super_admin() or tenant_id = public.my_tenant_id())
with check (public.is_super_admin() or tenant_id = public.my_tenant_id());

-- WALLETS POLICIES
create policy "wallets_read" on public.wallets
for select to anon, authenticated
using (
  public.is_super_admin()
  or tenant_id = public.my_tenant_id()
  or (
    is_active = true
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active = true)
  )
);

create policy "wallets_write" on public.wallets
for all to authenticated
using (public.is_super_admin() or tenant_id = public.my_tenant_id())
with check (public.is_super_admin() or tenant_id = public.my_tenant_id());

-- ANALYTICS POLICIES
create policy "analytics_read_admin" on public.analytics_events
for select to authenticated
using (public.is_super_admin() or tenant_id = public.my_tenant_id());

create policy "analytics_insert_public" on public.analytics_events
for insert to anon, authenticated
with check (
  event_type in ('menu_scan', 'item_view', 'order_submit')
  and exists (select 1 from public.tenants t where t.id = tenant_id and t.is_active = true)
);

-- AUDIT LOGS POLICIES (Super Admin only)
create policy "audit_logs_super_only" on public.audit_logs
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- CONTACT MESSAGES POLICIES
create policy "contact_messages_public_insert" on public.contact_messages
for insert to anon, authenticated
with check (true);

create policy "contact_messages_super_manage" on public.contact_messages
for select to authenticated
using (public.is_super_admin());

create policy "contact_messages_super_update" on public.contact_messages
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "contact_messages_super_delete" on public.contact_messages
for delete to authenticated
using (public.is_super_admin());

-- STORAGE BUCKET FOR MEDIA
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menus-media',
  'menus-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- STORAGE RLS POLICIES
drop policy if exists "menus_media_public_read" on storage.objects;
create policy "menus_media_public_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'menus-media');

drop policy if exists "menus_media_admin_upload" on storage.objects;
create policy "menus_media_admin_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'menus-media'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.my_tenant_id()::text
  )
);

drop policy if exists "menus_media_admin_update" on storage.objects;
create policy "menus_media_admin_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'menus-media'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.my_tenant_id()::text
  )
);

drop policy if exists "menus_media_admin_delete" on storage.objects;
create policy "menus_media_admin_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'menus-media'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.my_tenant_id()::text
  )
);

-- GRANTS
grant usage on schema public to anon, authenticated;
grant select on public.tenants, public.categories, public.menu_items, public.offers, public.wallets to anon, authenticated;
grant insert, update, delete on public.categories, public.menu_items, public.offers, public.wallets to authenticated;
grant insert, update, delete on public.tenants, public.profiles, public.audit_logs to authenticated;
grant select on public.profiles, public.analytics_events, public.audit_logs, public.contact_messages to authenticated;
grant insert on public.analytics_events, public.contact_messages to anon, authenticated;
grant update, delete on public.contact_messages to authenticated;
grant execute on function public.update_client_tenant_settings(text,text,text,text,text,text,text,text,boolean,text) to authenticated;
grant execute on function public.record_menu_event(uuid,text,uuid,jsonb) to anon, authenticated;
