-- ============================================================================
-- MENUZ (مينوز) Phase 1: Security & Database Hardening
-- Non-destructive migration preserving all existing tables, rows, and features.
-- ============================================================================

-- 1. Restrict public tenants read policy + anon column exposure
drop policy if exists "tenants_public_read" on public.tenants;
create policy "tenants_public_read" on public.tenants
for select to anon, authenticated
using (
  is_active = true
  or public.is_super_admin()
  or id = public.my_tenant_id()
);

revoke select on public.tenants from anon;
grant select (
  id,
  slug,
  name_ar,
  name_en,
  story,
  description,
  address,
  phone,
  whatsapp,
  instagram,
  facebook,
  tiktok,
  has_delivery,
  delivery_note,
  logo_url,
  cover_url,
  primary_color,
  accent_color,
  currency,
  is_active,
  is_demo
) on public.tenants to anon;

-- 2. Close direct anon/authenticated INSERT into analytics_events & contact_messages
--    (All public writes must pass through Next.js API routes with Origin/CSRF + Zod + Rate Limiting)
drop policy if exists "analytics_insert_public" on public.analytics_events;
revoke insert on public.analytics_events from anon, authenticated;

drop policy if exists "contact_messages_public_insert" on public.contact_messages;
revoke insert on public.contact_messages from anon, authenticated;

-- 3. Harden record_menu_event (strict item ownership + metadata size cap + service_role only)
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
declare
  v_safe_meta jsonb;
begin
  if p_event_type not in ('menu_scan', 'item_view', 'order_submit') then
    raise exception 'Invalid event_type';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id and is_active = true) then
    return;
  end if;

  if p_item_id is not null and not exists (
    select 1 from public.menu_items where id = p_item_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Invalid item_id for tenant';
  end if;

  v_safe_meta := coalesce(p_metadata, '{}'::jsonb);
  if jsonb_typeof(v_safe_meta) <> 'object' or pg_column_size(v_safe_meta) > 512 then
    raise exception 'Invalid or oversized metadata';
  end if;

  insert into public.analytics_events (tenant_id, event_type, item_id, metadata)
  values (p_tenant_id, p_event_type, p_item_id, v_safe_meta);

  if p_event_type = 'item_view' and p_item_id is not null then
    update public.menu_items
    set views_count = views_count + 1
    where id = p_item_id and tenant_id = p_tenant_id;
  end if;
end;
$$;

revoke all on function public.record_menu_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_menu_event(uuid, text, uuid, jsonb) to service_role;

-- 4. Restrict cleanup_expired_notifications() to service_role only & also prune expired rate limits
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

  -- Clean stale login rate limit rows older than 24h without an active lock
  delete from public.login_rate_limits
  where window_start < now() - interval '24 hours'
    and (locked_until is null or locked_until < now());

  -- Clean stale API rate limit rows older than 2 hours
  if to_regclass('public.api_rate_limits') is not null then
    delete from public.api_rate_limits
    where window_start < now() - interval '2 hours';
  end if;

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_notifications() from public, anon, authenticated;
grant execute on function public.cleanup_expired_notifications() to service_role;

-- 5. Restrict update_client_tenant_settings to authenticated + validate length & dangerous schemes
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

  if coalesce(char_length(p_story), 0) > 1500
     or coalesce(char_length(p_description), 0) > 600
     or coalesce(char_length(p_address), 0) > 300
     or coalesce(char_length(p_phone), 0) > 30
     or coalesce(char_length(p_whatsapp), 0) > 30
     or coalesce(char_length(p_instagram), 0) > 250
     or coalesce(char_length(p_facebook), 0) > 250
     or coalesce(char_length(p_tiktok), 0) > 250
     or coalesce(char_length(p_delivery_note), 0) > 300 then
    raise exception 'Input exceeds maximum allowed length';
  end if;

  if coalesce(p_instagram, '') ~* '^(javascript|data|vbscript):'
     or coalesce(p_facebook, '') ~* '^(javascript|data|vbscript):'
     or coalesce(p_tiktok, '') ~* '^(javascript|data|vbscript):' then
    raise exception 'Invalid URL scheme';
  end if;

  update public.tenants
  set
    story = nullif(btrim(p_story), ''),
    description = nullif(btrim(p_description), ''),
    address = nullif(btrim(p_address), ''),
    phone = nullif(btrim(p_phone), ''),
    whatsapp = nullif(btrim(p_whatsapp), ''),
    instagram = nullif(btrim(p_instagram), ''),
    facebook = nullif(btrim(p_facebook), ''),
    tiktok = nullif(btrim(p_tiktok), ''),
    has_delivery = coalesce(p_has_delivery, has_delivery),
    delivery_note = nullif(btrim(p_delivery_note), '')
  where id = v_tenant_id;
end;
$$;

revoke all on function public.update_client_tenant_settings(text,text,text,text,text,text,text,text,boolean,text) from public, anon;
grant execute on function public.update_client_tenant_settings(text,text,text,text,text,text,text,text,boolean,text) to authenticated;

-- 6. Server-side API rate limiting table & RPC (service_role only)
create table if not exists public.api_rate_limits (
  key text primary key,
  hits integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.check_api_rate_limit(
  p_key text,
  p_max_hits integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_key is null or char_length(p_key) = 0 or p_max_hits <= 0 or p_window_seconds <= 0 then
    return false;
  end if;

  insert into public.api_rate_limits (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits = case
      when api_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        then 1
      else api_rate_limits.hits + 1
    end,
    window_start = case
      when api_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
        then now()
      else api_rate_limits.window_start
    end
  returning hits into v_hits;

  return v_hits <= p_max_hits;
end;
$$;

revoke all on function public.check_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, integer, integer) to service_role;

-- 7. Remove image/svg+xml from menus-media bucket to prevent Stored XSS via SVG
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'menus-media';

-- 8. Safe length constraints on notifications & contact_messages
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_notifications_lengths'
  ) then
    alter table public.notifications
      add constraint chk_notifications_lengths
      check (char_length(title) between 1 and 160 and char_length(body) between 1 and 1000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_contact_messages_lengths'
  ) then
    alter table public.contact_messages
      add constraint chk_contact_messages_lengths
      check (
        char_length(name) between 1 and 150
        and char_length(phone) between 5 and 30
        and char_length(message) between 1 and 2000
      );
  end if;
end $$;
