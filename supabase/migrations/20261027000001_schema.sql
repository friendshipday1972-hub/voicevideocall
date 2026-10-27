-- Baatein core schema: people, hosts, wallets, ledgers, calls, social, moderation, config.
-- Money is integer paise, coins are integers. Ledgers are append-only.

create extension if not exists pgcrypto with schema extensions;

-- ───────── Config (one row, edited from the admin dashboard) ─────────
create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  coin_value_paise int not null default 75,
  audio_rate int not null default 6,
  video_rate int not null default 10,
  host_share_bps int[] not null default '{3500,4000,4500,5000}',
  gift_share_bps int not null default 6000,
  min_withdrawal_paise int not null default 50000,
  hold_days int not null default 7,
  trial_coins int not null default 6,
  refund_under_seconds int not null default 10,
  spotlight_min_score int not null default 60,
  ring_timeout_seconds int not null default 30,
  updated_at timestamptz not null default now()
);
insert into public.app_config default values;

-- ───────── People ─────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('user', 'host', 'admin')),
  phone text,
  email text,
  display_name text not null,
  gender text check (gender in ('male', 'female', 'other')),
  date_of_birth date,
  avatar_key text,
  languages text[] not null default '{}',
  ui_language text not null default 'en',
  status text not null default 'active' check (status in ('active', 'suspended', 'banned', 'deleted')),
  consent_at timestamptz,
  consent_version text,
  notify_calls boolean not null default true,
  notify_offers boolean not null default true,
  notify_favorites boolean not null default true,
  flags text[] not null default '{}',
  device text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- A woman host. The row exists from the moment she submits her application.
create table public.hosts (
  id uuid primary key references public.profiles on delete cascade,
  bio text not null default '',
  city text not null default '',
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  decision_note text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  level smallint not null default 1 check (level between 1 and 4),
  level_override smallint check (level_override between 1 and 4),
  presence text not null default 'offline' check (presence in ('offline', 'online', 'busy')),
  last_seen timestamptz,
  featured boolean not null default false,
  strikes int not null default 0,
  audio_rate int,
  video_rate int,
  created_at timestamptz not null default now()
);

-- KYC and payout details. Owner writes through an RPC, admins read; never exposed to other users.
-- Aadhaar: only the last 4 digits are ever stored. Verification moves to a KYC provider later.
create table public.host_private (
  host_id uuid primary key references public.hosts on delete cascade,
  pan text,
  aadhaar_last4 text,
  selfie_done boolean not null default false,
  payout_kind text check (payout_kind in ('upi', 'bank')),
  upi_id text,
  bank_account text,
  bank_ifsc text,
  agreed_at timestamptz
);

-- Days a host was online (feeds the "regularly online" part of the Spotlight Score).
create table public.host_active_days (
  host_id uuid not null references public.hosts on delete cascade,
  day date not null,
  primary key (host_id, day)
);

