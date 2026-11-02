-- Security hardening (audit of 2 Nov 2026).
--  1. Deny by default: apps get SELECT (filtered by row level security) and EXECUTE on the public
--     functions only. Nobody signed out can read or call anything.
--  2. Only members (a phone-verified profile that is active) see hosts, reviews and stats.
--  3. Every text input has a length limit; calls and reports are rate limited.
--  4. Policies use `(select auth.uid())` so it is evaluated once per query, not per row.

-- ───────── 1. Privileges ─────────

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.app_config, public.coin_packs, public.gifts, public.profiles, public.hosts, public.host_private,
  public.host_active_days, public.wallets, public.coin_ledger, public.purchases, public.earnings_ledger, public.payout_requests,
  public.call_sessions, public.gift_events, public.ratings, public.reports, public.blocks, public.favorites, public.audit_log
  to authenticated;
grant insert, delete on public.blocks, public.favorites to authenticated;
grant select on public.host_stats, public.public_hosts, public.public_reviews, public.my_calls, public.my_earnings,
  public.my_blocks, public.my_host to authenticated;

alter function public._join(text[]) set search_path = '';

-- ───────── 2. Who counts as a member ─────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- A caller or host with an active, phone-verified profile (complete_profile requires the phone).
create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('user', 'host') and status = 'active');
$$;

-- Server code (cron jobs, Edge Functions, security-definer functions) runs as a trusted role and sees everything.
create function public._trusted() returns boolean language sql stable set search_path = '' as $$
  select current_user not in ('anon', 'authenticated');
$$;

-- These views run with their owner's rights so callers can see a host's public name and stats
-- without reading the profiles table. Each one filters to what the person may see.
create or replace view public.host_stats as
select
  h.id as host_id,
  coalesce(r.avg_stars, 0)::float8 as rating_avg,
  coalesce(r.n, 0)::int as rating_count,
  coalesce(c.connected, 0)::int as calls30d,
  coalesce(c.avg_min, 0)::float8 as avg_call_minutes,
  case when coalesce(c.rung, 0) = 0 then 1 else c.connected::float8 / c.rung end as answer_rate,
  coalesce(rep.repeat_rate, 0)::float8 as repeat_caller_rate,
  coalesce(rp.upheld, 0)::float8 / greatest(coalesce(c.connected, 0), 1) as report_rate,
  coalesce(d.days, 0)::int as active_days,
  coalesce(t.total, 0)::int as total_calls,
  coalesce(t.minutes, 0)::int as total_minutes
from public.hosts h
left join lateral (select avg(stars) as avg_stars, count(*) as n from public.ratings where host_id = h.id and not hidden) r on true
left join lateral (
  select
    count(*) filter (where started_at is not null) as connected,
    count(*) filter (where state not in ('cancelled', 'ringing')) as rung,
    avg(extract(epoch from ended_at - started_at) / 60) filter (where started_at is not null and ended_at is not null) as avg_min
  from public.call_sessions where host_id = h.id and created_at > now() - interval '30 days'
) c on true
left join lateral (
  select avg((n >= 2)::int)::float8 as repeat_rate
  from (select caller_id, count(*) as n from public.call_sessions where host_id = h.id and started_at is not null and created_at > now() - interval '30 days' group by caller_id) x
) rep on true
left join lateral (select count(*) as upheld from public.reports where target_id = h.id and status = 'actioned' and created_at > now() - interval '30 days') rp on true
left join lateral (select count(*) as days from public.host_active_days where host_id = h.id and day > current_date - 30) d on true
left join lateral (
  select count(*) as total, sum(extract(epoch from ended_at - started_at) / 60) as minutes
  from public.call_sessions where host_id = h.id and started_at is not null
) t on true
where (select public._trusted()) or (select public.is_admin()) or h.id = (select auth.uid())
  or (h.approval_status = 'approved' and (select public.is_member()));

create or replace view public.public_hosts as
select
  h.id,
  p.display_name as name,
  extract(year from age(p.date_of_birth))::int as age,
  h.city,
  h.bio,
  p.languages,
  p.avatar_key,
  coalesce(h.level_override, h.level)::int as level,
  h.presence,
  h.featured,
  h.strikes,
  coalesce(h.audio_rate, c.audio_rate) as audio_rate,
  coalesce(h.video_rate, c.video_rate) as video_rate,
  s.rating_avg, s.rating_count, s.calls30d, s.avg_call_minutes, s.answer_rate, s.repeat_caller_rate, s.report_rate, s.active_days, s.total_calls,
  h.created_at
