-- Read models the mobile screens need.

-- Earnings lines: a refunded call nets to zero on its own line, a rejected payout cancels its withdrawal.
create or replace view public.my_earnings as
select
  min(e.id) as id,
  case e.reason when 'clawback' then 'call_earning' when 'payout_reversal' then 'payout' else e.reason end as reason,
  e.ref_id,
  (array_agg(e.meta order by e.id))[1] as meta,
  sum(e.delta_paise)::bigint as paise,
  min(e.created_at) as created_at,
  max(e.available_at) as available_at
from public.earnings_ledger e
where e.host_id = auth.uid()
group by case e.reason when 'clawback' then 'call_earning' when 'payout_reversal' then 'payout' else e.reason end, e.ref_id,
  case when e.ref_id is null then e.id end;

-- People I blocked, with the name and avatar to show in Settings → Blocked.
create view public.my_blocks as
select b.blocked_id as id, p.display_name as name, p.avatar_key, p.role, b.created_at
from public.blocks b join public.profiles p on p.id = b.blocked_id
where b.blocker_id = auth.uid();

-- My own profile with KYC/payout summary (hosts) for the app's settings and earnings screens.
create view public.my_host as
select h.*, hp.payout_kind, hp.upi_id,
  case when hp.bank_account is not null then right(hp.bank_account, 4) end as bank_last4,
  s.rating_avg, s.rating_count, s.calls30d, s.avg_call_minutes, s.answer_rate, s.repeat_caller_rate, s.report_rate, s.active_days, s.total_calls,
  coalesce((select sum(extract(epoch from ended_at - started_at) / 60) from public.call_sessions c
    where c.host_id = h.id and c.started_at is not null and c.created_at > now() - interval '30 days'), 0)::int as minutes30d
from public.hosts h
left join public.host_private hp on hp.host_id = h.id
join public.host_stats s on s.host_id = h.id
where h.id = auth.uid();

revoke select on public.my_earnings, public.my_blocks, public.my_host from anon;
grant select on public.my_earnings, public.my_blocks, public.my_host to authenticated;
