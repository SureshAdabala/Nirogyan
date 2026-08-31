'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useAdminSession } from './AdminSessionProvider';

export function AdminGate({ children }: Readonly<{ children: ReactNode }>) {
  const { admin, loading, error } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !admin) {
      const next = pathname.startsWith('/admin') ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/admin/login${next}`);
    }
  }, [admin, loading, pathname, router]);

  if (loading)
    return (
      <main className="admin-loading" id="main-content">
        <p>Checking the secure admin session…</p>
      </main>
    );
  if (!admin)
    return (
      <main className="admin-loading" id="main-content">
        <p>{error ?? 'Redirecting to sign in…'}</p>
      </main>
    );
  return children;
}
