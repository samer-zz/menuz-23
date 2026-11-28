-- ============================================================================
-- MENUZ v4 Platform Hardening, Atomic Orders, Private Super-Admin Feedback,
-- Dynamic Tenant Theme Colors, Web Push Subscriptions & Batch Maintenance
-- ============================================================================

-- 1. Enforce server-only uploads & 4MiB cap in menus-media Storage bucket
update storage.buckets
set
  file_size_limit = 4194304, -- 4 MiB aligned with Vercel Hobby Serverless limit
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'menus-media';

drop policy if exists "menus_media_admin_upload" on storage.objects;
drop policy if exists "menus_media_admin_update" on storage.objects;
drop policy if exists "menus_media_admin_delete" on storage.objects;
-- Only service_role (via verified /api/media/upload server route) can insert/update/delete;
-- public read remains enabled via "menus_media_public_read".

-- 2. Extend tenants with optional dynamic theme color fields
alter table public.tenants
  add column if not exists background_color text,
  add column if not exists card_color text,
  add column if not exists text_color text,
  add column if not exists button_text_color text;

grant select (
  background_color,
  card_color,
  text_color,
  button_text_color
) on public.tenants to anon;

-- Safe RPC allowing client_admin to customize ONLY their own tenant appearance
create or replace function public.update_client_tenant_appearance(
  p_primary_color text,
  p_accent_color text,
  p_background_color text default null,
  p_card_color text default null,
  p_text_color text default null,
  p_button_text_color text default null
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
    raise exception 'Unauthorized: only client_admin with an assigned tenant can update appearance';
  end if;

  if coalesce(p_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$'
     or coalesce(p_accent_color, '') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid primary or accent hex color';
  end if;

  if (p_background_color is not null and btrim(p_background_color) <> '' and p_background_color !~ '^#[0-9A-Fa-f]{6}$')
     or (p_card_color is not null and btrim(p_card_color) <> '' and p_card_color !~ '^#[0-9A-Fa-f]{6}$')
     or (p_text_color is not null and btrim(p_text_color) <> '' and p_text_color !~ '^#[0-9A-Fa-f]{6}$')
     or (p_button_text_color is not null and btrim(p_button_text_color) <> '' and p_button_text_color !~ '^#[0-9A-Fa-f]{6}$') then
    raise exception 'Invalid optional theme hex color';
  end if;

  update public.tenants
  set
    primary_color = upper(p_primary_color),
    accent_color = upper(p_accent_color),
    background_color = nullif(upper(btrim(coalesce(p_background_color, ''))), ''),
    card_color = nullif(upper(btrim(coalesce(p_card_color, ''))), ''),
    text_color = nullif(upper(btrim(coalesce(p_text_color, ''))), ''),
    button_text_color = nullif(upper(btrim(coalesce(p_button_text_color, ''))), '')
  where id = v_tenant_id;
end;
$$;

revoke all on function public.update_client_tenant_appearance(text,text,text,text,text,text) from public, anon;
grant execute on function public.update_client_tenant_appearance(text,text,text,text,text,text) to authenticated;

-- 3. Server-verified Orders table (prevents price tampering, duplicate submits & history loss)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  tenant_name_snapshot text,
  order_number text not null,
  idempotency_key text not null,
  payload_hash text not null,
  feedback_token_hash text,
  customer_name text,
  customer_phone text,
  order_type text not null check (order_type in ('delivery', 'pickup')),
  delivery_address text,
  payment_method text not null check (payment_method in ('cash', 'wallet')),
  wallet_name text,
  transaction_ref text,
  notes text,
  items_snapshot jsonb not null default '[]'::jsonb,
  computed_total numeric(12, 2) not null check (computed_total >= 0),
  currency text not null default 'ر.ي',
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'direct')),
  status text not null default 'sent' check (status in ('sent', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint uq_orders_tenant_idempotency unique (tenant_id, idempotency_key)
);

create index if not exists idx_orders_tenant_created
  on public.orders (tenant_id, created_at desc);

alter table public.orders enable row level security;
revoke all on public.orders from public, anon, authenticated;
-- Least privilege: authenticated admins can only SELECT orders; status changes go through update_tenant_order_status RPC
grant select on public.orders to authenticated;

drop policy if exists "orders_tenant_read" on public.orders;
create policy "orders_tenant_read" on public.orders
for select to authenticated
using (
  public.is_super_admin()
  or (tenant_id is not null and tenant_id = public.my_tenant_id())
);

drop policy if exists "orders_tenant_update" on public.orders;

-- Safe RPC for atomic order creation + payload conflict detection + analytics event
create or replace function public.create_order_atomic(
  p_tenant_id uuid,
  p_tenant_name_snapshot text,
  p_order_number text,
  p_idempotency_key text,
  p_payload_hash text,
  p_feedback_token_hash text,
  p_customer_name text,
  p_customer_phone text,
  p_order_type text,
  p_delivery_address text,
  p_payment_method text,
  p_wallet_name text,
  p_transaction_ref text,
  p_notes text,
  p_items_snapshot jsonb,
  p_computed_total numeric,
  p_currency text,
  p_channel text,
  p_items_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders%rowtype;
  v_inserted_id uuid;
  v_inserted_number text;
begin
  insert into public.orders (
    tenant_id,
    tenant_name_snapshot,
    order_number,
    idempotency_key,
    payload_hash,
    feedback_token_hash,
    customer_name,
    customer_phone,
    order_type,
    delivery_address,
    payment_method,
    wallet_name,
    transaction_ref,
    notes,
    items_snapshot,
    computed_total,
    currency,
    channel
  )
  values (
    p_tenant_id,
    p_tenant_name_snapshot,
    p_order_number,
    p_idempotency_key,
    p_payload_hash,
    p_feedback_token_hash,
    nullif(p_customer_name, ''),
    nullif(p_customer_phone, ''),
    p_order_type,
    nullif(p_delivery_address, ''),
    p_payment_method,
    nullif(p_wallet_name, ''),
    nullif(p_transaction_ref, ''),
    nullif(p_notes, ''),
    p_items_snapshot,
    p_computed_total,
    p_currency,
    p_channel
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id, order_number into v_inserted_id, v_inserted_number;

  if v_inserted_id is not null then
    perform public.record_menu_event(
      p_tenant_id,
      'order_submit',
      null,
      jsonb_build_object(
        'channel', case when p_channel = 'direct' then 'whatsapp' else p_channel end,
        'total', p_computed_total,
        'items_count', p_items_count,
        'payment_method', p_payment_method
      )
    );

    return jsonb_build_object(
      'outcome', 'created',
      'order_id', v_inserted_id,
      'order_number', v_inserted_number,
      'computed_total', p_computed_total,
      'currency', p_currency,
      'items_snapshot', p_items_snapshot
    );
  end if;

  select * into v_existing
  from public.orders
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key;

  if not found then
    raise exception 'Order idempotency lookup failed';
  end if;

  if v_existing.payload_hash <> p_payload_hash then
    return jsonb_build_object(
      'outcome', 'conflict',
      'order_id', v_existing.id,
      'order_number', v_existing.order_number
    );
  end if;

  return jsonb_build_object(
    'outcome', 'duplicate',
    'order_id', v_existing.id,
    'order_number', v_existing.order_number,
    'computed_total', v_existing.computed_total,
    'currency', v_existing.currency,
    'items_snapshot', v_existing.items_snapshot
  );
end;
$$;

revoke all on function public.create_order_atomic(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,numeric,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_order_atomic(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,numeric,text,text,integer) to service_role;

-- Safe RPC for order status progression (prevents column tampering & invalid state jumps)
create or replace function public.update_tenant_order_status(
  p_order_id uuid,
  p_new_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_new_status not in ('sent', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Invalid order status';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (public.is_super_admin() or (v_order.tenant_id is not null and v_order.tenant_id = public.my_tenant_id())) then
    raise exception 'Unauthorized order status update';
  end if;

  if v_order.status = p_new_status then
    return v_order.status;
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'Cannot transition terminal order status';
  end if;

  if v_order.status = 'sent' and p_new_status not in ('confirmed', 'cancelled') then
    raise exception 'Invalid transition from sent';
  end if;

  if v_order.status = 'confirmed' and p_new_status not in ('completed', 'cancelled') then
    raise exception 'Invalid transition from confirmed';
  end if;

  update public.orders
  set status = p_new_status
  where id = p_order_id;

  return p_new_status;
end;
$$;

revoke all on function public.update_tenant_order_status(uuid,text) from public, anon;
grant execute on function public.update_tenant_order_status(uuid,text) to authenticated;

-- 4. Order Experience Feedback table — STRICTLY visible to Super Admin ONLY!
--    One feedback per verified order; client_admin & anon are denied at both privilege and RLS layers.
create table if not exists public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  constraint uq_order_feedback_order unique (order_id)
);

create index if not exists idx_order_feedback_created
  on public.order_feedback (created_at desc);
create index if not exists idx_order_feedback_tenant
  on public.order_feedback (tenant_id, created_at desc);

alter table public.order_feedback enable row level security;
revoke all on public.order_feedback from public, anon, authenticated;
grant select, delete on public.order_feedback to authenticated;

drop policy if exists "order_feedback_super_admin_only_select" on public.order_feedback;
create policy "order_feedback_super_admin_only_select" on public.order_feedback
for select to authenticated
using (public.is_super_admin());

drop policy if exists "order_feedback_super_admin_only_delete" on public.order_feedback;
create policy "order_feedback_super_admin_only_delete" on public.order_feedback
for delete to authenticated
using (public.is_super_admin());

-- 5. Web Push Subscriptions table (server-managed only via service_role)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint uq_push_tenant_endpoint unique (tenant_id, endpoint)
);

create index if not exists idx_push_tenant_active
  on public.push_subscriptions (tenant_id, is_active);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;

-- 6. Notification scheduling & push tracking fields
alter table public.notifications
  add column if not exists scheduled_for timestamptz,
  add column if not exists push_sent boolean not null default false;

drop policy if exists "Public reads active non-expired notifications" on public.notifications;
create policy "Public reads active non-expired notifications" on public.notifications
for select to anon, authenticated
using (
  expires_at > now()
  and (scheduled_for is null or scheduled_for <= now())
);

-- 7. Batched, retention-safe maintenance cleanup (service_role only)
create or replace function public.run_maintenance_cleanup(p_batch_limit integer default 1000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(100, least(coalesce(p_batch_limit, 1000), 5000));
  v_notifs integer := 0;
  v_api_rl integer := 0;
  v_login_rl integer := 0;
  v_analytics integer := 0;
  v_push_stale integer := 0;
begin
  with doomed as (
    select id from public.notifications
    where expires_at <= now()
    order by expires_at asc
    limit v_limit
  )
  delete from public.notifications n using doomed where n.id = doomed.id;
  get diagnostics v_notifs = row_count;

  with doomed as (
    select key from public.api_rate_limits
    where window_start < now() - interval '2 hours'
    order by window_start asc
    limit v_limit
  )
  delete from public.api_rate_limits a using doomed where a.key = doomed.key;
  get diagnostics v_api_rl = row_count;

  with doomed as (
    select key from public.login_rate_limits
    where window_start < now() - interval '24 hours'
      and (locked_until is null or locked_until < now())
    order by window_start asc
    limit v_limit
  )
  delete from public.login_rate_limits l using doomed where l.key = doomed.key;
  get diagnostics v_login_rl = row_count;

  -- Keep 180 days of analytics events for seasonal reports; prune older batches safely
  with doomed as (
    select id from public.analytics_events
    where created_at < now() - interval '180 days'
    order by created_at asc
    limit v_limit
  )
  delete from public.analytics_events e using doomed where e.id = doomed.id;
  get diagnostics v_analytics = row_count;

  -- Prune stale/inactive push subscriptions older than 90 days
  with doomed as (
    select id from public.push_subscriptions
    where is_active = false
      and coalesce(last_used_at, created_at) < now() - interval '90 days'
    order by created_at asc
    limit v_limit
  )
  delete from public.push_subscriptions p using doomed where p.id = doomed.id;
  get diagnostics v_push_stale = row_count;

  return jsonb_build_object(
    'notifications_deleted', v_notifs,
    'api_rate_limits_deleted', v_api_rl,
    'login_rate_limits_deleted', v_login_rl,
    'analytics_events_deleted', v_analytics,
    'push_subscriptions_deleted', v_push_stale,
    'batch_limit', v_limit
  );
end;
$$;

revoke all on function public.run_maintenance_cleanup(integer) from public, anon, authenticated;
grant execute on function public.run_maintenance_cleanup(integer) to service_role;
