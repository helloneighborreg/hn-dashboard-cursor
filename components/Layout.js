import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, CalendarDays, Calendar, CheckSquare,
  DollarSign, LogOut, Menu, X, ChevronRight, TrendingUp, Receipt,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from './AuthContext';
import { BrandLogo } from './Logo';
import { homePathForRole, navItemsForRole, roleLabel } from '../lib/roles';

const NAV_ICONS = {
  '/dashboard': LayoutDashboard,
  '/properties': Building2,
  '/calendar': Calendar,
  '/reservations': CalendarDays,
  '/tasks': CheckSquare,
  '/financials': DollarSign,
  '/income': TrendingUp,
  '/expenses': Receipt,
};

function navLinkClass(active) {
  return clsx(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
    active
      ? 'bg-brand-500 text-white'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
  );
}

function isNavActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function userInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Layout({ children, title }) {
  const router = useRouter();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(
    () => navItemsForRole(user?.role).map((item) => ({
      ...item,
      icon: NAV_ICONS[item.href] || Building2,
    })),
    [user?.role],
  );

  const homeHref = user ? homePathForRole(user.role) : '/';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-bg flex overflow-x-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 bg-dark flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <BrandLogo
            variant="sidebar"
            href={homeHref}
            onClick={() => setSidebarOpen(false)}
          />
          <button
            className="lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.filter((item) => !item.parent).map((item) => {
            const Icon = item.icon;
            const active = isNavActive(router.pathname, item.href);
            const childItems = navItems.filter((child) => child.parent === item.href);

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={navLinkClass(active && !childItems.some((child) => isNavActive(router.pathname, child.href)))}
                >
                  <Icon size={18} className={clsx(active ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                  {item.label}
                  {active && !childItems.some((child) => isNavActive(router.pathname, child.href)) && (
                    <ChevronRight size={14} className="ml-auto" />
                  )}
                </Link>

                {childItems.map((child) => {
                  const ChildIcon = child.icon;
                  const childActive = isNavActive(router.pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setSidebarOpen(false)}
                      className={clsx(navLinkClass(childActive), 'mt-0.5 ml-4')}
                    >
                      <ChildIcon size={16} className={clsx(childActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                      {child.label}
                      {childActive && <ChevronRight size={14} className="ml-auto" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{userInitials(user.name)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-white/40 text-xs truncate">{roleLabel(user.role)}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full lg:ml-0">
        <header className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-dark hover:text-brand-500 transition-colors"
          >
            <Menu size={22} />
          </button>
          <BrandLogo variant="header" title={title} />
        </header>

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
