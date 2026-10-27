-- Who may call what, which tables stream changes, and the scheduled jobs.

-- Internal helpers are never callable from the apps.
revoke execute on function public._apply_coins(uuid, bigint, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public._earn(uuid, bigint, text, text, text, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public._audit(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._charge_minute(uuid, int) from public, anon, authenticated;
revoke execute on function public._end_call(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public._require_admin() from public, anon, authenticated;
revoke execute on function public.reap() from public, anon, authenticated;
revoke execute on function public.recompute_levels() from public, anon, authenticated;

-- Signed-out visitors get nothing.
revoke execute on all functions in schema public from anon;
revoke select on public.host_stats, public.public_hosts, public.public_reviews, public.my_calls, public.my_earnings from anon;
grant select on public.host_stats, public.public_hosts, public.public_reviews, public.my_calls, public.my_earnings to authenticated;

-- Live updates: presence, calls (ringing / accepted / ended), wallets, earnings, payouts,
-- reviews, reports and audit entries. Each subscriber only receives rows its RLS lets it read.
alter publication supabase_realtime add table
  public.hosts, public.call_sessions, public.wallets, public.earnings_ledger, public.payout_requests,
  public.ratings, public.reports, public.profiles, public.app_config, public.purchases, public.audit_log, public.gift_events;

-- Updates carry the full row so subscribers can filter on any column.
alter table public.call_sessions replica identity full;
alter table public.hosts replica identity full;

create extension if not exists pg_cron;
select cron.schedule('reap-calls-and-presence', '* * * * *', 'select public.reap()');
select cron.schedule('recompute-host-levels', '30 20 * * *', 'select public.recompute_levels()'); -- 02:00 IST