-- ───────── Coins (callers) ─────────
create table public.wallets (
  user_id uuid primary key references public.profiles on delete cascade,
  coin_balance bigint not null default 0 check (coin_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.coin_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  delta bigint not null,
  reason text not null check (reason in ('purchase', 'call_charge', 'call_refund', 'gift', 'bonus', 'admin_adjust', 'signup_trial', 'purchase_refund')),
  ref_type text,
  ref_id uuid,
  note text,
  idempotency_key text not null unique,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);
create index coin_ledger_user on public.coin_ledger (user_id, created_at desc);

create table public.coin_packs (
  id text primary key, -- equals the Play / App Store product id
  name text not null,
  coins int not null,
  bonus_coins int not null default 0,
  price_paise int not null,
  tag text,
  active boolean not null default true,
  sort int not null default 0
);
insert into public.coin_packs (id, name, coins, bonus_coins, price_paise, tag, sort) values
  ('coins_starter', 'Starter', 40, 0, 3000, null, 1),
  ('coins_basic', 'Basic', 140, 10, 9900, 'Popular', 2),
  ('coins_plus', 'Plus', 440, 60, 29900, 'Best value', 3),
  ('coins_max', 'Max', 1550, 250, 99900, null, 4);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  pack_id text references public.coin_packs,
  platform text check (platform in ('android', 'ios', 'web')),
  purchase_token text unique,
  order_id text,
  price_paise int not null,
  coins_granted int not null,
  status text not null default 'verified' check (status in ('verified', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

-- ───────── Earnings (hosts) ─────────
create table public.earnings_ledger (
  id bigserial primary key,
  host_id uuid not null references public.hosts on delete cascade,
  delta_paise bigint not null,
  reason text not null check (reason in ('call_earning', 'gift_earning', 'bonus', 'payout', 'payout_reversal', 'clawback', 'adjust')),
  ref_type text,
  ref_id uuid,
  meta jsonb not null default '{}',
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index earnings_ledger_host on public.earnings_ledger (host_id, created_at desc);

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  tds_paise bigint not null default 0,
  net_paise bigint not null,
  method text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  note text,
  decided_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ───────── Calls ─────────
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles on delete cascade,
  host_id uuid not null references public.hosts on delete cascade,
  type text not null check (type in ('audio', 'video')),
  language text,
  state text not null default 'ringing' check (state in ('ringing', 'active', 'ended', 'missed', 'declined', 'cancelled')),
  rate_coins_per_min int not null,
  host_share_bps int not null,
  coin_value_paise int not null,
  agora_channel text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  billed_minutes int not null default 0,
  coins_charged int not null default 0,
  refunded_coins int not null default 0,
  gift_coins int not null default 0,
  host_earned_paise bigint not null default 0,
  end_reason text check (end_reason in ('caller_hangup', 'host_hangup', 'low_balance', 'timeout', 'network', 'moderation', 'declined', 'admin')),
  ended_by uuid
);
create index call_sessions_caller on public.call_sessions (caller_id, created_at desc);
create index call_sessions_host on public.call_sessions (host_id, created_at desc);
create index call_sessions_live on public.call_sessions (state) where state in ('ringing', 'active');
-- One live call per person at a time.
create unique index one_live_call_per_caller on public.call_sessions (caller_id) where state in ('ringing', 'active');
create unique index one_live_call_per_host on public.call_sessions (host_id) where state in ('ringing', 'active');

create table public.gifts (
  id text primary key,
  name text not null,
  coins int not null,
  active boolean not null default true,
  sort int not null default 0
);
insert into public.gifts (id, name, coins, sort) values
  ('rose', 'Rose', 10, 1), ('coffee', 'Coffee', 20, 2), ('heart', 'Big heart', 30, 3), ('star', 'Star', 50, 4), ('diamond', 'Diamond', 100, 5);

create table public.gift_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.call_sessions on delete cascade,
  from_user uuid not null references public.profiles on delete cascade,
  to_host uuid not null references public.hosts on delete cascade,
  gift_id text not null references public.gifts,
  coins int not null,
  host_earned_paise bigint not null,
  created_at timestamptz not null default now()
);

-- ───────── Feedback, safety ─────────
create table public.ratings (
  session_id uuid primary key references public.call_sessions on delete cascade,
  rater_id uuid not null references public.profiles on delete cascade,
  host_id uuid not null references public.hosts on delete cascade,
  stars int not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index ratings_host on public.ratings (host_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  reporter_role text not null check (reporter_role in ('user', 'host')),
  target_id uuid not null references public.profiles on delete cascade,
  target_role text not null check (target_role in ('user', 'host')),
  session_id uuid references public.call_sessions on delete set null,
  category text not null check (category in ('sexual_content', 'harassment', 'abuse', 'fraud', 'underage', 'sharing_contacts', 'spam', 'other')),
  details text not null default '',
  severity smallint not null check (severity between 1 and 4),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  decision text check (decision in ('dismiss', 'warn', 'strike', 'suspend', 'ban')),
  resolution text,
  resolved_by uuid references public.profiles,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.favorites (
  user_id uuid not null references public.profiles on delete cascade,
  host_id uuid not null references public.hosts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, host_id)
);

create table public.device_tokens (
  user_id uuid not null references public.profiles on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- Every admin action: who, what, why. `action` is a translation key; `vars` fills it in.
create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid references public.profiles on delete set null,
  actor_email text not null default 'system',
  action text not null,
  target_type text not null,
  target_id text not null,
  vars jsonb,
  detail text not null default ''
);

-- ───────── Row level security ─────────
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.hosts enable row level security;
alter table public.host_private enable row level security;
alter table public.host_active_days enable row level security;
alter table public.wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.coin_packs enable row level security;
alter table public.purchases enable row level security;
alter table public.earnings_ledger enable row level security;
alter table public.payout_requests enable row level security;
alter table public.call_sessions enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_events enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.favorites enable row level security;
alter table public.device_tokens enable row level security;
alter table public.audit_log enable row level security;

-- Readable by every signed-in person.
create policy "config readable" on public.app_config for select to authenticated using (true);
create policy "packs readable" on public.coin_packs for select to authenticated using (true);
create policy "gifts readable" on public.gifts for select to authenticated using (true);
-- Approved hosts are public (presence, bio, level); applicants see their own row; admins see all.
create policy "hosts readable" on public.hosts for select to authenticated using (approval_status = 'approved' or id = auth.uid() or public.is_admin());

-- Own rows only (admins read everything). All writes go through security-definer functions.
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "own kyc" on public.host_private for select to authenticated using (host_id = auth.uid() or public.is_admin());
create policy "own active days" on public.host_active_days for select to authenticated using (host_id = auth.uid() or public.is_admin());
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own coin ledger" on public.coin_ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own purchases" on public.purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own earnings" on public.earnings_ledger for select to authenticated using (host_id = auth.uid() or public.is_admin());
create policy "own payouts" on public.payout_requests for select to authenticated using (host_id = auth.uid() or public.is_admin());
create policy "call parties" on public.call_sessions for select to authenticated using (caller_id = auth.uid() or host_id = auth.uid() or public.is_admin());
create policy "gift parties" on public.gift_events for select to authenticated using (from_user = auth.uid() or to_host = auth.uid() or public.is_admin());
create policy "rating parties" on public.ratings for select to authenticated using (rater_id = auth.uid() or host_id = auth.uid() or public.is_admin());
create policy "own reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "audit admins" on public.audit_log for select to authenticated using (public.is_admin());

-- Blocks and favourites are simple personal lists the client manages directly.
create policy "own blocks read" on public.blocks for select to authenticated using (blocker_id = auth.uid() or public.is_admin());
create policy "own blocks add" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "own blocks remove" on public.blocks for delete to authenticated using (blocker_id = auth.uid());
create policy "own favorites read" on public.favorites for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own favorites add" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "own favorites remove" on public.favorites for delete to authenticated using (user_id = auth.uid());
create policy "own tokens" on public.device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
