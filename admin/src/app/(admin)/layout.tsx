import { Suspense } from 'react';

import { AdminIdentity, AdminShell } from '@/components/shell';
import { getCurrentAdmin } from '@/lib/auth/session';

/**
 * Every admin page. The proxy already blocks signed-out requests; this verifies the session
 * again on the server (Data Access Layer) behind a Suspense boundary, as Cache Components requires.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell
      identity={
        <Suspense fallback={<span className="h-9 w-40 animate-pulse rounded-lg bg-surface-2" aria-hidden />}>
          <VerifiedAdmin />
        </Suspense>
      }>
      {children}
    </AdminShell>
  );
}

async function VerifiedAdmin() {
  const admin = await getCurrentAdmin();
  return <AdminIdentity email={admin.email} />;
}
