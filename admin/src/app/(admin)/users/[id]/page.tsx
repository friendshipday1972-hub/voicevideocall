import { Suspense } from 'react';

import UserDetail from './user-detail';

/** The id comes from the URL, so the client view streams in behind a boundary (Cache Components). */
export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" aria-label="Loading" />}>
      <UserDetail />
    </Suspense>
  );
}
