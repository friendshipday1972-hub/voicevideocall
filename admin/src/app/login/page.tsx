import type { Metadata } from 'next';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-rose-600 via-rose-500 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/20 font-display font-bold">B</span>
          <span className="font-display text-lg font-semibold">Baatein Admin</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">Run a safe, trusted calling community.</h1>
          <p className="mt-4 text-white/85">Track every call and payment, verify hosts, act on reports and spotlight the people callers love.</p>
        </div>
        <p className="text-sm text-white/70">Restricted area. All actions are logged.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-lg font-semibold">Baatein Admin</span>
          </div>
          <h2 className="font-display text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-fg-2">Use your admin email and password.</p>
          <LoginForm showDemoHint={process.env.NODE_ENV !== 'production'} />
        </div>
      </section>
    </main>
  );
}
