-- Push notifications (Firebase Cloud Messaging).
-- Phones register their FCM token; database triggers ask the `push` Edge Function to send.
-- The function's address and shared secret live in Vault (set by scripts/setup-push.mjs), so
-- nothing secret is in this file. Until they are set, the triggers do nothing.

create extension if not exists pg_net with schema extensions;

-- One phone belongs to whoever signed in on it last.
create function public.register_device(p_token text, p_platform text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if coalesce(length(p_token), 0) not between 20 and 4096 then raise exception 'bad_token'; end if;
  delete from device_tokens where token = p_token and user_id <> auth.uid();
  insert into device_tokens (user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now();
end $$;

create function public.unregister_device(p_token text) returns void language sql security definer set search_path = public as $$
  delete from device_tokens where user_id = auth.uid() and token = p_token;
$$;

-- Queues a request to the push function. pg_net sends it after the transaction commits.
create function public._push(p_payload jsonb) returns void language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_secret';
  if url is null or secret is null then return; end if;
  perform net.http_post(
    url := url,
    body := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 5000
  );
end $$;

-- Ring: tell the host. Missed or cancelled while ringing: replace the ring with "missed call".
-- A host who misses a call while her app is closed is switched offline, so callers stop trying her.
create function public._on_call_state() returns trigger language plpgsql security definer set search_path = public as $$
declare
  away boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.state = 'ringing' then perform _push(jsonb_build_object('kind', 'call', 'session', new.id)); end if;
  elsif old.state = 'ringing' and new.state in ('missed', 'cancelled') then
    if new.state = 'missed' then
      update hosts set presence = 'offline'
      where id = new.host_id and coalesce(last_seen, created_at) < now() - interval '3 minutes'
      returning true into away;
    end if;
    perform _push(jsonb_build_object('kind', 'missed', 'session', new.id, 'wentOffline', coalesce(away, false)));
  end if;
  return null;
end $$;

create trigger push_on_call after insert or update of state on public.call_sessions
  for each row execute function public._on_call_state();

create function public._on_host_decision() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approval_status <> old.approval_status and new.approval_status in ('approved', 'rejected') then
    perform _push(jsonb_build_object('kind', 'kyc', 'user', new.id, 'status', new.approval_status));
  end if;
  return null;
end $$;

create trigger push_on_host_decision after update of approval_status on public.hosts
  for each row execute function public._on_host_decision();

create function public._on_payout_decision() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('paid', 'rejected') then
    perform _push(jsonb_build_object('kind', 'payout', 'user', new.host_id, 'status', new.status, 'amountPaise', new.net_paise));
  end if;
  return null;
end $$;

create trigger push_on_payout_decision after update of status on public.payout_requests
  for each row execute function public._on_payout_decision();

revoke execute on function public._push(jsonb) from public, anon, authenticated;
revoke execute on function public._on_call_state() from public, anon, authenticated;
revoke execute on function public._on_host_decision() from public, anon, authenticated;
revoke execute on function public._on_payout_decision() from public, anon, authenticated;
revoke execute on function public.register_device(text, text) from public, anon;
revoke execute on function public.unregister_device(text) from public, anon;
grant execute on function public.register_device(text, text) to authenticated;
grant execute on function public.unregister_device(text) to authenticated;

-- Presence: a host whose phone can receive call alerts stays online in the background for up to
-- 8 hours since she last opened the app (a missed call switches her off sooner, see above).
-- Without alerts she goes offline 3 minutes after the app goes quiet, as before.
create or replace function public.reap() returns void language plpgsql security definer set search_path = public as $$
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
  update hosts h set presence = 'offline'
  where presence = 'online'
    and coalesce(last_seen, created_at) < now() - case
      when exists (select 1 from device_tokens d join profiles p on p.id = d.user_id where d.user_id = h.id and p.notify_calls) then interval '8 hours'
      else interval '3 minutes' end;
  update hosts h set presence = 'online'
  where presence = 'busy' and not exists (select 1 from call_sessions c where c.host_id = h.id and c.state in ('ringing', 'active'));
end $$;

revoke execute on function public.reap() from public, anon, authenticated;
