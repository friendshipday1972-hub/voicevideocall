import { AdminGate } from '@/components/admin-gate';

/**
 * Every admin page. The gate checks for a signed-in admin in the browser; the data itself is
 * protected by row level security in the database, so nothing loads without an admin session.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
