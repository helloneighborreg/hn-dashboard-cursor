import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, CalendarDays, Calendar, CheckSquare,
  DollarSign, LogOut, Menu, X, ChevronRight, ChevronDown, Tags, FileBarChart, Wallet,
  UserX, UserCheck, AlertCircle, CircleCheckBig, ClipboardList, Package, ExternalLink,
  PanelLeftClose, PanelLeft, Warehouse, ShoppingCart, Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from './AuthContext';
import { useTaskCounts } from './TaskCountsContext';
import { BrandLogo } from './Logo';
import AppActionBar from './AppActionBar';
import { homePathForRole, navItemsForRole, roleLabel } from '../lib/roles';
import { fetchJson } from '../lib/apiClient';

const SIDEBAR_COLLAPSED_KEY = 'hn-sidebar-collapsed';

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
  '/transactions': Tags,
  '/reports': FileBarChart,
  '/billpay': Wallet,
  '/forms': ClipboardList,
  '/forms/cjc-turn-clean-checklist': ClipboardList,
  '/settings/checklists': ClipboardList,
  '/supplies': Package,
  '/supplies/inventory': Warehouse,
  '/supplies/order': ShoppingCart,
  '/settings': Settings,
  '/settings/permissions': Settings,
};

function navLinkClass(active, collapsed) {
  return clsx(
    'flex items-center rounded-lg text-sm font-medium transition-colors group',
    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
    active
      ? 'bg-brand-500 text-white'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
  );
}

function NavTooltip({ label, collapsed, children }) {
  if (!collapsed) return children;
  return (
    <div className="relative group/tip w-full">
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2',
          'whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg',
          'opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100',
        )}
      >
        {label}
      </span>
    </div>
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

function taskNavCount(href, taskCounts) {
  if (href === '/tasks/unassigned') return taskCounts?.unassigned ?? 0;
  if (href === '/tasks/assigned') return taskCounts?.assigned ?? 0;
  if (href === '/tasks/overdue') return taskCounts?.overdue ?? 0;
  return undefined;
}

function NavChildLink({ child, pathname, onNavigate, count, collapsed }) {
  const ChildIcon = child.icon;
  const childActive = !child.externalUrl && isNavActive(pathname, child.href);
  const className = clsx(navLinkClass(childActive, collapsed), collapsed ? 'mt-0.5' : 'mt-0.5 ml-4');

  const content = (
    <>
      <ChildIcon size={collapsed ? 18 : 16} className={clsx(childActive ? 'text-white' : 'text-white/50 group-hover:text-white flex-shrink-0')} />
      {!collapsed && child.label}
      {!collapsed && count != null && (
        <span
          className={clsx(
            'ml-auto text-xs font-semibold tabular-nums rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center',
            childActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 group-hover:text-white/80',
          )}
        >
          {count}
        </span>
      )}
      {!collapsed && child.externalUrl && (
        <ExternalLink size={12} className="ml-auto opacity-50 group-hover:opacity-80 flex-shrink-0" />
      )}
      {!collapsed && childActive && count == null && !child.externalUrl && (
        <ChevronRight size={14} className="ml-auto" />
      )}
      {collapsed && count != null && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-400" aria-hidden />
      )}
    </>
  );

  const link = child.externalUrl ? (
    <a
      href={child.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className={clsx(className, collapsed && 'relative')}
    >
      {content}
    </a>
  ) : (
    <Link href={child.href} onClick={onNavigate} className={clsx(className, collapsed && 'relative')}>
      {content}
    </Link>
  );

  return (
    <NavTooltip label={child.label} collapsed={collapsed}>
      {link}
    </NavTooltip>
  );
}

function NavSection({
  item,
  childItems,
  pathname,
  expanded,
  onToggle,
  onNavigate,
  taskCounts,
  collapsed,
  onExpandSidebar,
}) {
  const Icon = item.icon;
  const childActive = childItems.some((child) => !child.externalUrl && isNavActive(pathname, child.href));
  const parentActive = !item.toggleOnly && isNavActive(pathname, item.href);
  const highlightParent = parentActive && !childActive;
  const sectionActive = highlightParent || childActive;

  function handleCollapsedSectionClick() {
    onExpandSidebar();
    if (!expanded) onToggle();
  }

  if (collapsed) {
    const collapsedButton = (
      <button
        type="button"
        onClick={handleCollapsedSectionClick}
        className={clsx(navLinkClass(sectionActive, true), 'w-full')}
        aria-label={`${item.label} — expand sidebar`}
      >
        <Icon size={18} className={clsx(sectionActive ? 'text-white' : 'text-white/50 group-hover:text-white')} />
      </button>
    );

    return (
      <NavTooltip label={item.label} collapsed>
        {collapsedButton}
      </NavTooltip>
    );
  }

  if (item.toggleOnly) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={clsx(navLinkClass(false, false), 'w-full')}
        >
          <Icon size={18} className="text-white/50 group-hover:text-white" />
          {item.label}
          {expanded
            ? <ChevronDown size={16} className="ml-auto text-white/50" />
            : <ChevronRight size={16} className="ml-auto text-white/50" />}
        </button>
        {expanded && childItems.map((child) => {
          const count = taskNavCount(child.href, taskCounts);
          return (
            <NavChildLink
              key={child.href}
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
              count={count}
              collapsed={false}
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
          className={clsx(navLinkClass(highlightParent, false), 'flex-1 min-w-0')}
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
        const count = taskNavCount(child.href, taskCounts);
        return (
          <NavChildLink
            key={child.href}
            child={child}
            pathname={pathname}
            onNavigate={onNavigate}
            count={count}
            collapsed={false}
          />
        );
      })}
    </div>
  );
}