from public.hosts h
join public.profiles p on p.id = h.id
cross join public.app_config c
join public.host_stats s on s.host_id = h.id
where h.approval_status = 'approved' and p.status = 'active'
  and ((select public._trusted()) or (select public.is_member()) or (select public.is_admin()));

create or replace view public.public_reviews as
select r.session_id as id, r.host_id, p.display_name as author, p.avatar_key, r.stars, r.tags, coalesce(r.comment, '') as comment, r.created_at
from public.ratings r join public.profiles p on p.id = r.rater_id
where not r.hidden and ((select public._trusted()) or (select public.is_member()) or (select public.is_admin()));

-- ───────── 3. Policies (evaluated once per query) ─────────

drop policy "audit admins" on public.audit_log;
create policy "audit admins" on public.audit_log for select to authenticated using ((select public.is_admin()));

drop policy "own blocks read" on public.blocks;
drop policy "own blocks add" on public.blocks;
drop policy "own blocks remove" on public.blocks;
create policy "own blocks read" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()) or (select public.is_admin()));
create policy "own blocks add" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()) and blocked_id <> (select auth.uid()));
create policy "own blocks remove" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy "own favorites read" on public.favorites;
drop policy "own favorites add" on public.favorites;
drop policy "own favorites remove" on public.favorites;
create policy "own favorites read" on public.favorites for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "own favorites add" on public.favorites for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_member()));
create policy "own favorites remove" on public.favorites for delete to authenticated using (user_id = (select auth.uid()));

-- Phones register through register_device(); nobody reads or writes tokens directly.
drop policy "own tokens" on public.device_tokens;

