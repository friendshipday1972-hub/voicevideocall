'use client';

import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { LanguageSwitch } from '@/components/language';
import { inputClass } from '@/components/ui';
import { useT } from '@/i18n';
import { isAdminSession } from '@/lib/admin-session';
import { supabase } from '@/lib/supabase';

type LoginError = 'email' | 'password' | 'wrong' | 'notAdmin' | 'network';

/** The whole sign-in screen is client-rendered so it follows the chosen language (switch in the top corner). */
export function LoginScreen() {
  const t = useT();
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-rose-600 via-rose-500 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/20 font-display font-bold">B</span>
          <span className="font-display text-lg font-semibold">Baatein {t('shell.admin')}</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">{t('login.tagline')}</h1>
          <p className="mt-4 text-white/85">{t('login.pitch')}</p>
        </div>
        <p className="text-sm text-white/70">{t('login.restricted')}</p>
      </section>
      <section className="relative flex items-center justify-center p-6">
        <LanguageSwitch className="absolute right-4 top-4" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-violet-600 font-display font-bold text-white">B</span>
            <span className="font-display text-lg font-semibold">Baatein {t('shell.admin')}</span>
          </div>
          <h2 className="font-display text-2xl font-semibold">{t('login.title')}</h2>
          <p className="mt-1 text-sm text-fg-2">{t('login.subtitle')}</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  // Already signed in as an admin: go straight to the dashboard.
  useEffect(() => {
    isAdminSession().then((ok) => ok && router.replace('/'));
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('email');
    if (!password) return setError('password');
    setPending(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authError) {
      setPending(false);
      return setError(/fetch|network/i.test(authError.message) ? 'network' : 'wrong');
    }
    if (!(await isAdminSession())) {
      await supabase.auth.signOut();
      setPending(false);
      return setError('notAdmin');
    }
    router.replace('/');
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-fg-2">
          {t('login.email')}
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} h-11`} placeholder="you@company.com" aria-invalid={!!error} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-fg-2">
          {t('login.password')}
        </label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} h-11 pr-11`} aria-invalid={!!error} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t('login.hidePassword') : t('login.showPassword')} className="absolute right-1 top-1 grid size-9 cursor-pointer place-items-center rounded-md text-fg-3 hover:text-fg">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {t(`login.err.${error}`)}
        </p>
      )}
      <button type="submit" disabled={pending} className="mt-1 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand font-medium text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  );
}
