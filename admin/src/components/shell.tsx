'use client';

import {
  Activity,
  BadgeCheck,
  CreditCard,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Moon,
  PhoneCall,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { logout } from '@/app/actions/auth';
import { useT, type TKey } from '@/i18n';
import { useAdmin, useAdminHydrated } from '@/lib/data/store';

import { LanguageSwitch } from './language';
import { Avatar, Toaster, cx } from './ui';

type NavItem = { href: string; label: TKey; icon: LucideIcon; badge?: (s: ReturnType<typeof useAdmin.getState>) => number; urgent?: boolean };

const NAV: { group: TKey | null; items: NavItem[] }[] = [
  { group: null, items: [{ href: '/', label: 'nav.overview', icon: LayoutDashboard }] },
  {
    group: 'nav.people',
    items: [
      { href: '/users', label: 'nav.callers', icon: UsersRound },
      { href: '/hosts', label: 'nav.hosts', icon: UserRound },
      { href: '/applications', label: 'nav.kyc', icon: BadgeCheck, badge: (s) => s.applications.filter((a) => a.status === 'pending').length },
    ],
  },
  {
    group: 'nav.activity',
    items: [
      { href: '/calls', label: 'nav.calls', icon: PhoneCall },
      { href: '/payments', label: 'nav.payments', icon: CreditCard, badge: (s) => s.payouts.filter((p) => p.status === 'requested').length },
      { href: '/reviews', label: 'nav.reviews', icon: MessageSquareQuote },
      { href: '/reports', label: 'nav.reports', icon: Flag, urgent: true, badge: (s) => s.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length },
    ],
  },
  { group: 'nav.growth', items: [{ href: '/spotlight', label: 'nav.spotlight', icon: Sparkles }] },
  {
    group: 'nav.system',
    items: [
      { href: '/activity', label: 'nav.activityLog', icon: Activity },
      { href: '/settings', label: 'nav.settings', icon: Settings },
    ],
  },
];

/** The active item depends on the URL, so it streams in behind Suspense; the fallback is the same nav unhighlighted. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname="" onNavigate={onNavigate} />}>
      <NavWithPath onNavigate={onNavigate} />
    </Suspense>
  );
}

function NavWithPath({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const state = useAdmin();
  const hydrated = useAdminHydrated();
  const t = useT();
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-4">
      {NAV.map((g) => (
        <div key={g.group ?? 'main'}>
          {g.group && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{t(g.group)}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = pathname !== '' && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));
              const count = hydrated && item.badge ? item.badge(state) : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors', active ? 'bg-brand-soft font-medium text-brand' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}>
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{t(item.label)}</span>
                    {count > 0 && (
                      <span className={cx('tabular rounded-full px-1.5 text-xs font-semibold', item.urgent ? 'bg-bad text-white' : 'bg-surface-2 text-fg-2')} aria-label={t('common.pending', { n: count })}>
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  const t = useT();
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-violet-600 font-display text-sm font-bold text-white">B</span>
      <span className="font-display text-[15px] font-semibold">
        Baatein <span className="font-normal text-fg-3">{t('shell.admin')}</span>
      </span>
    </Link>
  );
}

function GlobalSearch() {
  const users = useAdmin((s) => s.users);
  const hosts = useAdmin((s) => s.hosts);
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const match = (...fields: string[]) => fields.some((f) => f.toLowerCase().replace(/\s/g, '').includes(term.replace(/\s/g, '')));
    return [
      ...hosts.filter((h) => match(h.name, h.phone, h.id, h.city)).map((h) => ({ href: `/hosts/${h.id}`, label: h.name, sub: t('shell.hostIn', { city: h.city }) })),
      ...users.filter((u) => match(u.name, u.phone, u.id, u.city)).map((u) => ({ href: `/users/${u.id}`, label: u.name, sub: t('shell.callerPhone', { phone: u.phone }) })),
    ].slice(0, 8);
  }, [q, users, hosts, t]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('shell.searchPlaceholder')}
        aria-label={t('shell.searchLabel')}
        className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm placeholder:text-fg-3 focus:border-data focus:bg-surface focus:outline-none"
      />
      {results.length > 0 && (
        <ul className="animate-in fixed inset-x-3 top-14 z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-xl sm:absolute sm:inset-x-0 sm:top-11">
          {results.map((r) => (
            <li key={r.href}>
              <button
                onClick={() => {
                  setQ('');
                  router.push(r.href);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                <Avatar name={r.label} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                <span className="shrink-0 text-xs text-fg-3">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    mq.removeEventListener('change', cb);
    mo.disconnect();
  };
}
const themeSnapshot = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

function ThemeToggle({ className }: { className?: string }) {
  // Server render assumes light; the client value takes over after hydration without a mismatch.
  const isDark = useSyncExternalStore(subscribeTheme, themeSnapshot, () => false);
  const t = useT();
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('admin-theme', next);
    } catch {}
  };
  return (
    <button onClick={toggle} aria-label={isDark ? t('shell.themeLight') : t('shell.themeDark')} className={cx('size-9 cursor-pointer place-items-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg', className ?? 'grid')}>
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}

/** Signed-in admin chip + logout. Rendered inside a Suspense boundary by the server layout. */
export function AdminIdentity({ email }: { email: string }) {
  const setActor = useAdmin((s) => s.setActor);
  const t = useT();
  useEffect(() => setActor(email), [email, setActor]);
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-right text-xs leading-tight xl:block">
        <span className="block font-medium text-fg">{t('shell.superAdmin')}</span>
        <span className="text-fg-3">{email}</span>
      </span>
      <form action={logout}>
        <button type="submit" aria-label={t('shell.logout')} title={t('shell.logout')} className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-bad">
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/**
 * Each page renders inside this, so the page itself always renders (a skeleton first, then the
 * real view once the browser copy of the data has loaded, never a flash of the fresh seed).
 */
export function Ready({ children }: { children: ReactNode }) {
  const hydrated = useAdminHydrated();
  const t = useT();
  if (!hydrated)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  return <>{children}</>;
}

export function AdminShell({ identity, children }: { identity: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface py-5 lg:flex">
        <Brand />
        <div className="px-2">
          <NavLinks />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[var(--scrim)]" onClick={() => setOpen(false)} aria-hidden />
          <aside className="animate-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-surface py-5" aria-label={t('nav.navigation')}>
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')} className="grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-2">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-3 pt-4 sm:hidden">
              <LanguageSwitch />
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button onClick={() => setOpen(true)} aria-label={t('nav.openMenu')} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-surface-2 lg:hidden">
            <Menu className="size-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <LanguageSwitch />
            <ThemeToggle className="hidden sm:grid" />
            {identity}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
