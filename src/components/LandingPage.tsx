import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  KeyRound,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Phone,
  Play,
  ShieldCheck,
  Smartphone,
  Sun,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatNaira, resolveApiUrl } from '../lib/api';
import { BrandLogo } from './BrandLogo';
import { SafeImage } from './SafeImage';

interface LandingPageProps {
  onNavigateAuth: (mode: 'login' | 'signup') => void;
  onEnterWorkspace: () => void;
  onOpenAdmin?: () => void;
  onPreviewMaintenance?: () => void;
}

const LEGACY_KICKER = 'Social Boosting · SMS Verification · Digital Vault';
const LEGACY_HEADLINE =
  'Scale your social presence, verify accounts globally, and unlock verified digital assets.';
const LEGACY_SUBHEADLINE =
  'Power your Instagram, TikTok, and YouTube campaigns, rent instant virtual OTP numbers, and acquire CLiproxy, 9Proxy, PIAVPN, and creator accounts from one clean dashboard.';

export function LandingPage({
  onNavigateAuth,
  onEnterWorkspace,
  onOpenAdmin,
  onPreviewMaintenance,
}: LandingPageProps) {
  const { user, catalog, theme, toggleTheme } = useApp();
  const [rateTab, setRateTab] = useState<'sms' | 'boosting' | 'marketplace'>('boosting');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const settings = catalog?.settings;
  const siteName = settings?.siteName || 'SureDeal Store';
  const symbol = settings?.currencySymbol || '₦';
  const contactEmail = settings?.supportEmail || 'chibuikeexcellent592@gmail.com';
  const whatsappDisplay = settings?.supportWhatsapp || settings?.adminNotifyPhone || '+2347031537390';
  const whatsappDigits = whatsappDisplay.replace(/[^\d]/g, '') || '2347031537390';
  const whatsappHref = `https://wa.me/${whatsappDigits}`;
  const creatorName = settings?.creatorName?.trim() || 'Excellent';
  const creatorUrl = settings?.creatorUrl?.trim() || '';
  const smsServices = catalog?.smsServices || [];
  const boostingServices = catalog?.boostingServices || [];
  const listings = catalog?.marketplaceListings || [];

  const rawVideoUrl = settings?.landingVideoUrl || '';
  const isUploadedVideo =
    rawVideoUrl.startsWith('/uploads/') ||
    rawVideoUrl.endsWith('.mp4') ||
    rawVideoUrl.endsWith('.webm') ||
    rawVideoUrl.endsWith('.mov');
  const videoUrl = rawVideoUrl.startsWith('/uploads/') ? resolveApiUrl(rawVideoUrl) : rawVideoUrl;

  const heroKicker =
    settings?.heroKicker && settings.heroKicker !== LEGACY_KICKER
      ? settings.heroKicker
      : "Africa's all-in-one marketplace for digital growth";

  const heroHeadline =
    settings?.heroHeadline && settings.heroHeadline !== LEGACY_HEADLINE
      ? settings.heroHeadline
      : 'All-in-One Digital Tools & Growth Services in Africa';

  const heroSecondaryHeadline =
    settings?.heroSecondaryHeadline ||
    'SMS Verification, Social Boosting, VPN, Proxy & Verified Accounts — Fast, Secure & Affordable.';

  const rawHeroSub = settings?.heroSubheadline || '';
  const heroSubheadline =
    rawHeroSub &&
    rawHeroSub !== LEGACY_SUBHEADLINE &&
    !/moniepoint/i.test(rawHeroSub)
      ? rawHeroSub
      : 'Verify WhatsApp, Telegram, and global accounts with instant one-time codes, launch high-retention social boosting campaigns, and acquire CLiproxy, 9Proxy, PIAVPN, and verified accounts from one clean dashboard.';

  const heroPrimaryCta =
    settings?.heroPrimaryCta && settings.heroPrimaryCta !== 'Create Free Account'
      ? settings.heroPrimaryCta
      : 'Get Started';
  const heroSecondaryCta = settings?.heroSecondaryCta || 'Explore Services';

  const snapshotKicker = settings?.snapshotKicker || 'Live Catalog Snapshot';
  const snapshotTitle = settings?.snapshotTitle || 'Instant Delivery Hub';
  const snapshotBadge = settings?.snapshotBadge || 'Active Now';
  const snapshotFooterText =
    settings?.snapshotFooterText || 'Instant Vault Delivery & 24/7 Automated Dispatch';

  const servicesKicker = settings?.servicesKicker || 'What You Can Do Here';
  const servicesTitle =
    settings?.servicesTitle || 'Built for creators, agencies, and digital marketers';

  const landingStats =
    settings?.landingStats && settings.landingStats.length > 0
      ? settings.landingStats
      : [
          { value: '99.4%', label: 'Campaign completion & auto-refill reliability' },
          {
            value: `${catalog?.smsCountriesCount || 10}+ Countries`,
            label: 'Clean SMS OTP carrier coverage worldwide',
          },
          { value: 'Unified Wallet', label: 'Fast Naira deposits inside your dashboard' },
          { value: 'Instant Vault', label: 'Zero-wait Login, Password & 2FA delivery' },
        ];

  const workflowKicker = settings?.workflowKicker || 'Simple 4-Step Workflow';
  const workflowTitle = settings?.workflowTitle || 'Fund once, deploy across every tool';
  const workflowSubtitle =
    settings?.workflowSubtitle ||
    `Every service shares one Naira (${symbol}) wallet with instant Vault credential delivery and protected SMS escrow refunds.`;
  const workflowSteps =
    settings?.workflowSteps && settings.workflowSteps.length > 0
      ? settings.workflowSteps
      : [
          {
            title: '01. Create Your Account & Fund Your Wallet',
            desc: 'Register for free, open Wallet & Fund inside your user dashboard to view live funding instructions, and credit your Naira balance seamlessly.',
          },
          {
            title: '02. Virtual SMS Verification Numbers',
            desc: 'Pick your country first, search WhatsApp, Telegram, Google, OpenAI, or TikTok, and enjoy automatic instant wallet refund if cancelled before OTP arrival.',
          },
          {
            title: '03. Direct Social Media Boosting',
            desc: 'Submit your target link and quantity once — boosting orders dispatch directly to our fulfillment desk for timely delivery.',
          },
          {
            title: '04. Proxies, VPNs & Referral Rewards',
            desc: `Unlock CLiproxy, 9Proxy, PIAVPN, and verified accounts with Login, Password & 2FA in your Vault, plus earn ${symbol}${(settings?.referralBonusAmount || 500).toLocaleString()} per referral.`,
          },
        ];

  const ctaKicker = settings?.ctaKicker || 'Instant Account Access & Live Support';
  const ctaTitle = settings?.ctaTitle || `Ready to start using ${siteName}?`;
  const ctaSubtitle =
    settings?.ctaSubtitle ||
    'Create your free account, open Wallet & Fund inside your dashboard to top up your Naira balance, and access every growth service right away.';

  const [typedLength, setTypedLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTypedLength(heroHeadline.length);
      return;
    }

    let timer: number;
    if (!isDeleting && typedLength < heroHeadline.length) {
      timer = window.setTimeout(() => setTypedLength((len) => len + 1), 38);
    } else if (!isDeleting && typedLength >= heroHeadline.length) {
      timer = window.setTimeout(() => setIsDeleting(true), 2600);
    } else if (isDeleting && typedLength > 0) {
      timer = window.setTimeout(() => setTypedLength((len) => Math.max(0, len - 1)), 18);
    } else {
      timer = window.setTimeout(() => setIsDeleting(false), 380);
    }

    return () => window.clearTimeout(timer);
  }, [heroHeadline, typedLength, isDeleting]);

  useEffect(() => {
    setTypedLength(0);
    setIsDeleting(false);
  }, [heroHeadline]);

  const typedHeadline = heroHeadline.slice(0, typedLength);

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const servicePillars = [
    {
      icon: Smartphone,
      title: 'Virtual SMS Verification',
      tag: `${catalog?.smsCountriesCount || 10}+ Countries`,
      desc: 'Select your carrier country first, search WhatsApp, Telegram, OpenAI, or TikTok, and receive your OTP instantly with auto-refund protection.',
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-sky-400',
    },
    {
      icon: TrendingUp,
      title: 'Social Media Boosting',
      tag: 'Direct Dispatch',
      desc: 'Scale Instagram, TikTok, YouTube, and X profiles with fast followers, likes, and views delivered straight from our order desk.',
      color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    },
    {
      icon: KeyRound,
      title: 'Marketplace & Vault',
      tag: 'Login · Pass · 2FA',
      desc: 'Unlock CLiproxy, 9Proxy, PIAVPN, and creator accounts stored immediately in your Vault with copy-ready Login, Password, and 2FA keys.',
      color: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    },
    {
      icon: Wallet,
      title: 'In-App Wallet Funding',
      tag: 'Auto-Credited',
      desc: 'Add Naira funds securely inside your dashboard Wallet section and deploy your balance instantly across every service.',
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
  ];

  const defaultShowcaseCards = [
    {
      id: 'sc_boost',
      category: 'Social Boosting',
      deliveryType: 'Creator Growth',
      title: 'Instagram & TikTok Viral Velocity',
      shortSpec: 'High-retention followers, reels views, and instant engagement campaigns.',
      priceLabel: `From ${formatNaira(boostingServices[2]?.ratePer1k || boostingServices[0]?.ratePer1k || 800, symbol)} / 1K`,
      imageUrl: '/src/assets/images/social_creator_filming_1794991853059.jpg',
    },
    {
      id: 'sc_sms',
      category: 'Virtual SMS OTP',
      deliveryType: '10+ Countries',
      title: 'Instant Account Verification Numbers',
      shortSpec: 'Dedicated WhatsApp, Telegram, TikTok, Instagram, and OpenAI OTP routing.',
      priceLabel: `From ${formatNaira(smsServices[0]?.basePrice ? Math.round(smsServices[0].basePrice * 0.65) : 900, symbol)} / OTP`,
      imageUrl: '/src/assets/images/social_mobile_lifestyle_1794991853436.jpg',
    },
    {
      id: 'sc_analytics',
      category: 'Creator & Proxies',
      deliveryType: 'Instant Vault',
      title: 'CLiproxy, 9Proxy & Creator Suites',
      shortSpec: 'Clean residential IPs, VPN licenses, and aged creator accounts for scaling.',
      priceLabel: `From ${formatNaira(listings[1]?.price || listings[0]?.price || 2800, symbol)}`,
      imageUrl: '/src/assets/images/social_workspace_creators_1794991853444.jpg',
    },
  ];

  const socialShowcaseCards =
    settings?.landingShowcaseCards && settings.landingShowcaseCards.length > 0
      ? settings.landingShowcaseCards.map((card, idx) => ({
          ...card,
          priceLabel:
            card.priceLabel?.trim() ||
            defaultShowcaseCards[idx]?.priceLabel ||
            `Live on ${siteName}`,
          imageUrl:
            card.imageUrl?.trim() ||
            defaultShowcaseCards[idx]?.imageUrl ||
            '/src/assets/images/social_creator_filming_1794991853059.jpg',
        }))
      : defaultShowcaseCards;

  return (
    <div className="min-h-screen bg-[var(--site-bg)] text-slate-900 dark:text-slate-100">
      {settings?.maintenanceMode && user?.role === 'admin' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-center gap-3">
          <span>
            Maintenance Lockdown is ACTIVE — public visitors &amp; regular users see the maintenance page.
          </span>
          {onPreviewMaintenance && (
            <button
              type="button"
              onClick={onPreviewMaintenance}
              className="px-3 py-1 rounded-full bg-slate-950 text-white hover:bg-slate-800 cursor-pointer"
            >
              Preview Maintenance Screen
            </button>
          )}
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-3 py-1 rounded-full bg-white text-slate-950 hover:bg-slate-100 cursor-pointer"
            >
              Overwatch Console
            </button>
          )}
        </div>
      )}
      {/* Clean Header Inspired by Reference Image */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="flex items-center gap-3 min-w-0 whitespace-nowrap shrink-0"
          >
            <BrandLogo
              logoUrl={settings?.siteLogoUrl}
              siteName={siteName}
              size="md"
              shape="circle"
            />
            <span className="font-display text-sm sm:text-base font-extrabold tracking-wide uppercase text-slate-900 dark:text-white">
              {siteName}
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#services"
              className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              Services
            </a>
            <a
              href="#rates"
              className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              Live Rates
            </a>
            <a
              href="#walkthrough"
              className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#funding"
              className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              Get Started
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={onEnterWorkspace}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm shadow-blue-600/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                Open Workspace
              </button>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateAuth('login')}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-sky-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('signup')}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm shadow-blue-600/20 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {heroPrimaryCta}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1422] px-5 py-4 space-y-3 shadow-lg">
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              <button
                type="button"
                onClick={() => scrollToSection('services')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('rates')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Live Rates
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('walkthrough')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('funding')}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Get Started
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    onEnterWorkspace();
                  }}
                  className="w-full py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer"
                >
                  Open Workspace
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onNavigateAuth('signup');
                    }}
                    className="w-full py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer"
                  >
                    {heroPrimaryCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onNavigateAuth('login');
                    }}
                    className="w-full py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold cursor-pointer"
                  >
                    Sign In
                  </button>
                </>
              )}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Support ({whatsappDisplay})
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* Soft Sky-Tinted Hero Section Matching Attached Reference */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-blue-50/40 to-[var(--site-bg)] dark:from-blue-950/40 dark:via-slate-900/60 dark:to-[var(--site-bg)] pt-10 pb-14 sm:pt-16 sm:pb-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[340px] rounded-full bg-sky-300/20 dark:bg-blue-600/15 blur-3xl"
          />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left / Mobile Full-Bleed Reference Layout */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-sky-100/80 dark:bg-blue-950/70 border border-sky-200/90 dark:border-blue-800/70 text-xs sm:text-sm font-medium text-slate-800 dark:text-sky-200">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span>{heroKicker}</span>
                </div>

                <h1
                  aria-label={heroHeadline}
                  className="relative font-bahnschrift-sc font-bold tracking-[-0.01em] text-blue-600 dark:text-blue-400 leading-[1.08]"
                  style={{ fontSize: 'clamp(2.35rem, 4.7vw, 3.75rem)' }}
                >
                  <span className="invisible select-none block" aria-hidden="true">
                    {heroHeadline}&nbsp;
                  </span>
                  <span className="absolute inset-0 block">
                    {typedHeadline}
                    <span
                      aria-hidden="true"
                      className="inline-block w-[3px] h-[0.92em] bg-blue-600 dark:bg-blue-400 align-[-0.1em] ml-1.5 rounded-full animate-typewriter-caret"
                    />
                  </span>
                </h1>

                <h2 className="font-sans text-xl sm:text-2xl font-bold tracking-[-0.015em] text-slate-900 dark:text-white leading-snug max-w-2xl">
                  {heroSecondaryHeadline}
                </h2>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {heroSubheadline}
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                  >
                    <span>{user ? 'Open Dashboard' : heroPrimaryCta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('services')}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-sm sm:text-base shadow-md shadow-slate-900/5 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                    <span>{heroSecondaryCta}</span>
                  </button>
                </div>

                {!user && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigateAuth('login')}
                      className="font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Sign in to your account
                    </button>
                  </p>
                )}
              </div>

              {/* Right Column: Live Storefront Snapshot Card (Desktop + Tablet) */}
              <div className="lg:col-span-5">
                <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl shadow-blue-900/5 space-y-4">
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400">
                        {snapshotKicker}
                      </p>
                      <p className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                        {snapshotTitle}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                      {snapshotBadge}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            Virtual SMS Numbers
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            WhatsApp · Telegram · OpenAI
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400 shrink-0">
                        From {formatNaira(900, symbol)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            Social Growth Campaigns
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Instagram · TikTok · YouTube
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400 shrink-0">
                        From {formatNaira(boostingServices[2]?.ratePer1k || 800, symbol)}/1K
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center shrink-0">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            Proxies, VPN &amp; Accounts
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            CLiproxy · 9Proxy · PIAVPN
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400 shrink-0">
                        From {formatNaira(listings[1]?.price || 2800, symbol)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 p-4 text-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-100">
                        One Unified Naira Wallet
                      </p>
                      <p className="text-sm font-bold mt-0.5 truncate">
                        {snapshotFooterText}
                      </p>
                    </div>
                    <Zap className="w-5 h-5 text-white shrink-0" />
                  </div>
                </div>
              </div>
            </div>

            {/* 4-Column KPI Proof Strip */}
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-5 pt-8 border-t border-slate-200/80 dark:border-slate-800">
              {landingStats.map((stat, idx) => (
                <div key={`${stat.value}-${idx}`}>
                  <p className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Admin-Uploaded Walkthrough Video Showcase */}
        {videoUrl && (
          <section className="max-w-7xl mx-auto px-5 sm:px-6 py-12 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-4xl mx-auto">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400">
                  Video Walkthrough
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                  See {siteName} in action
                </h2>
              </div>
              <div className="aspect-video rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-lg">
                {isUploadedVideo ? (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <iframe
                    src={videoUrl}
                    title={`${siteName} Walkthrough`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* Services Showcase & Visual Feature Grid */}
        <section id="services" className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400 mb-1.5">
                {servicesKicker}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {servicesTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Full Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {servicePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${pillar.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {pillar.tag}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {pillar.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual Showcase Cards */}
          {settings?.showLandingShowcase !== false && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {socialShowcaseCards.map((card) => (
                <article
                  key={card.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <SafeImage
                      src={card.imageUrl}
                      alt={card.title}
                      fallbackTitle={card.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {card.category} · {card.deliveryType}
                      </p>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-1">
                        {card.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2">
                        {card.shortSpec}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-blue-600 dark:text-sky-400 tabular-nums">
                        {card.priceLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
                        className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Get Access
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* How It Works & Live Rate Card */}
        <section
          id="walkthrough"
          className="bg-white dark:bg-slate-900/50 border-t border-b border-slate-200 dark:border-slate-800"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className={settings?.showLandingRates === false ? 'lg:col-span-12 divide-y divide-slate-200 dark:divide-slate-800' : 'lg:col-span-5 divide-y divide-slate-200 dark:divide-slate-800'}>
              <div className="pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400 mb-1.5">
                  {workflowKicker}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {workflowTitle}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {workflowSubtitle}
                </p>
              </div>

              {workflowSteps.map((step, idx) => (
                <div
                  key={`${step.title}-${idx}`}
                  className={idx === workflowSteps.length - 1 ? 'pt-5' : 'py-5'}
                >
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-1.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {settings?.showLandingRates !== false && (
              <div
                id="rates"
                className="lg:col-span-7 bg-[var(--site-bg)] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs"
              >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                    Live Rate Card
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time Naira ({symbol}) pricing synced with {siteName}
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  {(
                    [
                      { id: 'boosting', label: 'Boosting' },
                      { id: 'sms', label: 'SMS OTP' },
                      { id: 'marketplace', label: 'Proxies & Vault' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRateTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        rateTab === tab.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 mt-2">
                {rateTab === 'boosting' &&
                  boostingServices.slice(0, 7).map((svc) => (
                    <div
                      key={svc.id}
                      className="py-3.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {svc.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {svc.platform} · {svc.speedLabel} · {svc.refillPolicy}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatNaira(svc.ratePer1k, symbol)} / 1K
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            user ? onEnterWorkspace() : onNavigateAuth('signup')
                          }
                          className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Boost
                        </button>
                      </div>
                    </div>
                  ))}

                {rateTab === 'sms' &&
                  smsServices.slice(0, 7).map((svc) => (
                    <div
                      key={svc.id}
                      className="py-3.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {svc.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {svc.category} · {svc.successRate}% delivery ·{' '}
                          {svc.stock.toLocaleString()} ready
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          From {formatNaira(Math.round(svc.basePrice * 0.65), symbol)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            user ? onEnterWorkspace() : onNavigateAuth('signup')
                          }
                          className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Rent
                        </button>
                      </div>
                    </div>
                  ))}

                {rateTab === 'marketplace' &&
                  listings.slice(0, 7).map((item) => (
                    <div
                      key={item.id}
                      className="py-3.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.category} · {item.deliveryType} · {item.stock} in stock
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatNaira(item.price, symbol)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            user ? onEnterWorkspace() : onNavigateAuth('signup')
                          }
                          className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Acquire
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              </div>
            )}
          </div>
        </section>

        {/* Account Access & Support CTA Banner */}
        <section id="funding" className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-16">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800 p-7 sm:p-10 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
                {ctaKicker}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
                {ctaTitle}
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {ctaSubtitle}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Unified In-App Wallet
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Instant SMS Escrow Refunds
                </span>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline font-semibold"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Help ({whatsappDisplay})
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
                className="px-7 py-3.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {user ? 'Open Workspace' : heroPrimaryCta}
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => onNavigateAuth('login')}
                  className="px-6 py-3.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer
        id="footer-contact"
        className="border-t border-slate-200 dark:border-slate-800 bg-[var(--site-bg)]"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-12 pb-24 sm:pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-9 lg:gap-10">
            {/* Brand Intro */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <BrandLogo
                  logoUrl={settings?.siteLogoUrl}
                  siteName={siteName}
                  size="sm"
                  shape="circle"
                />
                <span className="font-display text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                  {siteName}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
                {settings?.footerTagline ||
                  'Premium digital tools marketplace — virtual SMS verification numbers, social media boosting, proxies, VPNs, and verified accounts with instant delivery and secure wallet payments.'}
              </p>
            </div>

            {/* Marketplace Links */}
            <div className="lg:col-span-2 space-y-3.5">
              <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                Marketplace
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    Browse products
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setRateTab('sms');
                      scrollToSection('rates');
                    }}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    SMS Verification
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setRateTab('boosting');
                      scrollToSection('rates');
                    }}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    Social Boosting
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setRateTab('marketplace');
                      scrollToSection('rates');
                    }}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    Proxies &amp; VPNs
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (user ? onEnterWorkspace() : onNavigateAuth('signup'))}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    Verified Accounts
                  </button>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div className="lg:col-span-2 space-y-3.5">
              <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                Company
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('walkthrough')}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('rates')}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    Live Rates
                  </button>
                </li>
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="hover:text-blue-600 dark:hover:text-sky-400 transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Get in touch + Scroll to top */}
            <div className="lg:col-span-3 space-y-4">
              <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                Get in touch
              </h3>

              <div>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>

              <div className="flex items-end justify-between gap-4 pt-1">
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 min-w-0">
                  <a
                    href={`tel:${whatsappDisplay}`}
                    className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-sky-400"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>24/7 support · {whatsappDisplay}</span>
                  </a>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-sky-400 truncate"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{contactEmail}</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  aria-label="Back to top"
                  className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 flex items-center justify-center shrink-0 transition-transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              made by{' '}
              {creatorUrl ? (
                <a
                  href={creatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {creatorName}
                </a>
              ) : (
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {creatorName}
                </span>
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
