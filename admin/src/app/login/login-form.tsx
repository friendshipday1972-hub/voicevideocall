'use client';

import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useActionState, useState } from 'react';

import { login, type LoginState } from '@/app/actions/auth';
import { inputClass } from '@/components/ui';

export function LoginForm({ showDemoHint }: { showDemoHint: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-fg-2">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={`${inputClass} h-11`} placeholder="you@company.com" aria-invalid={!!state?.error} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-fg-2">
          Password
        </label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className={`${inputClass} h-11 pr-11`} aria-invalid={!!state?.error} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 grid size-9 cursor-pointer place-items-center rounded-md text-fg-3 hover:text-fg">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="mt-1 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand font-medium text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {showDemoHint && (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-fg-3">
          Dev demo login: <span className="font-medium text-fg-2">admin@baatein.app</span> / <span className="font-medium text-fg-2">Baatein@2026</span>. Change it in <code>.env.local</code>.
        </p>
      )}
    </form>
  );
}
