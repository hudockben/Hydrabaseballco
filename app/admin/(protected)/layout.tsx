import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import AdminShell from './AdminShell';
import '@/app/admin/admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  return <AdminShell>{children}</AdminShell>;
}
