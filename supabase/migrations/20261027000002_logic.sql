-- Server-side logic. Clients never write money, calls or moderation tables directly: they call
-- these functions, which check who is asking and do everything in one transaction.
-- Errors are raised as short codes (e.g. 'insufficient_coins') that the apps translate.

-- ───────── Read models ─────────

-- Trailing-30-day behaviour behind each host's Spotlight Score (rating is all-time).
create view public.host_stats as
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
) t on true;

-- What callers see about approved, active hosts.
create view public.public_hosts as
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
where h.approval_status = 'approved' and p.status = 'active';

-- Reviews shown on host profiles and to the host herself (hidden ones never appear).
create view public.public_reviews as
select r.session_id as id, r.host_id, p.display_name as author, p.avatar_key, r.stars, r.tags, coalesce(r.comment, '') as comment, r.created_at
from public.ratings r join public.profiles p on p.id = r.rater_id
where not r.hidden;

-- My calls with the other person's public details (caller or host side).
create view public.my_calls as
select
  s.*,
  cp.display_name as caller_name, cp.avatar_key as caller_avatar, cp.languages as caller_languages,
  hp.display_name as host_name, hp.avatar_key as host_avatar,
  r.stars as rating, r.tags as rating_tags, r.comment as rating_comment
from public.call_sessions s
join public.profiles cp on cp.id = s.caller_id
join public.profiles hp on hp.id = s.host_id
left join public.ratings r on r.session_id = s.id
where s.caller_id = auth.uid() or s.host_id = auth.uid();

-- A host's earnings, one line per call / gift / payout (per-minute rows are summed).
create view public.my_earnings as
select
  min(e.id) as id,
  e.reason,
  e.ref_id,
  (array_agg(e.meta order by e.id))[1] as meta,
  sum(e.delta_paise)::bigint as paise,
  min(e.created_at) as created_at,
  max(e.available_at) as available_at
from public.earnings_ledger e
where e.host_id = auth.uid()
group by e.reason, e.ref_id, case when e.ref_id is null then e.id end;

-- ───────── Internal helpers (not callable from apps) ─────────

-- Append to a caller's coin ledger. Idempotent on the key; never lets the balance go negative.
create function public._apply_coins(p_user uuid, p_delta bigint, p_reason text, p_key text, p_ref_type text default null, p_ref_id uuid default null, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare bal bigint;
begin
  select coin_balance into bal from wallets where user_id = p_user for update;
  if not found then
    insert into wallets (user_id) values (p_user);
    bal := 0;
  end if;
  if exists (select 1 from coin_ledger where idempotency_key = p_key) then return 'duplicate'; end if;
  if bal + p_delta < 0 then return 'insufficient'; end if;
  update wallets set coin_balance = bal + p_delta, updated_at = now() where user_id = p_user;
  insert into coin_ledger (user_id, delta, reason, ref_type, ref_id, note, idempotency_key, balance_after)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref_id, p_note, p_key, bal + p_delta);
  return 'applied';
end $$;

-- Append to a host's earnings ledger. Idempotent on the key.
create function public._earn(p_host uuid, p_paise bigint, p_reason text, p_key text, p_ref_type text, p_ref_id uuid, p_meta jsonb, p_available_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into earnings_ledger (host_id, delta_paise, reason, ref_type, ref_id, meta, idempotency_key, available_at)
  values (p_host, p_paise, p_reason, p_ref_type, p_ref_id, coalesce(p_meta, '{}'), p_key, p_available_at)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

create function public._audit(p_action text, p_target_type text, p_target_id text, p_detail text, p_vars jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, actor_email, action, target_type, target_id, vars, detail)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'system'), p_action, p_target_type, p_target_id, p_vars, coalesce(p_detail, ''));
$$;

create function public._join(variadic parts text[]) returns text language sql immutable as $$
  select coalesce(string_agg(x, ' · '), '') from unnest(parts) x where x is not null and x <> '';
