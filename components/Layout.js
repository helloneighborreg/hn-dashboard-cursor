import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, CalendarDays, Calendar, CheckSquare,
  DollarSign, LogOut, Menu, X, ChevronRight, ChevronDown, TrendingUp, Receipt, CircleCheckBig,
  UserX, UserCheck, AlertCircle, ClipboardList, Package, Wrench, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from './AuthContext';
import { useTaskCounts } from './TaskCountsContext';
import { BrandLogo } from './Logo';
import { homePathForRole, navItemsForRole, roleLabel } from '../lib/roles';
import { taskCountKeyForHref } from '../lib/taskCounts';

const NAV_ICONS = {
  '/dashboard': LayoutDashboard,
  '/properties': Building2,
  '/calendar': Calendar,
  '/reservations': CalendarDays,
  '/tasks': CheckSquare,
  '/tasks/unassigned': UserX,
  '/tasks/assigned': UserCheck,
  '/tasks/overdue': AlertCircle,
  '/tasks/completed': CircleCheckBig,
  '/financials': DollarSign,
  '/income': TrendingUp,
  '/expenses': Receipt,
  '/forms': ClipboardList,
  '/forms/extra-charge': DollarSign,
  '/forms/supply-request': Package,
  '/forms/maintenance-request': Wrench,
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

function NavChildLink({ child, pathname, onNavigate, count }) {
  const ChildIcon = child.icon;
  const childActive = !child.externalUrl && isNavActive(pathname, child.href);
  const className = clsx(navLinkClass(childActive), 'mt-0.5 ml-4');

  const content = (
    <>
      <ChildIcon size={16} className={clsx(childActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
      {child.label}
      {count != null && (
        <span
          className={clsx(
            'ml-auto text-xs font-semibold tabular-nums rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center',
            childActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 group-hover:text-white/80',
          )}
        >
          {count}
        </span>
      )}
      {child.externalUrl && (
        <ExternalLink size={12} className="ml-auto opacity-50 group-hover:opacity-80 flex-shrink-0" />
      )}
      {childActive && count == null && !child.externalUrl && (
        <ChevronRight size={14} className="ml-auto" />
      )}
    </>
  );

  if (child.externalUrl) {
    return (
      <a
        href={child.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={child.href} onClick={onNavigate} className={className}>
      {content}
    </Link>
  );
}

function NavSection({ item, childItems, pathname, expanded, onToggle, onNavigate, taskCounts }) {
  const Icon = item.icon;
  const childActive = childItems.some((child) => !child.externalUrl && isNavActive(pathname, child.href));
  const parentActive = !item.toggleOnly && isNavActive(pathname, item.href);
  const highlightParent = parentActive && !childActive;

  if (item.toggleOnly) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={clsx(navLinkClass(false), 'w-full')}
        >
          <Icon size={18} className="text-white/50 group-hover:text-white" />
          {item.label}
          {expanded
            ? <ChevronDown size={16} className="ml-auto text-white/50" />
            : <ChevronRight size={16} className="ml-auto text-white/50" />}
        </button>
        {expanded && childItems.map((child) => {
          const countKey = item.href === '/tasks' ? taskCountKeyForHref(child.href) : null;
          return (
            <NavChildLink
              key={child.href}
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
              count={countKey ? (taskCounts?.[countKey] ?? 0) : undefined}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={item.href}
          onClick={onNavigate}
          className={clsx(navLinkClass(highlightParent), 'flex-1 min-w-0')}
        >
          <Icon size={18} className={clsx(highlightParent || childActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
          {item.label}
          {highlightParent && <ChevronRight size={14} className="ml-auto" />}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label} menu`}
          className="flex-shrink-0 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      {expanded && childItems.map((child) => {
        const countKey = item.href === '/tasks' ? taskCountKeyForHref(child.href) : null;
        return (
          <NavChildLink
            key={child.href}
            child={child}
            pathname={pathname}
            onNavigate={onNavigate}
            count={countKey ? (taskCounts?.[countKey] ?? 0) : undefined}
          />
        );
      })}
    </div>
  );
}

export default function Layout({ children, title }) {
  const router = useRouter();
  const { user } = useAuth();
  const { counts: taskCounts } = useTaskCounts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  const navItems = useMemo(
    () => navItemsForRole(user?.role).map((item) => ({
      ...item,
      icon: NAV_ICONS[item.href] || Building2,
    })),
    [user?.role],
  );

  const parentItems = useMemo(
    () => navItems.filter((item) => !item.parent),
    [navItems],
  );

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const item of parentItems) {
        const childItems = navItems.filter((child) => child.parent === item.href);
        if (!childItems.length) continue;
        const childActive = childItems.some(
          (child) => !child.externalUrl && isNavActive(router.pathname, child.href),
        );
        const parentActive = !item.toggleOnly && isNavActive(router.pathname, item.href);
        if (childActive || parentActive) next[item.href] = true;
      }
      return next;
    });
  }, [router.pathname, navItems, parentItems]);

  function isSectionExpanded(parentHref, childItems, toggleOnly) {
    if (expandedSections[parentHref] !== undefined) return expandedSections[parentHref];
    if (toggleOnly) return false;
    return childItems.some((child) => !child.externalUrl && isNavActive(router.pathname, child.href))
      || isNavActive(router.pathname, parentHref);
  }

  function toggleSection(parentHref, childItems, toggleOnly) {
    setExpandedSections((prev) => ({
      ...prev,
      [parentHref]: !isSectionExpanded(parentHref, childItems, toggleOnly),
    }));
  }

  const closeSidebar = () => setSidebarOpen(false);

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
          {parentItems.map((item) => {
            const childItems = navItems.filter((child) => child.parent === item.href);

            if (childItems.length > 0) {
              return (
                <NavSection
                  key={item.href}
                  item={item}
                  childItems={childItems}
                  pathname={router.pathname}
                  expanded={isSectionExpanded(item.href, childItems, item.toggleOnly)}
                  onToggle={() => toggleSection(item.href, childItems, item.toggleOnly)}
                  onNavigate={closeSidebar}
                  taskCounts={taskCounts}
                />
              );
            }

            const Icon = item.icon;
            const active = isNavActive(router.pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={navLinkClass(active)}
              >
                <Icon size={18} className={clsx(active ? 'text-white' : 'text-white/50 group-hover:text-white')} />
                {item.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
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