drop policy "call parties" on public.call_sessions;
create policy "call parties" on public.call_sessions for select to authenticated
  using (caller_id = (select auth.uid()) or host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own coin ledger" on public.coin_ledger;
create policy "own coin ledger" on public.coin_ledger for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own earnings" on public.earnings_ledger;
create policy "own earnings" on public.earnings_ledger for select to authenticated using (host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "gift parties" on public.gift_events;
create policy "gift parties" on public.gift_events for select to authenticated
  using (from_user = (select auth.uid()) or to_host = (select auth.uid()) or (select public.is_admin()));
drop policy "own active days" on public.host_active_days;
create policy "own active days" on public.host_active_days for select to authenticated using (host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own kyc" on public.host_private;
create policy "own kyc" on public.host_private for select to authenticated using (host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "hosts readable" on public.hosts;
create policy "hosts readable" on public.hosts for select to authenticated
  using ((approval_status = 'approved' and (select public.is_member())) or id = (select auth.uid()) or (select public.is_admin()));
drop policy "own payouts" on public.payout_requests;
create policy "own payouts" on public.payout_requests for select to authenticated using (host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
drop policy "own purchases" on public.purchases;
create policy "own purchases" on public.purchases for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy "rating parties" on public.ratings;
create policy "rating parties" on public.ratings for select to authenticated
  using (rater_id = (select auth.uid()) or host_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own reports" on public.reports;
create policy "own reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
drop policy "own wallet" on public.wallets;
create policy "own wallet" on public.wallets for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ───────── 4. Input checks and rate limits ─────────

create function public._valid_langs(p text[]) returns boolean language sql immutable set search_path = '' as $$
  select p is null or (cardinality(p) <= 8 and p <@ array['hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr', 'en']);
$$;

create function public._valid_key(p text) returns boolean language sql immutable set search_path = '' as $$
  select p is null or p ~ '^[a-z0-9_-]{1,32}$';
$$;

create or replace function public.complete_profile(p_display_name text, p_gender text, p_dob date, p_avatar_key text, p_languages text[], p_ui_language text, p_consent_version text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_role text;
  v_phone text;
  prof profiles;
  trial int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'profile_exists'; end if;
  if p_dob is null or p_dob > (current_date - interval '18 years')::date or p_dob < date '1920-01-01' then raise exception 'under_18'; end if;
  if length(trim(coalesce(p_display_name, ''))) not between 2 and 30 then raise exception 'invalid_name'; end if;
  if p_gender not in ('male', 'female', 'other') then raise exception 'invalid_gender'; end if;
  if not _valid_key(p_avatar_key) or not _valid_langs(p_languages) or not _valid_langs(array[p_ui_language]) or length(coalesce(p_consent_version, '')) > 20 then
    raise exception 'bad_request';
  end if;
  -- Only phone-verified logins become members (email sign-ups can't collect welcome coins).
  select phone into v_phone from auth.users where id = uid and phone_confirmed_at is not null;
  if coalesce(v_phone, '') = '' then raise exception 'phone_required'; end if;
  v_role := case when p_gender = 'female' then 'host' else 'user' end;
  insert into profiles (id, role, phone, display_name, gender, date_of_birth, avatar_key, languages, ui_language, consent_at, consent_version)
  values (uid, v_role, v_phone, trim(p_display_name), p_gender, p_dob, p_avatar_key, coalesce(p_languages, '{}'), coalesce(p_ui_language, 'en'), now(), p_consent_version)
  returning * into prof;
  insert into wallets (user_id) values (uid);
  if v_role = 'user' then
    select trial_coins into trial from app_config;
    if trial > 0 then perform _apply_coins(uid, trial, 'signup_trial', 'signup:' || uid, null, null, 'Welcome coins'); end if;
  end if;
  return prof;
end $$;

create or replace function public.update_my_profile(p_display_name text default null, p_avatar_key text default null, p_languages text[] default null, p_ui_language text default null,
  p_notify_calls boolean default null, p_notify_offers boolean default null, p_notify_favorites boolean default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare prof profiles;
begin
  if p_display_name is not null and length(trim(p_display_name)) not between 2 and 30 then raise exception 'invalid_name'; end if;
  if not _valid_key(p_avatar_key) or not _valid_langs(p_languages) or (p_ui_language is not null and not _valid_langs(array[p_ui_language])) then
    raise exception 'bad_request';
  end if;
  update profiles set
    display_name = coalesce(trim(p_display_name), display_name),
    avatar_key = coalesce(p_avatar_key, avatar_key),
    languages = coalesce(p_languages, languages),
    ui_language = coalesce(p_ui_language, ui_language),
    notify_calls = coalesce(p_notify_calls, notify_calls),
    notify_offers = coalesce(p_notify_offers, notify_offers),
    notify_favorites = coalesce(p_notify_favorites, notify_favorites),
    last_active_at = now()
  where id = auth.uid() and status = 'active' returning * into prof;
  if not found then raise exception 'no_profile'; end if;
  return prof;
end $$;

create or replace function public.submit_host_application(p_display_name text, p_bio text, p_city text, p_languages text[], p_pan text, p_aadhaar_last4 text,
  p_payout_kind text, p_upi_id text, p_bank_account text, p_bank_ifsc text, p_selfie_done boolean)
returns public.hosts language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h hosts;
begin
  if not exists (select 1 from profiles where id = uid and role = 'host' and status = 'active') then raise exception 'not_allowed'; end if;
  if exists (select 1 from hosts where id = uid and approval_status = 'approved') then raise exception 'already_approved'; end if;
  if p_display_name is not null and length(trim(p_display_name)) > 30 then raise exception 'invalid_name'; end if;
  if length(trim(coalesce(p_bio, ''))) not between 20 and 300 then raise exception 'bio_too_short'; end if;
  if length(trim(coalesce(p_city, ''))) > 60 or not _valid_langs(p_languages) then raise exception 'bad_request'; end if;
  if upper(coalesce(p_pan, '')) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'invalid_pan'; end if;
  if coalesce(p_aadhaar_last4, '') !~ '^[0-9]{4}$' then raise exception 'invalid_aadhaar'; end if;
  if p_payout_kind not in ('upi', 'bank') then raise exception 'bad_request'; end if;
  if p_payout_kind = 'upi' and coalesce(p_upi_id, '') !~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$' then raise exception 'invalid_upi'; end if;
  if p_payout_kind = 'bank' and (coalesce(p_bank_account, '') !~ '^[0-9]{9,18}$' or upper(coalesce(p_bank_ifsc, '')) !~ '^[A-Z]{4}0[A-Z0-9]{6}$') then raise exception 'invalid_bank'; end if;
  if not coalesce(p_selfie_done, false) then raise exception 'selfie_required'; end if;

  update profiles set display_name = coalesce(nullif(trim(p_display_name), ''), display_name), languages = coalesce(p_languages, languages) where id = uid;
  insert into hosts (id, bio, city, approval_status, submitted_at, decision_note, decided_at)
  values (uid, trim(p_bio), trim(coalesce(p_city, '')), 'pending', now(), null, null)
  on conflict (id) do update set bio = excluded.bio, city = excluded.city, approval_status = 'pending', submitted_at = now(), decision_note = null, decided_at = null
  returning * into h;
  insert into host_private (host_id, pan, aadhaar_last4, selfie_done, payout_kind, upi_id, bank_account, bank_ifsc, agreed_at)
  values (uid, upper(p_pan), p_aadhaar_last4, true, p_payout_kind,
    case when p_payout_kind = 'upi' then lower(p_upi_id) end,
    case when p_payout_kind = 'bank' then p_bank_account end,
    case when p_payout_kind = 'bank' then upper(p_bank_ifsc) end, now())
  on conflict (host_id) do update set pan = excluded.pan, aadhaar_last4 = excluded.aadhaar_last4, selfie_done = true, payout_kind = excluded.payout_kind,
    upi_id = excluded.upi_id, bank_account = excluded.bank_account, bank_ifsc = excluded.bank_ifsc, agreed_at = now();
  return h;
end $$;

-- Ring-and-hang-up loops harass hosts: at most 5 calls in 2 minutes, and at most 3 unanswered
-- calls to the same host in 10 minutes.
create or replace function public.start_call(p_host uuid, p_type text) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  hp profiles;
  h hosts;
  cfg app_config;
  rate int;
  bal bigint;
  lang text;
  sid uuid;
begin
  select * into me from profiles where id = uid;
  if not found or me.role <> 'user' or me.status <> 'active' then raise exception 'not_allowed'; end if;
  if p_type not in ('audio', 'video') then raise exception 'invalid_type'; end if;
  if (select count(*) from call_sessions where caller_id = uid and created_at > now() - interval '2 minutes') >= 5
    or (select count(*) from call_sessions where caller_id = uid and host_id = p_host and started_at is null and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'too_many_calls';
  end if;
  select * into h from hosts where id = p_host for update;
  select * into hp from profiles where id = p_host;
  if not found or h.approval_status <> 'approved' or hp.status <> 'active' then raise exception 'host_unavailable'; end if;
  if exists (select 1 from blocks where (blocker_id = uid and blocked_id = p_host) or (blocker_id = p_host and blocked_id = uid)) then raise exception 'blocked'; end if;
  if exists (select 1 from call_sessions where caller_id = uid and state in ('ringing', 'active')) then raise exception 'already_in_call'; end if;
  if h.presence = 'busy' or exists (select 1 from call_sessions where host_id = p_host and state in ('ringing', 'active')) then raise exception 'host_busy'; end if;
  if h.presence <> 'online' then raise exception 'host_offline'; end if;
  select * into cfg from app_config;
  rate := case when p_type = 'audio' then coalesce(h.audio_rate, cfg.audio_rate) else coalesce(h.video_rate, cfg.video_rate) end;
  select coin_balance into bal from wallets where user_id = uid;
  if coalesce(bal, 0) < rate then raise exception 'insufficient_coins'; end if;
  select x into lang from unnest(me.languages) x where x = any (hp.languages) limit 1;
  insert into call_sessions (caller_id, host_id, type, language, rate_coins_per_min, host_share_bps, coin_value_paise)
  values (uid, p_host, p_type, coalesce(lang, hp.languages[1]), rate, cfg.host_share_bps[coalesce(h.level_override, h.level)], cfg.coin_value_paise)
  returning id into sid;
  update hosts set presence = 'busy' where id = p_host;
  update profiles set last_active_at = now() where id = uid;
  return sid;
end $$;

create or replace function public.send_gift(p_session uuid, p_gift text, p_nonce text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  g gifts;
  res text;
  earn bigint;
  share int;
  hold int;
  ev uuid;
begin
  if coalesce(p_nonce, '') !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'bad_request'; end if;
  select * into s from call_sessions where id = p_session for update;
  if not found or s.caller_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if s.state <> 'active' then raise exception 'call_over'; end if;
  select * into g from gifts where id = p_gift and active;
  if not found then raise exception 'invalid_gift'; end if;
  res := _apply_coins(s.caller_id, -g.coins, 'gift', 'gift:' || s.id || ':' || p_nonce, 'call', s.id, g.name);
  if res = 'insufficient' then raise exception 'insufficient_coins'; end if;
  if res = 'applied' then
    select gift_share_bps, hold_days into share, hold from app_config;
    earn := floor(g.coins::numeric * s.coin_value_paise * share / 10000);
    insert into gift_events (session_id, from_user, to_host, gift_id, coins, host_earned_paise) values (s.id, s.caller_id, s.host_id, g.id, g.coins, earn) returning id into ev;
    perform _earn(s.host_id, earn, 'gift_earning', 'gift:' || s.id || ':' || p_nonce || ':earn', 'gift', ev,
      jsonb_build_object('kind', 'gift', 'gift', g.id, 'name', (select display_name from profiles where id = s.caller_id)), now() + make_interval(days => hold));
    update call_sessions set gift_coins = gift_coins + g.coins where id = s.id;
  end if;
  return jsonb_build_object('balance', (select coin_balance from wallets where user_id = s.caller_id));
end $$;

create or replace function public.rate_call(p_session uuid, p_stars int, p_tags text[], p_comment text) returns void language plpgsql security definer set search_path = public as $$
declare s call_sessions;
begin
  select * into s from call_sessions where id = p_session;
  if not found or s.caller_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if s.started_at is null then raise exception 'not_connected'; end if;
  if p_stars not between 1 and 5 then raise exception 'invalid_stars'; end if;
  if cardinality(coalesce(p_tags, '{}')) > 8 or exists (select 1 from unnest(p_tags) t where length(t) > 40) then raise exception 'bad_request'; end if;
  insert into ratings (session_id, rater_id, host_id, stars, tags, comment)
  values (s.id, s.caller_id, s.host_id, p_stars, coalesce(p_tags, '{}'), nullif(left(trim(coalesce(p_comment, '')), 200), ''))
  on conflict (session_id) do update set stars = excluded.stars, tags = excluded.tags, comment = excluded.comment;
end $$;

-- A report may only point at a call between the two people, and each person can file 20 a day.
create or replace function public.report_user(p_target uuid, p_session uuid, p_category text, p_details text, p_block boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  target profiles;
  sev int;
  rid uuid;
begin
  select * into me from profiles where id = uid;
  select * into target from profiles where id = p_target;
  if me.id is null or me.status <> 'active' or target.id is null or me.role = 'admin' or target.role = 'admin' or uid = p_target then raise exception 'not_allowed'; end if;
  if p_category not in ('sexual_content', 'harassment', 'abuse', 'fraud', 'underage', 'sharing_contacts', 'spam', 'other') then raise exception 'bad_request'; end if;
  if p_session is not null and not exists (
    select 1 from call_sessions where id = p_session and ((caller_id = uid and host_id = p_target) or (caller_id = p_target and host_id = uid))) then
    raise exception 'not_allowed';
  end if;
  if (select count(*) from reports where reporter_id = uid and created_at > now() - interval '1 day') >= 20 then raise exception 'too_many_reports'; end if;
  sev := case p_category when 'underage' then 4 when 'sexual_content' then 3 when 'fraud' then 3 when 'harassment' then 2 when 'sharing_contacts' then 2 else 1 end;
  insert into reports (reporter_id, reporter_role, target_id, target_role, session_id, category, details, severity)
  values (uid, me.role, p_target, target.role, p_session, p_category, left(coalesce(p_details, ''), 500), sev)
  returning id into rid;
  if p_block then
    insert into blocks (blocker_id, blocked_id) values (uid, p_target) on conflict do nothing;
    delete from favorites where user_id = uid and host_id = p_target;
  end if;
  return rid;
end $$;

-- ───────── 5. Function access: the app-facing functions only ─────────

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname !~ '^_' and p.proname not in ('reap', 'recompute_levels')
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- ───────── 6. Indexes for foreign keys (deletes and joins stay fast) ─────────

create index if not exists audit_log_actor_idx on public.audit_log (actor);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists favorites_host_idx on public.favorites (host_id);
create index if not exists gift_events_from_idx on public.gift_events (from_user);
create index if not exists gift_events_gift_idx on public.gift_events (gift_id);
create index if not exists gift_events_session_idx on public.gift_events (session_id);
create index if not exists gift_events_to_idx on public.gift_events (to_host);
create index if not exists payout_requests_decided_by_idx on public.payout_requests (decided_by);
create index if not exists payout_requests_host_idx on public.payout_requests (host_id);
create index if not exists purchases_pack_idx on public.purchases (pack_id);
create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists ratings_rater_idx on public.ratings (rater_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);
create index if not exists reports_session_idx on public.reports (session_id);
create index if not exists reports_target_idx on public.reports (target_id);
create index if not exists call_sessions_caller_recent_idx on public.call_sessions (caller_id, created_at);