$$;

-- Charge minute N of a call (prepaid). Returns false when the caller can't pay for it.
create function public._charge_minute(p_session uuid, p_minute int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  res text;
  earn bigint;
  hold int;
begin
  select * into s from call_sessions where id = p_session;
  res := _apply_coins(s.caller_id, -s.rate_coins_per_min, 'call_charge', 'call:' || s.id || ':minute:' || p_minute, 'call', s.id);
  if res = 'insufficient' then return false; end if;
  if res = 'duplicate' then return true; end if;
  earn := floor(s.rate_coins_per_min::numeric * s.coin_value_paise * s.host_share_bps / 10000);
  select hold_days into hold from app_config;
  perform _earn(s.host_id, earn, 'call_earning', 'call:' || s.id || ':minute:' || p_minute || ':earn', 'call', s.id,
    jsonb_build_object('kind', 'call', 'type', s.type, 'name', (select display_name from profiles where id = s.caller_id)),
    now() + make_interval(days => hold));
  update call_sessions
  set billed_minutes = greatest(billed_minutes, p_minute), coins_charged = coins_charged + s.rate_coins_per_min, host_earned_paise = host_earned_paise + earn
  where id = s.id;
  return true;
end $$;

-- Close a call. Calls shorter than refund_under_seconds are refunded and the host earning reversed.
create function public._end_call(p_session uuid, p_reason text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  dur int;
  refund_under int;
  hold int;
  refund int := 0;
begin
  select * into s from call_sessions where id = p_session for update;
  if s.state = 'active' then
    dur := extract(epoch from now() - s.started_at)::int;
    select refund_under_seconds, hold_days into refund_under, hold from app_config;
    if dur < refund_under and s.coins_charged > 0 then
      perform _apply_coins(s.caller_id, s.coins_charged, 'call_refund', 'call:' || s.id || ':refund', 'call', s.id, 'Short call refund');
      if s.host_earned_paise > 0 then
        perform _earn(s.host_id, -s.host_earned_paise, 'clawback', 'call:' || s.id || ':clawback', 'call', s.id, '{}'::jsonb, now() + make_interval(days => hold));
      end if;
      refund := s.coins_charged;
    end if;
    update call_sessions
    set state = 'ended', ended_at = now(), end_reason = p_reason, ended_by = p_actor,
        refunded_coins = refunded_coins + refund, host_earned_paise = case when refund > 0 then 0 else host_earned_paise end
    where id = s.id returning * into s;
  elsif s.state = 'ringing' then
    update call_sessions
    set state = case p_reason when 'declined' then 'declined' when 'timeout' then 'missed' else 'cancelled' end,
        ended_at = now(), end_reason = p_reason, ended_by = p_actor
    where id = s.id returning * into s;
  end if;
  update hosts set presence = 'online' where id = s.host_id and presence = 'busy';
  return jsonb_build_object(
    'state', s.state,
    'duration_sec', coalesce(extract(epoch from s.ended_at - s.started_at)::int, 0),
    'coins_charged', s.coins_charged - s.refunded_coins,
    'refunded_coins', s.refunded_coins,
    'gift_coins', s.gift_coins,
    'end_reason', s.end_reason);
end $$;

-- ───────── Account ─────────

create function public.complete_profile(p_display_name text, p_gender text, p_dob date, p_avatar_key text, p_languages text[], p_ui_language text, p_consent_version text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_role text;
  prof profiles;
  trial int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'profile_exists'; end if;
  if p_dob is null or p_dob > (current_date - interval '18 years')::date then raise exception 'under_18'; end if;
  if length(trim(coalesce(p_display_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if p_gender not in ('male', 'female', 'other') then raise exception 'invalid_gender'; end if;
  v_role := case when p_gender = 'female' then 'host' else 'user' end;
  insert into profiles (id, role, phone, display_name, gender, date_of_birth, avatar_key, languages, ui_language, consent_at, consent_version)
  values (uid, v_role, (select phone from auth.users where id = uid), trim(p_display_name), p_gender, p_dob, p_avatar_key, coalesce(p_languages, '{}'), coalesce(p_ui_language, 'en'), now(), p_consent_version)
  returning * into prof;
  insert into wallets (user_id) values (uid);
  if v_role = 'user' then
    select trial_coins into trial from app_config;
    if trial > 0 then perform _apply_coins(uid, trial, 'signup_trial', 'signup:' || uid, null, null, 'Welcome coins'); end if;
  end if;
  return prof;
end $$;

create function public.update_my_profile(p_display_name text default null, p_avatar_key text default null, p_languages text[] default null, p_ui_language text default null,
  p_notify_calls boolean default null, p_notify_offers boolean default null, p_notify_favorites boolean default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare prof profiles;
begin
  if p_display_name is not null and length(trim(p_display_name)) < 2 then raise exception 'invalid_name'; end if;
  update profiles set
    display_name = coalesce(trim(p_display_name), display_name),
    avatar_key = coalesce(p_avatar_key, avatar_key),
    languages = coalesce(p_languages, languages),
    ui_language = coalesce(p_ui_language, ui_language),
    notify_calls = coalesce(p_notify_calls, notify_calls),
    notify_offers = coalesce(p_notify_offers, notify_offers),
    notify_favorites = coalesce(p_notify_favorites, notify_favorites),
    last_active_at = now()
  where id = auth.uid() returning * into prof;
  if not found then raise exception 'no_profile'; end if;
  return prof;
end $$;

-- App open / every minute while open: marks the person active (and the host as still online).
create function public.ping() returns void language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid();
  update hosts set last_seen = now() where id = auth.uid();
$$;

-- Anonymises the profile and ends any live call. Ledger rows stay (accounting law).
create function public.delete_my_account() returns void language plpgsql security definer set search_path = public as $$
declare live uuid;
begin
  for live in select id from call_sessions where (caller_id = auth.uid() or host_id = auth.uid()) and state in ('ringing', 'active') loop
    perform _end_call(live, 'caller_hangup', auth.uid());
  end loop;
  update hosts set presence = 'offline', featured = false where id = auth.uid();
  update profiles set status = 'deleted', display_name = 'Deleted user', phone = null, avatar_key = null where id = auth.uid();
  delete from favorites where user_id = auth.uid();
  delete from device_tokens where user_id = auth.uid();
end $$;

-- ───────── Hosts ─────────

create function public.submit_host_application(p_display_name text, p_bio text, p_city text, p_languages text[], p_pan text, p_aadhaar_last4 text,
  p_payout_kind text, p_upi_id text, p_bank_account text, p_bank_ifsc text, p_selfie_done boolean)
returns public.hosts language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h hosts;
begin
  if not exists (select 1 from profiles where id = uid and role = 'host' and status = 'active') then raise exception 'not_allowed'; end if;
  if exists (select 1 from hosts where id = uid and approval_status = 'approved') then raise exception 'already_approved'; end if;
  if length(trim(coalesce(p_bio, ''))) < 20 then raise exception 'bio_too_short'; end if;
  if upper(p_pan) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'invalid_pan'; end if;
  if p_aadhaar_last4 !~ '^[0-9]{4}$' then raise exception 'invalid_aadhaar'; end if;
  if p_payout_kind = 'upi' and coalesce(p_upi_id, '') !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$' then raise exception 'invalid_upi'; end if;
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

create function public.set_presence(p_presence text) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if p_presence not in ('online', 'offline') then raise exception 'invalid_presence'; end if;
  if not exists (select 1 from hosts h join profiles p on p.id = h.id where h.id = uid and h.approval_status = 'approved' and p.status = 'active') then raise exception 'not_allowed'; end if;
  if exists (select 1 from call_sessions where host_id = uid and state in ('ringing', 'active')) then return 'busy'; end if;
  update hosts set presence = p_presence, last_seen = now() where id = uid;
  if p_presence = 'online' then insert into host_active_days (host_id, day) values (uid, current_date) on conflict do nothing; end if;
  return p_presence;
end $$;

create function public.my_host_balances() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pending', coalesce(sum(delta_paise) filter (where available_at > now() and reason not in ('payout', 'payout_reversal')), 0),
    'available', coalesce(sum(delta_paise) filter (where available_at <= now() or reason in ('payout', 'payout_reversal')), 0),
    'lifetime', coalesce(sum(delta_paise) filter (where reason in ('call_earning', 'gift_earning', 'bonus', 'clawback', 'adjust')), 0),
    'today', coalesce(sum(delta_paise) filter (where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' and reason in ('call_earning', 'gift_earning', 'bonus', 'clawback')), 0))
  from earnings_ledger where host_id = auth.uid();
$$;

create function public.request_payout(p_amount_paise bigint) returns public.payout_requests language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  avail bigint;
  min_w int;
  kyc host_private;
  pr payout_requests;
  method text;
begin
  if not exists (select 1 from hosts h join profiles p on p.id = h.id where h.id = uid and h.approval_status = 'approved' and p.status = 'active') then raise exception 'not_allowed'; end if;
  perform 1 from hosts where id = uid for update; -- one payout request at a time per host
  select min_withdrawal_paise into min_w from app_config;
  if p_amount_paise < min_w then raise exception 'below_min'; end if;
  avail := (my_host_balances() ->> 'available')::bigint;
  if p_amount_paise > avail then raise exception 'above_available'; end if;
  select * into kyc from host_private where host_id = uid;
  method := case when kyc.payout_kind = 'upi' then 'UPI · ' || kyc.upi_id else 'Bank ····' || right(coalesce(kyc.bank_account, ''), 4) || ' · ' || coalesce(kyc.bank_ifsc, '') end;
  insert into payout_requests (host_id, amount_paise, tds_paise, net_paise, method)
  values (uid, p_amount_paise, p_amount_paise / 100, p_amount_paise - p_amount_paise / 100, method)
  returning * into pr;
  perform _earn(uid, -p_amount_paise, 'payout', 'payout:' || pr.id, 'payout', pr.id, jsonb_build_object('kind', 'withdrawal'), now());
  return pr;
end $$;

-- ───────── Calls ─────────

create function public.start_call(p_host uuid, p_type text) returns uuid language plpgsql security definer set search_path = public as $$
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

create function public.accept_call(p_session uuid) returns public.call_sessions language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  timeout int;
begin
  select * into s from call_sessions where id = p_session for update;
  if not found or s.host_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if s.state <> 'ringing' then raise exception 'call_over'; end if;
  select ring_timeout_seconds into timeout from app_config;
  if s.created_at < now() - make_interval(secs => timeout + 5) then
    perform _end_call(s.id, 'timeout', null);
    raise exception 'call_over';
  end if;
  update call_sessions set state = 'active', started_at = now(), last_heartbeat_at = now() where id = s.id;
  if not _charge_minute(s.id, 1) then
    perform _end_call(s.id, 'low_balance', null);
    raise exception 'caller_no_coins';
  end if;
  select * into s from call_sessions where id = s.id;
  return s;
end $$;

create function public.decline_call(p_session uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare s call_sessions;
begin
  select * into s from call_sessions where id = p_session;
  if not found or s.host_id <> auth.uid() then raise exception 'not_allowed'; end if;
  return _end_call(p_session, 'declined', auth.uid());
end $$;

-- Caller cancels while ringing; p_timeout marks it missed (host never answered).
create function public.cancel_call(p_session uuid, p_timeout boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare s call_sessions;
begin
  select * into s from call_sessions where id = p_session;
  if not found or s.caller_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if s.state <> 'ringing' then return jsonb_build_object('state', s.state); end if;
  return _end_call(p_session, case when p_timeout then 'timeout' else 'caller_hangup' end, auth.uid());
end $$;

-- Heartbeat from either side every ~15s. Bills each minute as it starts; ends the call when the caller can't pay.
create function public.call_tick(p_session uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s call_sessions;
  due int;
  m int;
  bal bigint;
  ended jsonb;
begin
  select * into s from call_sessions where id = p_session for update;
  if not found or uid not in (s.caller_id, s.host_id) then raise exception 'not_allowed'; end if;
  if s.state = 'active' then
    update call_sessions set last_heartbeat_at = now() where id = s.id;
    due := floor(extract(epoch from now() - s.started_at) / 60)::int + 1;
    for m in (s.billed_minutes + 1)..due loop
      if not _charge_minute(s.id, m) then
        ended := _end_call(s.id, 'low_balance', null);
        select coin_balance into bal from wallets where user_id = s.caller_id;
        return ended || jsonb_build_object('balance', case when uid = s.caller_id then bal end);
      end if;
    end loop;
    select * into s from call_sessions where id = s.id;
  end if;
  select coin_balance into bal from wallets where user_id = s.caller_id;
  return jsonb_build_object('state', s.state, 'billed_minutes', s.billed_minutes, 'coins_charged', s.coins_charged, 'end_reason', s.end_reason,
    'balance', case when uid = s.caller_id then bal end, 'elapsed_sec', coalesce(extract(epoch from now() - s.started_at)::int, 0));
end $$;

create function public.end_call(p_session uuid, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s call_sessions;
  reason text;
begin
  select * into s from call_sessions where id = p_session;
  if not found or uid not in (s.caller_id, s.host_id) then raise exception 'not_allowed'; end if;
  reason := case when p_reason = 'moderation' then 'moderation' when uid = s.caller_id then 'caller_hangup' else 'host_hangup' end;
  if s.state in ('ringing', 'active') then return _end_call(p_session, reason, uid); end if;
  return jsonb_build_object('state', s.state, 'duration_sec', coalesce(extract(epoch from s.ended_at - s.started_at)::int, 0),
    'coins_charged', s.coins_charged - s.refunded_coins, 'refunded_coins', s.refunded_coins, 'gift_coins', s.gift_coins, 'end_reason', s.end_reason);
end $$;

create function public.send_gift(p_session uuid, p_gift text, p_nonce text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  g gifts;
  res text;
  earn bigint;
  share int;
  hold int;
  ev uuid;
begin
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

create function public.rate_call(p_session uuid, p_stars int, p_tags text[], p_comment text) returns void language plpgsql security definer set search_path = public as $$
declare s call_sessions;
begin
  select * into s from call_sessions where id = p_session;
  if not found or s.caller_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if s.started_at is null then raise exception 'not_connected'; end if;
  if p_stars not between 1 and 5 then raise exception 'invalid_stars'; end if;
  insert into ratings (session_id, rater_id, host_id, stars, tags, comment)
  values (s.id, s.caller_id, s.host_id, p_stars, coalesce(p_tags, '{}'), nullif(left(trim(coalesce(p_comment, '')), 200), ''))
  on conflict (session_id) do update set stars = excluded.stars, tags = excluded.tags, comment = excluded.comment;
end $$;

create function public.report_user(p_target uuid, p_session uuid, p_category text, p_details text, p_block boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me profiles;
  target profiles;
  sev int;
  rid uuid;
begin
  select * into me from profiles where id = uid;
  select * into target from profiles where id = p_target;
  if me.id is null or target.id is null or me.role = 'admin' or target.role = 'admin' or uid = p_target then raise exception 'not_allowed'; end if;
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

-- ───────── Admin actions (admins only; every one writes the audit log) ─────────

create function public._require_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
end $$;

create function public.admin_set_user_status(p_user uuid, p_status text, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_status not in ('active', 'suspended', 'banned', 'deleted') then raise exception 'invalid_status'; end if;
  update profiles set status = p_status where id = p_user and role = 'user';
  perform _audit(case p_status when 'active' then 'userActive' when 'suspended' then 'userSuspended' when 'banned' then 'userBanned' else 'userDeleted' end,
    'user', p_user::text, _join((select display_name from profiles where id = p_user), p_reason));
end $$;

create function public.admin_adjust_coins(p_user uuid, p_delta int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare res text;
begin
  perform _require_admin();
  if p_delta = 0 then raise exception 'invalid_amount'; end if;
  res := _apply_coins(p_user, p_delta, 'admin_adjust', 'admin:' || gen_random_uuid(), 'admin', auth.uid(), p_reason);
  if res = 'insufficient' then raise exception 'insufficient_coins'; end if;
  perform _audit(case when p_delta > 0 then 'coinsAdded' else 'coinsRemoved' end, 'user', p_user::text,
    _join((select display_name from profiles where id = p_user), p_reason), jsonb_build_object('n', abs(p_delta)));
end $$;

create function public.admin_set_host_status(p_host uuid, p_status text, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare live uuid;
begin
  perform _require_admin();
  if p_status not in ('active', 'suspended', 'banned') then raise exception 'invalid_status'; end if;
  update profiles set status = p_status where id = p_host and role = 'host';
  if p_status <> 'active' then
    for live in select id from call_sessions where host_id = p_host and state in ('ringing', 'active') loop
      perform _end_call(live, 'admin', auth.uid());
    end loop;
    update hosts set presence = 'offline', featured = false where id = p_host;
  end if;
  perform _audit(case p_status when 'active' then 'hostActive' when 'suspended' then 'hostSuspended' else 'hostBanned' end,
    'host', p_host::text, _join((select display_name from profiles where id = p_host), p_reason));
end $$;

create function public.admin_set_featured(p_host uuid, p_featured boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update hosts set featured = p_featured where id = p_host;
  perform _audit(case when p_featured then 'featured' else 'unfeatured' end, 'host', p_host::text, (select display_name from profiles where id = p_host));
end $$;

create function public.admin_set_level_override(p_host uuid, p_level int) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update hosts set level_override = p_level where id = p_host;
  perform _audit(case when p_level is null then 'levelCleared' else 'levelSet' end, 'host', p_host::text,
    (select display_name from profiles where id = p_host), case when p_level is null then null else jsonb_build_object('n', p_level) end);
end $$;

create function public.admin_add_strike(p_host uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update hosts set strikes = strikes + 1, featured = false where id = p_host;
  perform _audit('strikeAdded', 'host', p_host::text, _join((select display_name from profiles where id = p_host), p_reason));
end $$;

create function public.admin_clear_strikes(p_host uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update hosts set strikes = 0 where id = p_host;
  perform _audit('strikesCleared', 'host', p_host::text, _join((select display_name from profiles where id = p_host), p_reason));
end $$;

create function public.admin_decide_application(p_host uuid, p_approve boolean, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update hosts set approval_status = case when p_approve then 'approved' else 'rejected' end, decision_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = now()
  where id = p_host and approval_status = 'pending';
  if not found then raise exception 'not_pending'; end if;
  perform _audit(case when p_approve then 'kycApproved' else 'kycRejected' end, 'application', p_host::text, _join((select display_name from profiles where id = p_host), p_note));
end $$;

create function public.admin_set_review_hidden(p_session uuid, p_hidden boolean, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update ratings set hidden = p_hidden where session_id = p_session;
  perform _audit(case when p_hidden then 'reviewHidden' else 'reviewRestored' end, 'review', p_session::text, p_reason);
end $$;

create function public.admin_refund_call(p_session uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare
  s call_sessions;
  coins int;
begin
  perform _require_admin();
  select * into s from call_sessions where id = p_session for update;
  coins := s.coins_charged - s.refunded_coins;
  if not found or coins <= 0 then raise exception 'nothing_to_refund'; end if;
  perform _apply_coins(s.caller_id, coins, 'call_refund', 'call:' || s.id || ':admin_refund', 'call', s.id, p_reason);
  if s.host_earned_paise > 0 then
    perform _earn(s.host_id, -s.host_earned_paise, 'clawback', 'call:' || s.id || ':admin_clawback', 'call', s.id, '{}'::jsonb, now());
  end if;
  update call_sessions set refunded_coins = refunded_coins + coins, host_earned_paise = 0 where id = s.id;
  perform _audit('callRefunded', 'call', s.id::text, _join((select display_name from profiles where id = s.caller_id), p_reason), jsonb_build_object('n', coins));
end $$;

create function public.admin_refund_purchase(p_purchase uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare p purchases;
begin
  perform _require_admin();
  select * into p from purchases where id = p_purchase for update;
  if not found or p.status = 'refunded' then raise exception 'nothing_to_refund'; end if;
  update purchases set status = 'refunded' where id = p.id;
  -- Take back what's left of the coins (the balance can't go below zero).
  perform _apply_coins(p.user_id, -least(p.coins_granted, (select coin_balance from wallets where user_id = p.user_id)), 'purchase_refund', 'purchase:' || p.id || ':refund', 'purchase', p.id, p_reason);
  perform _audit('purchaseRefunded', 'purchase', p.id::text, _join((select display_name from profiles where id = p.user_id), p.pack_id, p_reason));
end $$;

create function public.admin_decide_payout(p_payout uuid, p_status text, p_note text) returns void language plpgsql security definer set search_path = public as $$
declare pr payout_requests;
begin
  perform _require_admin();
  select * into pr from payout_requests where id = p_payout for update;
  if not found then raise exception 'not_found'; end if;
  if not ((pr.status = 'requested' and p_status in ('approved', 'rejected')) or (pr.status = 'approved' and p_status in ('paid', 'rejected'))) then raise exception 'invalid_transition'; end if;
  update payout_requests set status = p_status, note = nullif(trim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now() where id = pr.id;
  if p_status = 'rejected' then
    perform _earn(pr.host_id, pr.amount_paise, 'payout_reversal', 'payout:' || pr.id || ':reversal', 'payout', pr.id, jsonb_build_object('kind', 'payoutReturned'), now());
  end if;
  perform _audit(case p_status when 'approved' then 'payoutApproved' when 'paid' then 'payoutPaid' else 'payoutRejected' end,
    'payout', pr.id::text, _join((select display_name from profiles where id = pr.host_id), p_note));
end $$;

create function public.admin_resolve_report(p_report uuid, p_decision text, p_note text, p_refund boolean) returns void language plpgsql security definer set search_path = public as $$
declare
  r reports;
  target_name text;
  ref text;
begin
  perform _require_admin();
  if p_decision not in ('dismiss', 'warn', 'strike', 'suspend', 'ban') then raise exception 'invalid_decision'; end if;
  select * into r from reports where id = p_report for update;
  if not found or r.status not in ('open', 'reviewing') then raise exception 'not_open'; end if;
  update reports set status = case when p_decision = 'dismiss' then 'dismissed' else 'actioned' end, decision = p_decision,
    resolution = nullif(trim(coalesce(p_note, '')), ''), resolved_by = auth.uid(), resolved_at = now()
  where id = r.id;
  select display_name into target_name from profiles where id = r.target_id;
  ref := '#' || left(r.id::text, 8);
  perform _audit(case when p_decision = 'dismiss' then 'reportDismissed' else 'reportActioned' end, 'report', r.id::text, _join(target_name, p_note));
  if p_decision = 'warn' then perform _audit('warningSent', r.target_role, r.target_id::text, _join(target_name, ref)); end if;
  if p_decision = 'strike' and r.target_role = 'host' then perform admin_add_strike(r.target_id, _join(ref, p_note)); end if;
  if p_decision in ('suspend', 'ban') then
    if r.target_role = 'host' then perform admin_set_host_status(r.target_id, case when p_decision = 'ban' then 'banned' else 'suspended' end, ref);
    else perform admin_set_user_status(r.target_id, case when p_decision = 'ban' then 'banned' else 'suspended' end, ref);
    end if;
  end if;
  if p_refund and p_decision <> 'dismiss' and r.session_id is not null
     and exists (select 1 from call_sessions where id = r.session_id and coins_charged > refunded_coins) then
    perform admin_refund_call(r.session_id, ref);
  end if;
end $$;

create function public.admin_update_config(p_patch jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update app_config set
    coin_value_paise = coalesce((p_patch ->> 'coinValuePaise')::int, coin_value_paise),
    audio_rate = coalesce((p_patch ->> 'audioRate')::int, audio_rate),
    video_rate = coalesce((p_patch ->> 'videoRate')::int, video_rate),
    host_share_bps = coalesce((select array_agg(x::int) from jsonb_array_elements_text(p_patch -> 'hostShareBps') x), host_share_bps),
    gift_share_bps = coalesce((p_patch ->> 'giftShareBps')::int, gift_share_bps),
    min_withdrawal_paise = coalesce((p_patch ->> 'minWithdrawalPaise')::int, min_withdrawal_paise),
    hold_days = coalesce((p_patch ->> 'holdDays')::int, hold_days),
    trial_coins = coalesce((p_patch ->> 'trialCoins')::int, trial_coins),
    refund_under_seconds = coalesce((p_patch ->> 'refundUnderSeconds')::int, refund_under_seconds),
    spotlight_min_score = coalesce((p_patch ->> 'spotlightMinScore')::int, spotlight_min_score),
    updated_at = now()
  where id = 1;
  perform _audit('configUpdated', 'config', 'app_config',
    (select string_agg(key || ' = ' || value::text, ', ') from jsonb_each(p_patch)));
end $$;

-- ───────── Scheduled jobs ─────────

-- Every minute: unanswered rings become missed, calls without a heartbeat for 45s end,
-- hosts whose app went quiet for 3 minutes go offline.
create function public.reap() returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
  timeout int;
begin
  select ring_timeout_seconds into timeout from app_config;
  for s in select id from call_sessions where state = 'ringing' and created_at < now() - make_interval(secs => timeout + 10) loop
    perform _end_call(s.id, 'timeout', null);
  end loop;
  for s in select id from call_sessions where state = 'active' and coalesce(last_heartbeat_at, started_at) < now() - interval '45 seconds' loop
    perform _end_call(s.id, 'network', null);
  end loop;
  update hosts set presence = 'offline'
  where presence = 'online' and coalesce(last_seen, created_at) < now() - interval '3 minutes';
  update hosts h set presence = 'online'
  where presence = 'busy' and not exists (select 1 from call_sessions c where c.host_id = h.id and c.state in ('ringing', 'active'));
end $$;

-- Nightly: level from the last 30 days (spec §8.3). Admin overrides win.
create function public.recompute_levels() returns void language sql security definer set search_path = public as $$
  update hosts h set level = case
    when x.minutes >= 4000 and x.rating >= 4.5 and x.report_rate < 0.005 and h.strikes = 0 then 4
    when x.minutes >= 1500 and x.rating >= 4.3 and x.report_rate < 0.01 then 3
    when x.minutes >= 300 and x.rating >= 4.0 and x.report_rate < 0.02 then 2
    else 1 end
  from (
    select hs.host_id, hs.rating_avg as rating, hs.report_rate,
      coalesce((select sum(extract(epoch from ended_at - started_at) / 60) from call_sessions c
        where c.host_id = hs.host_id and c.started_at is not null and c.created_at > now() - interval '30 days'), 0) as minutes
    from host_stats hs
  ) x
  where x.host_id = h.id;
$$;
