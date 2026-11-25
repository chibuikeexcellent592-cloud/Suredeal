import { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  CreditCard,
  Gift,
  Home,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
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
  ShieldCheck,
  ShoppingBag,
  Sun,
  TrendingUp,
  UserCog,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, formatNaira } from '../lib/api';
import { BrandLogo } from './BrandLogo';
import { BrandNameText } from './BrandNameText';
import { PinnedMarquee } from './PinnedMarquee';
import { SeasonalRibbon } from './SeasonalEffects';
import { UserAvatar } from './UserAvatar';
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
  const { user, catalog, theme, toggleTheme, logout, impersonatingFromAdmin } = useApp();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<'profile' | 'password' | undefined>(
    undefined,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);

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
    (communityPlatform === 'telegram' ? `${siteName} Telegram` : `${siteName} News`);
  const communitySubtitle =
    settings?.communityChannelSubtitle || 'Get exclusive updates & drops';
  const communityCta =
    settings?.communityChannelCta ||
    (communityPlatform === 'telegram' ? 'Open Channel' : 'Join WhatsApp');
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
    if (!profileDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profileDrawerOpen]);

  const userLevel = Math.max(1, Math.floor(ordersCount / 10) + 1);
  const levelProgressPct = Number(
    Math.min(
      99.5,
      Math.max(1.43, ((ordersCount % 10) * 9.5 + Math.min(8, Math.floor((user?.balance || 0) / 5000)))),
    ).toFixed(2),
  );

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

  const selectTab = (id: string, nextFocus?: 'profile' | 'password') => {
    if (id === 'admin' && onOpenAdmin) {
      setMobileOpen(false);
      setProfileDrawerOpen(false);
      onOpenAdmin();
      return;
    }
    setSettingsFocus(id === 'settings' ? nextFocus : undefined);
    setActiveTab(id);
    setMobileOpen(false);
    setProfileDrawerOpen(false);
  };

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
              <p className="font-display text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                <BrandNameText settings={settings} />
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

        {/* User Profile Row with Purple Ring, 3D Avatar & Cream Order Count Badge */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3.5">
          <UserAvatar
            name={user?.name}
            avatarUrl={user?.avatarUrl}
            size="lg"
            showOrdersBadge
            ordersCount={ordersCount}
          />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
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
              {settings?.dashboardBalanceLabel?.trim() || 'Account Balance'}
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

        {/* Overwatch -> Opens creator management console or exits impersonation */}
        {(user?.role === 'admin' || Boolean(impersonatingFromAdmin)) && onOpenAdmin && (
          <div className="px-4 pt-4">
            <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              {impersonatingFromAdmin ? 'Overwatch Session' : 'Creator Console'}
            </p>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAdmin();
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
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
                <span className="truncate">
                  {impersonatingFromAdmin ? 'Exit to Overwatch' : 'Overwatch'}
                </span>
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

      {/* Bottom Community Channel Card + Public/Sign Out */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {communityEnabled && (
          <a
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative block overflow-hidden rounded-2xl p-4 text-center border transition-transform hover:-translate-y-0.5 ${
              communityPlatform === 'telegram'
                ? 'bg-sky-50/90 dark:bg-sky-950/35 border-sky-200 dark:border-sky-800/60 text-sky-950 dark:text-sky-100'
                : 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-full mx-auto mb-2.5 flex items-center justify-center text-white shadow-sm ${
                communityPlatform === 'telegram' ? 'bg-sky-500' : 'bg-[#22C55E]'
              }`}
            >
              {communityPlatform === 'telegram' ? (
                <Send className="w-5 h-5" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
            </div>
            <p className="font-display text-sm font-extrabold leading-tight truncate">
              {communityTitle}
            </p>
            <p
              className={`text-xs mt-1 line-clamp-2 ${
                communityPlatform === 'telegram'
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {communitySubtitle}
            </p>
            <span
              className={`mt-3 w-full inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-bold text-white shadow-xs ${
                communityPlatform === 'telegram'
                  ? 'bg-sky-600 hover:bg-sky-700'
                  : 'bg-[#22C55E] hover:bg-emerald-600'
              }`}
            >
              {communityCta}
            </span>
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
      <SeasonalRibbon compact />
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
          {/* Header matching attached brand/profile screenshot */}
          <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => selectTab('overview')}
                className="flex items-center gap-2 sm:gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <BrandLogo
                  logoUrl={settings?.siteLogoUrl}
                  siteName={siteName}
                  size="sm"
                  shape="rounded"
                  className="lg:hidden shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display text-[15px] sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                    <BrandNameText settings={settings} />
                  </p>
                  <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                    {siteTagline}
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Notification Bell with red dot */}
              <button
                type="button"
                onClick={() => selectTab('notifications')}
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
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
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Avatar Pill -> Opens Right-Side My Profile Drawer (IMG_6080) */}
              <button
                type="button"
                onClick={() => setProfileDrawerOpen(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 pl-1 pr-2 sm:pr-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Open My Profile drawer"
              >
                <UserAvatar
                  name={user?.name}
                  avatarUrl={user?.avatarUrl}
                  size="sm"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 sm:pb-10 max-w-7xl w-full mx-auto space-y-5">
            {activeTab === 'overview' && <PinnedMarquee />}
            {activeTab === 'overview' && <OverviewPanel onNavigate={selectTab} />}
            {activeTab === 'orders' && <OrdersPanel onNavigate={selectTab} />}
            {activeTab === 'transactions' && (
              <TransactionsPanel onFundWallet={() => selectTab('wallet')} />
            )}
            {activeTab === 'referral' && <ReferralPanel />}
            {activeTab === 'sms' && <SmsPanel onFundWallet={() => selectTab('wallet')} />}
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
              <SettingsPanel
                focusSection={settingsFocus}
                onOpenReferral={() => selectTab('referral')}
              />
            )}
          </main>
        </div>
      </div>

      {/* Right-Side My Profile Slide-Over Drawer (IMG_6080) */}
      {profileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={() => setProfileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-[360px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Top Row */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                  My Profile
                </h2>
                <button
                  type="button"
                  onClick={() => setProfileDrawerOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close profile drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Centered Profile Avatar + Name + Email */}
              <div className="flex flex-col items-center text-center pt-1">
                <UserAvatar
                  name={user?.name}
                  avatarUrl={user?.avatarUrl}
                  size="2xl"
                />
                <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-4 truncate max-w-full">
                  {user?.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full">
                  {user?.email}
                </p>
              </div>

              {/* Level Progress Bar */}
              <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">
                    Progress to Level {userLevel}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold tabular-nums">
                    {levelProgressPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, Math.min(100, levelProgressPct))}%` }}
                  />
                </div>
              </div>

              {/* Action Rows matching IMG_6080 */}
              <nav className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => selectTab('settings', 'profile')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  <UserCog className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Profile Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectTab('settings', 'password')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectTab('wallet')}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Payment Methods</span>
                </button>

                {(user?.role === 'admin' || Boolean(impersonatingFromAdmin)) && onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => selectTab('admin')}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 text-sm font-bold text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{impersonatingFromAdmin ? 'Exit to Overwatch' : 'Overwatch Console'}</span>
                  </button>
                )}
              </nav>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6 space-y-2.5">
              <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Wallet Balance</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatNaira(user?.balance || 0, symbol)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileDrawerOpen(false);
                  logout();
                  onBackHome();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-sm font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
