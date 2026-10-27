'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { currentAdminEmail } from '@/lib/admin-session';
import { useAdmin } from '@/lib/data/store';
import { supabase } from '@/lib/supabase';

import { AdminIdentity, AdminShell } from './shell';

/** Sends anyone who isn't a signed-in admin to /login, and keeps the data live for those who are. */
export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    currentAdminEmail().then((who) => {
      if (!who) return router.replace('/login');
      setEmail(who);
      useAdmin.getState().setActor(who);
      stop = useAdmin.getState().start();
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });
    return () => {
      stop?.();
      data.subscription.unsubscribe();
    };
  }, [router]);

  return <AdminShell identity={email ? <AdminIdentity email={email} /> : <span className="h-9 w-40 animate-pulse rounded-lg bg-surface-2" aria-hidden />}>{children}</AdminShell>;
}
