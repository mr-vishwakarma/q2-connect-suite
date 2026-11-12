import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  LucideIcon,
  Menu,
  Settings,
  User as UserIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HosteliqLogo } from '@/components/common/HosteliqLogo';
import { QuickCommandSearch, SearchNavItem } from '@/components/layout/QuickCommandSearch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvatarUrl } from '@/utils/imageUtils';

export interface PortalNavLink {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string | number;
  featureKey?: string;
}

export interface PortalNavSection {
  title?: string;
  links: PortalNavLink[];
}

export interface PortalShellProps {
  children: ReactNode;
  portalName: string;
  portalSubtitle?: string;
  homeRoute: string;
  pageTitle: string;
  pageSubtitle?: string;
  breadcrumbSection?: string;
  sections: PortalNavSection[];
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  userRoleLabel: string;
  welcomeSubtext?: string;
  profileRoute?: string;
  onLogout: () => Promise<void> | void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  topBanner?: ReactNode;
  topBarRight?: ReactNode;
  bottomMobileNav?: ReactNode;
  floatingWidget?: ReactNode;
  onLinkHover?: (to: string) => void;
  hideSearch?: boolean;
  sidebarAriaLabel?: string;
}

export function PortalShell({
  children,
  portalName,
  portalSubtitle,
  homeRoute,
  pageTitle,
  pageSubtitle,
  breadcrumbSection = 'Overview',
  sections,
  userName,
  userEmail,
  userAvatar,
  userRoleLabel,
  welcomeSubtext,
  profileRoute,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onToggleMobile,
  onCloseMobile,
  topBanner,
  topBarRight,
  bottomMobileNav,
  floatingWidget,
  onLinkHover,
  hideSearch = false,
  sidebarAriaLabel = 'Portal Navigation',
}: PortalShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Body scroll lock for mobile drawer
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Escape closes mobile drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const firstNameOrFull = userName.trim() || 'User';

  const searchItems: SearchNavItem[] = sections.flatMap((sec) =>
    sec.links.map((l) => ({
      to: l.to,
      label: l.label,
      group: sec.title || portalName,
      icon: l.icon,
    })),
  );

  const resolvedPageTitle = pageTitle || 'Dashboard';

  const renderSidebarContent = (collapsed: boolean, mobileMode = false) => (
    <div className="flex flex-col h-full relative">
      {/* Header Row: Official Logo + Collapse Button */}
      <div
        className={cn(
          'px-4 pt-5 pb-3.5 flex items-center justify-between gap-2 shrink-0',
          collapsed && 'justify-center px-2',
        )}
      >
        <Link
          to={homeRoute}
          onClick={() => mobileMode && onCloseMobile()}
          className={cn('flex items-center min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60 rounded-lg', collapsed && 'justify-center')}
          aria-label={`${portalName} Home`}
        >
          {collapsed ? (
            <HosteliqLogo variant="mark" size="sm" />
          ) : (
            <HosteliqLogo variant="wordmark" size="sm" subtitle={portalSubtitle || portalName} />
          )}
        </Link>

        {mobileMode ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-8 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] text-[#9295AD] hover:text-[#F0EFF8] hover:bg-white/[0.08] flex items-center justify-center transition-colors shrink-0 lg:hidden"
            aria-label="Close navigation drawer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'hidden lg:flex w-7 h-7 rounded-full border border-white/[0.10] bg-white/[0.04] text-[#9295AD] hover:text-[#F0EFF8] hover:border-[rgba(210,195,255,0.24)] hover:bg-white/[0.08] items-center justify-center transition-all shrink-0',
              collapsed && 'mt-1',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Welcome Back Greeting Block (Quantix Reference Hierarchy) */}
      {!collapsed && (
        <div className="px-5 pt-2 pb-4 border-b border-white/[0.06] shrink-0">
          <p className="text-[13px] font-medium text-[#9295AD] leading-tight">Welcome Back,</p>
          <p className="text-[17px] font-bold tracking-tight text-[#F0EFF8] truncate mt-0.5">
            {firstNameOrFull}
          </p>
          <p className="text-[11px] text-[#74788F] mt-1 truncate">
            {welcomeSubtext || userRoleLabel}
          </p>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-scrollbar" aria-label={sidebarAriaLabel}>
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && section.title && (
              <p className="px-3 pt-1 pb-1 text-[11px] font-medium text-[#74788F] tracking-wide">
                {section.title}
              </p>
            )}

            {section.links.map((link) => {
              const Icon = link.icon;
              const isRootHome = link.to === homeRoute;
              const isActive =
                location.pathname === link.to ||
                (!isRootHome && location.pathname.startsWith(`${link.to}/`));

              const hasBadge =
                link.badge !== undefined &&
                link.badge !== null &&
                link.badge !== '' &&
                (typeof link.badge !== 'number' || link.badge > 0);

              return (
                <div key={link.to} className="relative group">
                  <Link
                    to={link.to}
                    onMouseEnter={() => onLinkHover?.(link.to)}
                    onFocus={() => onLinkHover?.(link.to)}
                    onClick={() => mobileMode && onCloseMobile()}
                    className={cn(
                      'flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 relative select-none text-[13px]',
                      collapsed ? 'justify-center px-2' : 'gap-3',
                      isActive
                        ? 'glass-nav-active font-semibold text-[#F0EFF8]'
                        : 'text-[#9295AD] font-medium hover:bg-white/[0.04] hover:text-[#F0EFF8] border border-transparent',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-[#A78BFA]' : 'text-[#9295AD] group-hover:text-[#F0EFF8]',
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate">{link.label}</span>}

                    {!collapsed && hasBadge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border',
                          typeof link.badge === 'number'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                            : 'bg-white/[0.06] text-[#9295AD] border-white/[0.08]',
                        )}
                      >
                        {link.badge}
                      </span>
                    )}

                    {/* Active Right-Edge Indicator Pill matching Reference */}
                    {!collapsed && isActive && (
                      <span
                        className="w-1 h-4 rounded-full bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.65)] shrink-0"
                        aria-hidden="true"
                      />
                    )}

                    {/* Collapsed Badge Dot */}
                    {collapsed && hasBadge && typeof link.badge === 'number' && (
                      <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-400" />
                    )}

                    {/* Collapsed Hover Tooltip */}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-[#1A1C2A] border border-[rgba(210,195,255,0.16)] text-[#F0EFF8] text-xs font-medium shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        {link.label}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-white/[0.06] shrink-0 space-y-1.5">
        {!collapsed && profileRoute && (
          <Link
            to={profileRoute}
            onClick={() => mobileMode && onCloseMobile()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A78BFA]/30 to-[#ED91C1]/25 border border-[#A78BFA]/35 flex items-center justify-center text-[11px] font-bold text-[#F0EFF8] overflow-hidden shrink-0">
              {userAvatar ? (
                <img src={getAvatarUrl(userAvatar, 64)} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#F0EFF8] truncate">{userName}</p>
              <p className="text-[10px] text-[#74788F] truncate">{userRoleLabel}</p>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={async () => {
            if (mobileMode) onCloseMobile();
            await onLogout();
          }}
          className={cn(
            'flex items-center w-full rounded-xl text-[#9295AD] hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/20 transition-all text-[13px] font-medium active:scale-[0.98]',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          )}
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen app-shell-bg text-[#F0EFF8] flex flex-col">
      {topBanner}

      <div className="flex flex-1 min-w-0 relative">
        {/* Desktop Fixed Glass Sidebar */}
        <aside
          className={cn(
            'hidden lg:block fixed left-0 top-0 bottom-0 h-screen z-30 glass-sidebar transition-all duration-300',
            isCollapsed ? 'w-20' : 'w-64',
          )}
          aria-label={sidebarAriaLabel}
        >
          {renderSidebarContent(isCollapsed, false)}
        </aside>

        {/* Mobile/Tablet Slide-in Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-[#05070E]/70 backdrop-blur-sm z-40 animate-fade-in"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <aside
              id="portal-mobile-sidebar"
              className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] h-full glass-sidebar shadow-2xl z-50"
              aria-label="Mobile Navigation Drawer"
            >
              {renderSidebarContent(false, true)}
            </aside>
          </div>
        )}

        {/* Right Main Column */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300',
            isCollapsed ? 'lg:pl-20' : 'lg:pl-64',
            bottomMobileNav && 'pb-16 lg:pb-0',
          )}
        >
          {/* Sticky Dark Glass Topbar */}
          <header className="h-16 glass-topbar sticky top-0 z-20 flex items-center justify-between gap-2 sm:gap-4 px-3.5 sm:px-6">
            {/* Left: Mobile Drawer Button + Breadcrumb Trail */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onToggleMobile}
                className="lg:hidden p-2 rounded-xl text-[#9295AD] hover:text-[#F0EFF8] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-colors shrink-0"
                aria-label="Toggle Menu"
                aria-expanded={isMobileOpen}
                aria-controls="portal-mobile-sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                to={homeRoute}
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[#9295AD] hover:text-[#F0EFF8] hover:border-[rgba(210,195,255,0.2)] transition-colors shrink-0"
                aria-label="Portal Home"
              >
                <Home className="w-4 h-4" />
              </Link>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
                  <span className="hidden md:inline text-[#74788F] font-medium truncate">
                    {breadcrumbSection}
                  </span>
                  <span className="hidden md:inline text-[#74788F]">/</span>
                  <h1 className="font-semibold text-[#F0EFF8] truncate tracking-tight">
                    {resolvedPageTitle}
                  </h1>
                </div>
                {pageSubtitle && (
                  <p className="text-[11px] text-[#74788F] truncate hidden sm:block leading-tight mt-0.5">
                    {pageSubtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Search + Custom Controls + User Identity Menu */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {!hideSearch && <QuickCommandSearch items={searchItems} />}

              {topBarRight}

              {/* User Menu Trigger */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 pl-1.5 sm:pl-2 pr-1.5 py-1 rounded-full hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
                    aria-label="Account menu"
                  >
                    <div className="text-right hidden xl:block min-w-0">
                      <p className="text-xs font-semibold text-[#F0EFF8] leading-tight truncate max-w-[160px]">
                        {userName}
                      </p>
                      <p className="text-[11px] text-[#74788F] leading-tight truncate max-w-[160px]">
                        {userRoleLabel}
                      </p>
                    </div>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#A78BFA]/30 via-[#8E6CF6]/20 to-[#ED91C1]/25 border border-[#A78BFA]/40 flex items-center justify-center text-[#F0EFF8] font-semibold text-xs shrink-0 overflow-hidden shadow-sm">
                      {userAvatar ? (
                        <img
                          src={getAvatarUrl(userAvatar, 72)}
                          alt={userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials || <UserIcon className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="normal-case tracking-normal font-normal">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-sm font-semibold text-[#F0EFF8] truncate">{userName}</span>
                      {userEmail && <span className="text-xs text-[#9295AD] truncate">{userEmail}</span>}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A78BFA] pt-0.5">
                        {userRoleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {profileRoute && (
                    <DropdownMenuItem onClick={() => navigate(profileRoute)}>
                      <Settings className="mr-2 h-4 w-4 text-[#9295AD]" />
                      <span>Account & Settings</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onLogout()}
                    className="text-rose-300 focus:text-rose-200 focus:bg-rose-500/15"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Workspace Content */}
          <main className="flex-1 p-3.5 sm:p-5 lg:p-7 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>

      {bottomMobileNav}
      {floatingWidget}
    </div>
  );
}

