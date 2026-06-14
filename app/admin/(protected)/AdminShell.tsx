'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: Array<[string, string]> = [
  ['/admin', 'Dashboard'],
  ['/admin/prospects', 'Find Prospects'],
  ['/admin/crm', 'CRM'],
  ['/admin/customers', 'Customer List'],
  ['/admin/pricing', 'Pricing'],
  ['/admin/revenue', 'Revenue'],
];

const STORAGE_KEY = 'hydra-sidebar-collapsed';

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the saved state after mount (avoids a server/client hydration gap).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* private mode — ignore */
      }
      return next;
    });
  }

  return (
    <div className={`admin${collapsed ? ' admin--collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <button
          className="admin-collapse"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '»' : '«'}
        </button>
        <div className="admin-brand">
          <span className="admin-mark">H</span>
          <span className="admin-brand-text">Hydra Admin</span>
        </div>
        <nav className="admin-nav">
          {NAV.map(([href, label]) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? 'active' : undefined} title={label}>
                {label}
              </Link>
            );
          })}
        </nav>
        <form action="/api/admin/logout" method="post" className="admin-logout">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
