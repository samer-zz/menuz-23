-- ============================================================================
-- MENUZ v4.1 Notification Push Delivery Tracking & Non-Duplicating Retry State
-- ============================================================================

alter table public.notifications
  add column if not exists push_status text not null default 'pending'
    check (push_status in ('pending', 'sent', 'partial', 'failed', 'vapid_not_configured', 'no_subscribers')),
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_last_error text,
  add column if not exists push_last_attempt_at timestamptz,
  add column if not exists push_sent_at timestamptz;

-- Backfill pre-existing notifications accurately without falsely marking unsent ones as sent
update public.notifications
set
  push_status = case when push_sent = true then 'sent' else 'no_subscribers' end,
  push_sent_at = case when push_sent = true then coalesce(push_sent_at, created_at) else null end
where push_status = 'pending'
  and (scheduled_for is null or scheduled_for <= now());

create index if not exists idx_notifications_due_push
  on public.notifications (push_status, scheduled_for, expires_at);

-- Tracks per-subscription delivery for a notification so partial-failure retries
-- never send duplicate pushes to already-delivered subscribers.
create table if not exists public.notification_push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null check (status in ('sent', 'failed')),
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (notification_id, subscription_id)
);

alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from public, anon, authenticated;