export default function Layout({ children, title }) {
  const router = useRouter();
  const { user, navPermissions } = useAuth();
  const { counts: taskCounts } = useTaskCounts();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarCollapsedDesktop, setSidebarCollapsedDesktop] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === 'true') setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setSidebarCollapsedDesktop(mq.matches && sidebarCollapsed);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [sidebarCollapsed]);

  const collapsed = sidebarCollapsedDesktop;

  function setCollapsed(next) {
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  function expandSidebar() {
    setCollapsed(false);
  }

  const navItems = useMemo(
    () => navItemsForRole(user?.role, navPermissions).map((item) => ({
      ...item,
      icon: NAV_ICONS[item.href] || Building2,
    })),
    [user?.role, navPermissions],
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

  const homeHref = user ? homePathForRole(user.role, navPermissions) : '/';

  async function handleLogout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST', redirectOn401: false });
    } catch {
      // Navigate to login regardless of logout response.
    }
    router.push('/');
  }

  return (
    <div
      className="h-screen overflow-hidden bg-bg flex"
      style={{ '--hn-sidebar-width': collapsed ? '4.5rem' : '16rem' }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'z-30 w-64 flex-shrink-0 bg-dark flex flex-col min-h-0 transition-all duration-300 overflow-hidden',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0',
          'lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0',
          collapsed && 'lg:w-[4.5rem]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className={clsx(
            'flex items-center border-b border-white/10',
            collapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-5',
          )}
        >
          <BrandLogo
            variant="sidebar"
            href={homeHref}
            onClick={() => setSidebarOpen(false)}
            compact={collapsed}
          />
          {!collapsed && (
            <button
              type="button"
              className="lg:hidden text-white/60 hover:text-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={clsx('hidden lg:block', collapsed ? 'px-2 py-2' : 'px-3 py-2')}>
          <NavTooltip
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            collapsed={collapsed}
          >
            <button
              type="button"
              onClick={() => setCollapsed(!sidebarCollapsed)}
              className={clsx(
                navLinkClass(false, collapsed),
                'w-full text-white/60 hover:text-white',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed
                ? <PanelLeft size={18} />
                : <PanelLeftClose size={18} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </NavTooltip>
        </div>

        <nav
          className={clsx(
            'flex-1 min-h-0 py-2 space-y-0.5',
            // Expanded: scroll vertically, clip horizontally (avoids a coerced overflow-x:auto
            // scrollbar). Collapsed: keep overflow visible so icon tooltips can escape the rail.
            collapsed ? 'px-2 overflow-visible' : 'px-3 overflow-y-auto overflow-x-hidden',
          )}
        >
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
                  collapsed={collapsed}
                  onExpandSidebar={expandSidebar}
                />
              );
            }

            const Icon = item.icon;
            const active = isNavActive(router.pathname, item.href);
            const link = (
              <Link
                href={item.href}
                onClick={closeSidebar}
                className={navLinkClass(active, collapsed)}
              >
                <Icon size={18} className={clsx(active ? 'text-white' : 'text-white/50 group-hover:text-white flex-shrink-0')} />
                {!collapsed && item.label}
                {!collapsed && active && item.href !== '/dashboard' && (
                  <ChevronRight size={14} className="ml-auto" />
                )}
              </Link>
            );
            return (
              <NavTooltip key={item.href} label={item.label} collapsed={collapsed}>
                {link}
              </NavTooltip>
            );
          })}
        </nav>

        <div className={clsx('border-t border-white/10 shrink-0', collapsed ? 'p-2' : 'p-4')}>
          {user && (
            <div
              className={clsx(
                'flex items-center mb-3',
                collapsed ? 'justify-center' : 'gap-3 px-2',
              )}
            >
              <NavTooltip label={user.name} collapsed={collapsed}>
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{userInitials(user.name)}</span>
                </div>
              </NavTooltip>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.name}</p>
                  <p className="text-white/40 text-xs truncate">{roleLabel(user.role)}</p>
                </div>
              )}
            </div>
          )}
          <NavTooltip label="Sign Out" collapsed={collapsed}>
            <button
              type="button"
              onClick={handleLogout}
              className={clsx(
                'w-full flex items-center rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
              )}
            >
              <LogOut size={collapsed ? 18 : 16} />
              {!collapsed && 'Sign Out'}
            </button>
          </NavTooltip>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full max-w-full overflow-hidden">
        <header
          className="bg-white border-b border-border px-4 pb-3 flex items-center gap-3 lg:hidden sticky top-0 z-10 shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-dark hover:text-brand-500 transition-colors"
          >
            <Menu size={22} />
          </button>
          <BrandLogo variant="header" title={title} />
        </header>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
          {user && (
            <div
              className="sticky top-0 z-20 shrink-0 bg-white/95 backdrop-blur-sm border-b border-border px-4 lg:px-8"
              style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
            >
              <AppActionBar />
            </div>
          )}
          {title && (
            <div className="shrink-0 px-4 pt-3 lg:px-8 lg:pt-4 hidden lg:block">
              <h1 className="text-xl sm:text-2xl font-bold text-dark">{title}</h1>
            </div>
          )}
          <div
            className={clsx(
              'flex-1 min-w-0 w-full px-4 pb-4 lg:px-8 lg:pb-8',
              title ? 'pt-3' : 'pt-3 lg:pt-4',
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
