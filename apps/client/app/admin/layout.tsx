import type { Metadata } from 'next';

import { AdminSessionProvider } from '../../src/admin/auth/AdminSessionProvider';

import './admin.css';

export const metadata: Metadata = {
  title: 'Calculator Studio',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminSessionProvider>{children}</AdminSessionProvider>;
}
