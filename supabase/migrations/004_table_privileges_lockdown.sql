-- ============================================================================
-- MENUZ (مينوز) Phase 1: Explicit Table-Level Least Privilege Lockdown
-- Revokes unnecessary default DDL/write grants from anon & authenticated.
-- ============================================================================

revoke all on public.login_rate_limits from public, anon, authenticated;

revoke all on public.audit_logs from public, anon;
revoke truncate, trigger, references on public.audit_logs from authenticated;

revoke all on public.analytics_events from public, anon;
revoke insert, update, delete, truncate, trigger, references on public.analytics_events from authenticated;

revoke all on public.contact_messages from public, anon;
revoke insert, truncate, trigger, references on public.contact_messages from authenticated;

revoke all on public.profiles from public, anon;
revoke truncate, trigger, references on public.profiles from authenticated;

revoke insert, update, delete, truncate, trigger, references on public.tenants from anon;
revoke truncate, trigger, references on public.tenants from authenticated;

revoke insert, update, delete, truncate, trigger, references on public.notifications from anon;
revoke truncate, trigger, references on public.notifications from authenticated;

revoke insert, update, delete, truncate, trigger, references on public.categories from anon;
revoke insert, update, delete, truncate, trigger, references on public.menu_items from anon;
revoke insert, update, delete, truncate, trigger, references on public.offers from anon;
revoke insert, update, delete, truncate, trigger, references on public.wallets from anon;
