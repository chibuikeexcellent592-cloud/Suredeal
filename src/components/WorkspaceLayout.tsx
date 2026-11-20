import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Gift,
  Home,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PackageCheck,
  Phone,
  Plus,
  Receipt,
  Send,
  Settings,
  ShoppingBag,
  Sun,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, formatNaira } from '../lib/api';
import { BrandLogo } from './BrandLogo';
import { PinnedMarquee } from './PinnedMarquee';
import { BoostingPanel } from './workspace/BoostingPanel';
import { CustomSectionPanel, MarketplacePanel } from './workspace/MarketplacePanel';
import { OrdersPanel } from './workspace/OrdersPanel';
import { OverviewPanel } from './workspace/OverviewPanel';
import { ReferralPanel } from './workspace/ReferralPanel';
import { SmsPanel } from './workspace/SmsPanel';
import {
  NotificationsPanel,
  SettingsPanel,
  SupportPanel,
  TutorialsPanel,
} from './workspace/SupportAndMorePanels';
import { TransactionsPanel } from './workspace/TransactionsPanel';
import { WalletPanel } from './workspace/WalletPanel';

interface WorkspaceLayoutProps {
  onBackHome: () => void;
  onOpenAdmin?: () => void;
}

export function WorkspaceLayout({ onBackHome, onOpenAdmin }: WorkspaceLayoutProps) {
  const { user, catalog, theme, toggleTheme, logout } = useApp();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const settings = catalog?.settings;
  const siteName = settings?.siteName || 'SureDeal Store';
  const siteTagline = settings?.siteTagline || 'Digital solutions for every market';
  const symbol = settings?.currencySymbol || '₦';
  const currencyCode = settings?.currencyCode || 'NGN';
  const customSections = catalog?.customSections || [];

  const whatsappDisplay =
    settings?.supportWhatsapp || settings?.adminNotifyPhone || '+2347031537390';
  const whatsappDigits = whatsappDisplay.replace(/[^\d]/g, '') || '2347031537390';
  const fallbackWhatsappUrl = `https://wa.me/${whatsappDigits}`;

  const communityEnabled = settings?.communityChannelEnabled !== false;
  const communityPlatform = settings?.communityChannelPlatform || 'whatsapp';
  const communityTitle =
    settings?.communityChannelTitle ||
    (communityPlatform === 'telegram' ? 'Join our Telegram' : 'Join our WhatsApp');
  const communitySubtitle =
    settings?.communityChannelSubtitle || 'Restock alerts, promos & live support';
  const communityCta =
    settings?.communityChannelCta ||
    (communityPlatform === 'telegram' ? 'Open Channel' : 'Join Group');
  const communityUrl = settings?.communityChannelUrl?.trim() || fallbackWhatsappUrl;

  const refreshCounts = () => {
    apiFetch<{
      stats: {
        unreadNotifications: number;
        totalSmsCount?: number;
        activeBoostingCount?: number;
        vaultCount?: number;
      };
    }>('/api/dashboard/overview')
      .then((res) => {
        setUnreadCount(res.stats.unreadNotifications || 0);
        const totalOrd =
          (res.stats.vaultCount || 0) +
          (res.stats.totalSmsCount || 0) +
          (res.stats.activeBoostingCount || 0);
        setOrdersCount(totalOrd);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshCounts();
  }, [activeTab]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [profileMenuOpen]);

  const marketplaceNav = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, paused: false, badgeTag: '' },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: ShoppingBag,
      paused: settings?.enableMarketplace === false,
      badgeTag: '',
    },
    {
      id: 'sms',
      label: 'Buy Number',
      icon: Phone,
      paused: settings?.enableSmsService === false,
      badgeTag: '',
    },
    {
      id: 'boosting',
      label: 'Social Boosting',
      icon: TrendingUp,
      paused: settings?.enableBoostingService === false,
      badgeTag: '',
    },
    ...customSections.map((sec) => ({
      id: `section:${sec.id}`,
      label: sec.name,
      icon: Layers,
      paused: settings?.enableMarketplace === false,
      badgeTag: sec.badgeTag || '',
    })),
  ];

  const historyNav = [
    { id: 'orders', label: 'Orders', icon: PackageCheck, badge: ordersCount },
    { id: 'transactions', label: 'Transaction History', icon: Receipt, badge: 0 },
    { id: 'wallet', label: 'Wallet & Fund', icon: Wallet, badge: 0 },
    { id: 'referral', label: 'Refer & Earn', icon: Gift, badge: 0 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'tutorials', label: 'Tutorials', icon: BookOpen, badge: 0 },
    { id: 'support', label: 'Support Desk', icon: LifeBuoy, badge: 0 },
    { id: 'settings', label: 'Settings', icon: Settings, badge: 0 },
  ];

  const customSectionId = activeTab.startsWith('section:') ? activeTab.slice(8) : null;

  const selectTab = (id: string) => {
    if (id === 'admin' && onOpenAdmin) {
      setMobileOpen(false);
      setProfileMenuOpen(false);
      onOpenAdmin();
      return;
    }
    setActiveTab(id);
    setMobileOpen(false);
    setProfileMenuOpen(false);
  };

  const initials = (user?.name || 'SD')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-slate-900 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackHome}
            className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
          >
            <BrandLogo
              logoUrl={settings?.siteLogoUrl}
              siteName={siteName}
              size="md"
              shape="rounded"
            />
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {siteName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {siteTagline}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Row with Ring & Order Badge (IMG_6033) */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-sky-200 dark:from-blue-900/60 dark:to-sky-800/60 ring-2 ring-blue-600/70 flex items-center justify-center font-display font-bold text-sm text-blue-700 dark:text-blue-200 shrink-0">
            {initials}
            {ordersCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                {ordersCount > 99 ? '99+' : ordersCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Currency Row */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
          <span>Currency</span>
          <span className="font-mono text-blue-700 dark:text-blue-300">
            {currencyCode} ({symbol})
          </span>
        </div>

        {/* Signature Balance Card */}
        <div className="px-4 py-2">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-5 text-white shadow-md shadow-blue-500/20">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-blue-100">
              Account Balance
            </p>
            <p className="font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums">
              {formatNaira(user?.balance || 0, symbol)}
            </p>
            <button
              type="button"
              onClick={() => selectTab('wallet')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Fund
            </button>
          </div>
        </div>

        {/* Overwatch -> Opens creator management console */}
        {user?.role === 'admin' && onOpenAdmin && (
          <div className="px-4 pt-4">
            <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Creator Console
            </p>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdmin();
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l7 4v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V7l7-4z" />
                    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
                  </svg>
                </span>
                <span>Overwatch</span>
              </span>
            </button>
          </div>
        )}

        {/* MARKETPLACE Group */}
        <div className="px-4 pt-4">
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Marketplace
          </p>
          <nav className="space-y-1">
            {marketplaceNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.badgeTag && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-extrabold uppercase">
                        {item.badgeTag}
                      </span>
                    )}
                    {item.paused && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 text-[10px] font-bold uppercase">
                        Paused
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* HISTORY & ACCOUNT Group */}
        <div className="px-4 pt-5 pb-4">
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            History
          </p>
          <nav className="space-y-1">
            {historyNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Community Channel Card (IMG_6036) + Public/Sign Out */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {communityEnabled && (
          <a
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block rounded-2xl p-3.5 text-white shadow-sm transition-transform hover:-translate-y-0.5 ${
              communityPlatform === 'telegram'
                ? 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/20'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                {communityPlatform === 'telegram' ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold leading-tight truncate">{communityTitle}</p>
                <p className="text-[11px] text-white/85 mt-0.5 line-clamp-2">
                  {communitySubtitle}
                </p>
                <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-white text-slate-900 text-[11px] font-bold">
                  {communityCta}
                </span>
              </div>
            </div>
          </a>
        )}

        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackHome}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Public Storefront</span>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              onBackHome();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--site-bg)] text-slate-900 dark:text-slate-100">
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
          {sidebarContent}
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full z-10 border-r border-slate-200 dark:border-slate-800 shadow-2xl">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header matching IMG_6032 */}
          <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => selectTab('overview')}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <BrandLogo
                  logoUrl={settings?.siteLogoUrl}
                  siteName={siteName}
                  size="sm"
                  shape="rounded"
                  className="lg:hidden shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                    {siteName}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                    {siteTagline}
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Notification Bell with red dot */}
              <button
                type="button"
                onClick={() => selectTab('notifications')}
                className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Avatar Pill + Chevron Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Account menu"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-blue-500/30">
                    {initials}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user?.name}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatNaira(user?.balance || 0, symbol)}
                      </p>
                    </div>
                    {[
                      { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
                      { id: 'orders', label: 'My Orders', icon: PackageCheck },
                      { id: 'transactions', label: 'Transaction History', icon: Receipt },
                      { id: 'wallet', label: 'Wallet & Fund', icon: Wallet },
                      { id: 'referral', label: 'Refer & Earn', icon: Gift },
                      { id: 'settings', label: 'Account Settings', icon: Settings },
                    ].map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => selectTab(entry.id)}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.label}</span>
                        </button>
                      );
                    })}
                    {user?.role === 'admin' && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => selectTab('admin')}
                        className="w-full px-4 py-2 text-left text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Overwatch Console</span>
                      </button>
                    )}
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          logout();
                          onBackHome();
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
            {activeTab === 'overview' && <PinnedMarquee />}
            {activeTab === 'overview' && <OverviewPanel onNavigate={selectTab} />}
            {activeTab === 'orders' && <OrdersPanel onNavigate={selectTab} />}
            {activeTab === 'transactions' && (
              <TransactionsPanel onFundWallet={() => selectTab('wallet')} />
            )}
            {activeTab === 'referral' && <ReferralPanel />}
            {activeTab === 'sms' && <SmsPanel />}
            {activeTab === 'boosting' && <BoostingPanel />}
            {activeTab === 'marketplace' && (
              <MarketplacePanel onOpenOrders={() => selectTab('orders')} />
            )}
            {customSectionId && <CustomSectionPanel sectionId={customSectionId} />}
            {activeTab === 'wallet' && (
              <WalletPanel onViewHistory={() => selectTab('transactions')} />
            )}
            {activeTab === 'notifications' && <NotificationsPanel onRead={refreshCounts} />}
            {activeTab === 'tutorials' && <TutorialsPanel />}
            {activeTab === 'support' && <SupportPanel />}
            {activeTab === 'settings' && (
              <SettingsPanel onOpenReferral={() => selectTab('referral')} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
