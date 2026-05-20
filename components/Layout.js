import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, Building2, CalendarDays, Calendar, CheckSquare,
  DollarSign, LogOut, Menu, X, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/properties',   label: 'Properties',   icon: Building2 },
  { href: '/calendar',     label: 'Calendar',     icon: Calendar },
  { href: '/reservations', label: 'Reservations', icon: CalendarDays },
  { href: '/tasks',        label: 'Tasks',         icon: CheckSquare },
  { href: '/financials',   label: 'Financials',   icon: DollarSign },
];

export default function Layout({ children, title }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-bg flex overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 bg-dark flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">HN</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Hello Neighbor</p>
                <p className="text-brand-300 text-xs">Real Estate Group</p>
              </div>
            </div>
          </Link>
          <button
            className="lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = router.pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  active
                    ? 'bg-brand-500 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} className={clsx(active ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">JB</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">Josiah Burton</p>
              <p className="text-white/40 text-xs truncate">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full lg:ml-0">
        {/* Top bar (mobile) */}
        <header className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-dark hover:text-brand-500 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">HN</span>
            </div>
            <span className="font-semibold text-dark text-sm">{title || 'Hello Neighbor'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 w-full max-w-full p-4 lg:p-8 overflow-y-auto overflow-x-hidden">
          {title && (
            <h1 className="text-xl font-bold text-dark mb-6 hidden lg:block">{title}</h1>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
