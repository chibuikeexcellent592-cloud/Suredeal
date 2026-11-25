import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  FileText,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  PackageCheck,
  Phone,
  RotateCcw,
  Save,
  Settings,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../lib/api';
import { SECTION_COPY_DEFAULTS } from '../../lib/sectionCopy';
import type { PlatformSettings } from '../../types';

type CopyFormState = {
  dashboardNoticeEnabled: boolean;
  dashboardNoticeText: string;
  dashboardNoticeTone: 'amber' | 'info' | 'emerald' | 'rose';
  dashboardWalletBadge: string;
  dashboardWalletTitle: string;
  dashboardWalletSubtitle: string;
  dashboardBalanceLabel: string;
  dashboardFundButtonLabel: string;
  dashboardHistoryButtonLabel: string;

  walletPageTitle: string;
  walletPageSubtitle: string;
  walletNoticeText: string;
  walletCardHeader: string;
  walletFormTitle: string;
  walletUploadHint: string;
  walletSubmitButtonLabel: string;
  walletActivityTitle: string;
  walletEmptyActivityText: string;

  marketplaceTitle: string;
  marketplaceSubtitle: string;
  marketplacePausedText: string;
  defaultBuyWarning: string;
  defaultBuyWarningLevel: 'serious' | 'info';

  smsTitle: string;
  smsSubtitle: string;
  smsSessionNote: string;
  smsInboxTitle: string;
  smsRentButtonLabel: string;
  smsPausedText: string;

  boostingTitle: string;
  boostingSubtitle: string;
  boostingHistoryTitle: string;
  boostingEmptyText: string;
  boostingPausedText: string;

  ordersTitle: string;
  ordersSubtitle: string;

  transactionsTitle: string;
  transactionsSubtitle: string;

  referralTitle: string;
  referralSubtitle: string;
  referralCardBadge: string;
  referralCardHeadline: string;
  referralCardDesc: string;

  tutorialsTitle: string;
  tutorialsSubtitle: string;
  supportTitle: string;
  supportSubtitle: string;
  notificationsTitle: string;
  notificationsSubtitle: string;
  settingsTitle: string;
  settingsSubtitle: string;
};

type SectionGroupFilter =
  | 'all'
  | 'wallet'
  | 'overview'
  | 'marketplace'
  | 'services'
  | 'history'
  | 'community';

function buildCopyState(s: PlatformSettings): CopyFormState {
  const str = (val: string | undefined, fallback: string) =>
    typeof val === 'string' && val.trim() ? val : fallback;

  return {
    dashboardNoticeEnabled: s.dashboardNoticeEnabled ?? SECTION_COPY_DEFAULTS.dashboardNoticeEnabled,
    dashboardNoticeText: str(s.dashboardNoticeText, SECTION_COPY_DEFAULTS.dashboardNoticeText),
    dashboardNoticeTone: s.dashboardNoticeTone ?? SECTION_COPY_DEFAULTS.dashboardNoticeTone,
    dashboardWalletBadge: s.dashboardWalletBadge ?? SECTION_COPY_DEFAULTS.dashboardWalletBadge,
    dashboardWalletTitle: str(s.dashboardWalletTitle, SECTION_COPY_DEFAULTS.dashboardWalletTitle),
    dashboardWalletSubtitle:
      s.dashboardWalletSubtitle ?? SECTION_COPY_DEFAULTS.dashboardWalletSubtitle,
    dashboardBalanceLabel: str(s.dashboardBalanceLabel, SECTION_COPY_DEFAULTS.dashboardBalanceLabel),
    dashboardFundButtonLabel: str(
      s.dashboardFundButtonLabel,
      SECTION_COPY_DEFAULTS.dashboardFundButtonLabel,
    ),
    dashboardHistoryButtonLabel: str(
      s.dashboardHistoryButtonLabel,
      SECTION_COPY_DEFAULTS.dashboardHistoryButtonLabel,
    ),

    walletPageTitle: str(s.walletPageTitle, SECTION_COPY_DEFAULTS.walletPageTitle),
    walletPageSubtitle: str(s.walletPageSubtitle, SECTION_COPY_DEFAULTS.walletPageSubtitle),
    walletNoticeText: s.walletNoticeText ?? SECTION_COPY_DEFAULTS.walletNoticeText,
    walletCardHeader: str(s.walletCardHeader, SECTION_COPY_DEFAULTS.walletCardHeader),
    walletFormTitle: str(s.walletFormTitle, SECTION_COPY_DEFAULTS.walletFormTitle),
    walletUploadHint: str(s.walletUploadHint, SECTION_COPY_DEFAULTS.walletUploadHint),
    walletSubmitButtonLabel: str(
      s.walletSubmitButtonLabel,
      SECTION_COPY_DEFAULTS.walletSubmitButtonLabel,
    ),
    walletActivityTitle: str(s.walletActivityTitle, SECTION_COPY_DEFAULTS.walletActivityTitle),
    walletEmptyActivityText: str(
      s.walletEmptyActivityText,
      SECTION_COPY_DEFAULTS.walletEmptyActivityText,
    ),

    marketplaceTitle: str(s.marketplaceTitle, SECTION_COPY_DEFAULTS.marketplaceTitle),
    marketplaceSubtitle: str(s.marketplaceSubtitle, SECTION_COPY_DEFAULTS.marketplaceSubtitle),
    marketplacePausedText: str(s.marketplacePausedText, SECTION_COPY_DEFAULTS.marketplacePausedText),
    defaultBuyWarning:
      s.defaultBuyWarning ||
      'Verify proxy format and platform rules before deployment. Credentials are delivered once.',
    defaultBuyWarningLevel: s.defaultBuyWarningLevel ?? 'serious',

    smsTitle: str(s.smsTitle, SECTION_COPY_DEFAULTS.smsTitle),
    smsSubtitle: str(s.smsSubtitle, SECTION_COPY_DEFAULTS.smsSubtitle),
    smsSessionNote: str(s.smsSessionNote, SECTION_COPY_DEFAULTS.smsSessionNote),
    smsInboxTitle: str(s.smsInboxTitle, SECTION_COPY_DEFAULTS.smsInboxTitle),
    smsRentButtonLabel: str(s.smsRentButtonLabel, SECTION_COPY_DEFAULTS.smsRentButtonLabel),
    smsPausedText: str(s.smsPausedText, SECTION_COPY_DEFAULTS.smsPausedText),

    boostingTitle: str(s.boostingTitle, SECTION_COPY_DEFAULTS.boostingTitle),
    boostingSubtitle: str(s.boostingSubtitle, SECTION_COPY_DEFAULTS.boostingSubtitle),
    boostingHistoryTitle: str(s.boostingHistoryTitle, SECTION_COPY_DEFAULTS.boostingHistoryTitle),
    boostingEmptyText: str(s.boostingEmptyText, SECTION_COPY_DEFAULTS.boostingEmptyText),
    boostingPausedText: str(s.boostingPausedText, SECTION_COPY_DEFAULTS.boostingPausedText),

    ordersTitle: str(s.ordersTitle, SECTION_COPY_DEFAULTS.ordersTitle),
    ordersSubtitle: str(s.ordersSubtitle, SECTION_COPY_DEFAULTS.ordersSubtitle),

    transactionsTitle: str(s.transactionsTitle, SECTION_COPY_DEFAULTS.transactionsTitle),
    transactionsSubtitle: str(s.transactionsSubtitle, SECTION_COPY_DEFAULTS.transactionsSubtitle),

    referralTitle: str(s.referralTitle, SECTION_COPY_DEFAULTS.referralTitle),
    referralSubtitle: str(s.referralSubtitle, SECTION_COPY_DEFAULTS.referralSubtitle),
    referralCardBadge: str(s.referralCardBadge, SECTION_COPY_DEFAULTS.referralCardBadge),
    referralCardHeadline: str(s.referralCardHeadline, SECTION_COPY_DEFAULTS.referralCardHeadline),
    referralCardDesc: str(s.referralCardDesc, SECTION_COPY_DEFAULTS.referralCardDesc),

    tutorialsTitle: str(s.tutorialsTitle, SECTION_COPY_DEFAULTS.tutorialsTitle),
    tutorialsSubtitle: str(s.tutorialsSubtitle, SECTION_COPY_DEFAULTS.tutorialsSubtitle),
    supportTitle: str(s.supportTitle, SECTION_COPY_DEFAULTS.supportTitle),
    supportSubtitle: str(s.supportSubtitle, SECTION_COPY_DEFAULTS.supportSubtitle),
    notificationsTitle: str(s.notificationsTitle, SECTION_COPY_DEFAULTS.notificationsTitle),
    notificationsSubtitle: str(
      s.notificationsSubtitle,
      SECTION_COPY_DEFAULTS.notificationsSubtitle,
    ),
    settingsTitle: str(s.settingsTitle, SECTION_COPY_DEFAULTS.settingsTitle),
    settingsSubtitle: str(s.settingsSubtitle, SECTION_COPY_DEFAULTS.settingsSubtitle),
  };
}

interface AdminSectionCopyPanelProps {
  settings: PlatformSettings;
  onRefresh: () => Promise<void>;
}

export function AdminSectionCopyPanel({ settings, onRefresh }: AdminSectionCopyPanelProps) {
  const { notify, refreshCatalog } = useApp();
  const [form, setForm] = useState<CopyFormState>(() => buildCopyState(settings));
  const [group, setGroup] = useState<SectionGroupFilter>('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildCopyState(settings));
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      await Promise.all([onRefresh(), refreshCatalog()]);
      notify('Wallet & workspace section write-ups saved permanently!', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save write-ups', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setForm((prev) => ({
      ...prev,
      ...SECTION_COPY_DEFAULTS,
    }));
    notify('Default write-ups restored. Click Save All Write-Ups to publish.', 'info');
  };

  const showGroup = (id: Exclude<SectionGroupFilter, 'all'>) => group === 'all' || group === id;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 border border-slate-800 shadow-lg">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
            <FileText className="w-3.5 h-3.5" />
            Overwatch · Section Write-Ups Studio
          </div>
          <h2 className="font-display text-lg font-extrabold">
            Edit Wallet &amp; Every Section Write-Up
          </h2>
          <p className="text-xs text-slate-300">
            Customize headlines, instructions, notice banners, button text, and descriptions across Wallet &amp; Funding, Dashboard, Marketplace, SMS, Boosting, Orders, History, Referrals, Support, Tutorials &amp; Settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-xl shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save All Write-Ups'}
          </button>
        </div>
      </div>

      {/* Section Filter Pills + Dynamic Token Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Sections' },
              { id: 'wallet', label: 'Wallet & Funding' },
              { id: 'overview', label: 'Dashboard & Notice' },
              { id: 'marketplace', label: 'Marketplace' },
              { id: 'services', label: 'SMS & Boosting' },
              { id: 'history', label: 'Orders & History' },
              { id: 'community', label: 'Referrals, Support & More' },
            ] as { id: SectionGroupFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGroup(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                group === item.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Optional smart tokens you can use anywhere:{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {'{{BANK}}'}
          </code>{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {'{{SYMBOL}}'}
          </code>{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {'{{SITE}}'}
          </code>{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {'{{BONUS}}'}
          </code>{' '}
          <code className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {'{{NAME}}'}
          </code>
        </p>
      </div>

      {/* 1. WALLET & FUNDING WRITE-UPS */}
      {showGroup('wallet') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Wallet className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Wallet &amp; Funding Section Write-Ups
              </h3>
              <p className="text-[11px] text-slate-500">
                Controls all headlines, instructions, notice banners, form labels, and activity headings shown on the Wallet page.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Wallet Page Title</label>
              <input
                type="text"
                value={form.walletPageTitle}
                onChange={(e) => setForm({ ...form, walletPageTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Funding Card Header</label>
              <input
                type="text"
                value={form.walletCardHeader}
                onChange={(e) => setForm({ ...form, walletCardHeader: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Wallet Page Subtitle / Instructions
              </label>
              <textarea
                rows={2}
                value={form.walletPageSubtitle}
                onChange={(e) => setForm({ ...form, walletPageSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-amber-700 dark:text-amber-400">
                Wallet Page Extra Notice / Alert Box (Optional — leave blank to hide)
              </label>
              <textarea
                rows={2}
                value={form.walletNoticeText}
                onChange={(e) => setForm({ ...form, walletNoticeText: e.target.value })}
                placeholder="Optional notice banner shown at the top of the Wallet page (e.g. transfer cutoff reminders or special deposit notes)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Receipt Form Title</label>
              <input
                type="text"
                value={form.walletFormTitle}
                onChange={(e) => setForm({ ...form, walletFormTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Submit Button Text</label>
              <input
                type="text"
                value={form.walletSubmitButtonLabel}
                onChange={(e) => setForm({ ...form, walletSubmitButtonLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Receipt Upload Hint Text</label>
              <input
                type="text"
                value={form.walletUploadHint}
                onChange={(e) => setForm({ ...form, walletUploadHint: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Recent Activity Heading</label>
              <input
                type="text"
                value={form.walletActivityTitle}
                onChange={(e) => setForm({ ...form, walletActivityTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Empty Activity Text</label>
              <input
                type="text"
                value={form.walletEmptyActivityText}
                onChange={(e) => setForm({ ...form, walletEmptyActivityText: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. DASHBOARD OVERVIEW & NOTICE BANNER WRITE-UPS */}
      {showGroup('overview') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Dashboard Overview, Notice Box &amp; Balance Card Write-Ups
                </h3>
                <p className="text-[11px] text-slate-500">
                  Edit the yellow top notice banner, user dashboard greeting, wallet card labels, and sidebar balance title.
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.dashboardNoticeEnabled}
                onChange={(e) => setForm({ ...form, dashboardNoticeEnabled: e.target.checked })}
              />
              {form.dashboardNoticeEnabled ? 'Notice Visible' : 'Hidden'}
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Dashboard Notice Banner Text
              </label>
              <textarea
                rows={2}
                value={form.dashboardNoticeText}
                onChange={(e) => setForm({ ...form, dashboardNoticeText: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Notice Colour Tone</label>
              <select
                value={form.dashboardNoticeTone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dashboardNoticeTone: e.target.value as CopyFormState['dashboardNoticeTone'],
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="amber">Amber (Warning)</option>
                <option value="info">Blue (Info)</option>
                <option value="emerald">Emerald (Safe)</option>
                <option value="rose">Rose (Urgent)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Dashboard Title (<code className="font-mono">{'{{NAME}}'}</code>)
              </label>
              <input
                type="text"
                value={form.dashboardWalletTitle}
                onChange={(e) => setForm({ ...form, dashboardWalletTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Dashboard Wallet Subtitle</label>
              <input
                type="text"
                value={form.dashboardWalletSubtitle}
                onChange={(e) => setForm({ ...form, dashboardWalletSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Wallet Top Badge</label>
              <input
                type="text"
                value={form.dashboardWalletBadge}
                onChange={(e) => setForm({ ...form, dashboardWalletBadge: e.target.value })}
                placeholder="Optional pill badge"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Balance Label</label>
              <input
                type="text"
                value={form.dashboardBalanceLabel}
                onChange={(e) => setForm({ ...form, dashboardBalanceLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Add Funds Button Text</label>
              <input
                type="text"
                value={form.dashboardFundButtonLabel}
                onChange={(e) => setForm({ ...form, dashboardFundButtonLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">History Button Text</label>
              <input
                type="text"
                value={form.dashboardHistoryButtonLabel}
                onChange={(e) => setForm({ ...form, dashboardHistoryButtonLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. MARKETPLACE WRITE-UPS */}
      {showGroup('marketplace') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Marketplace Section &amp; Buy-Page Warning Write-Ups
              </h3>
              <p className="text-[11px] text-slate-500">
                Customize the Marketplace header, paused alert, and default checkout buy-page warning.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Marketplace Page Title</label>
              <input
                type="text"
                value={form.marketplaceTitle}
                onChange={(e) => setForm({ ...form, marketplaceTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Default Buy-Page Warning Tone
              </label>
              <select
                value={form.defaultBuyWarningLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultBuyWarningLevel: e.target.value as 'serious' | 'info',
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="serious">Serious Warning (Amber)</option>
                <option value="info">Info Tip (Blue)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Marketplace Subtitle</label>
              <input
                type="text"
                value={form.marketplaceSubtitle}
                onChange={(e) => setForm({ ...form, marketplaceSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Default Product Buy-Page Warning Notice
              </label>
              <textarea
                rows={2}
                value={form.defaultBuyWarning}
                onChange={(e) => setForm({ ...form, defaultBuyWarning: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Marketplace Paused Notice Text
              </label>
              <input
                type="text"
                value={form.marketplacePausedText}
                onChange={(e) => setForm({ ...form, marketplacePausedText: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. VIRTUAL SMS & SOCIAL BOOSTING WRITE-UPS */}
      {showGroup('services') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Phone className="w-4 h-4 text-emerald-600" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Virtual SMS Section Write-Ups
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">SMS Page Title</label>
                <input
                  type="text"
                  value={form.smsTitle}
                  onChange={(e) => setForm({ ...form, smsTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">SMS Page Subtitle</label>
                <textarea
                  rows={2}
                  value={form.smsSubtitle}
                  onChange={(e) => setForm({ ...form, smsSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Inbox Title</label>
                  <input
                    type="text"
                    value={form.smsInboxTitle}
                    onChange={(e) => setForm({ ...form, smsInboxTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Rent Button Label</label>
                  <input
                    type="text"
                    value={form.smsRentButtonLabel}
                    onChange={(e) => setForm({ ...form, smsRentButtonLabel: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Session Refund Footer Note</label>
                <input
                  type="text"
                  value={form.smsSessionNote}
                  onChange={(e) => setForm({ ...form, smsSessionNote: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">SMS Paused Notice</label>
                <input
                  type="text"
                  value={form.smsPausedText}
                  onChange={(e) => setForm({ ...form, smsPausedText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Social Boosting Section Write-Ups
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Boosting Page Title</label>
                <input
                  type="text"
                  value={form.boostingTitle}
                  onChange={(e) => setForm({ ...form, boostingTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Boosting Page Subtitle</label>
                <textarea
                  rows={2}
                  value={form.boostingSubtitle}
                  onChange={(e) => setForm({ ...form, boostingSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Campaign History Title</label>
                <input
                  type="text"
                  value={form.boostingHistoryTitle}
                  onChange={(e) => setForm({ ...form, boostingHistoryTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Empty Campaign List Text</label>
                <input
                  type="text"
                  value={form.boostingEmptyText}
                  onChange={(e) => setForm({ ...form, boostingEmptyText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Boosting Paused Notice</label>
                <input
                  type="text"
                  value={form.boostingPausedText}
                  onChange={(e) => setForm({ ...form, boostingPausedText: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ORDERS & TRANSACTION HISTORY WRITE-UPS */}
      {showGroup('history') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <PackageCheck className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Orders &amp; Transaction History Write-Ups
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">My Orders Title</label>
              <input
                type="text"
                value={form.ordersTitle}
                onChange={(e) => setForm({ ...form, ordersTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Transaction History Title</label>
              <input
                type="text"
                value={form.transactionsTitle}
                onChange={(e) => setForm({ ...form, transactionsTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">My Orders Subtitle</label>
              <textarea
                rows={2}
                value={form.ordersSubtitle}
                onChange={(e) => setForm({ ...form, ordersSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Transaction History Subtitle
              </label>
              <textarea
                rows={2}
                value={form.transactionsSubtitle}
                onChange={(e) => setForm({ ...form, transactionsSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. REFERRALS, TUTORIALS, SUPPORT, NOTIFICATIONS & SETTINGS */}
      {showGroup('community') && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Gift className="w-4 h-4 text-blue-600" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Refer &amp; Earn Write-Ups
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Referral Page Title</label>
                <input
                  type="text"
                  value={form.referralTitle}
                  onChange={(e) => setForm({ ...form, referralTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Hero Card Badge</label>
                <input
                  type="text"
                  value={form.referralCardBadge}
                  onChange={(e) => setForm({ ...form, referralCardBadge: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Referral Page Subtitle</label>
                <input
                  type="text"
                  value={form.referralSubtitle}
                  onChange={(e) => setForm({ ...form, referralSubtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Share Card Headline</label>
                <input
                  type="text"
                  value={form.referralCardHeadline}
                  onChange={(e) => setForm({ ...form, referralCardHeadline: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Share Card Write-Up</label>
                <textarea
                  rows={2}
                  value={form.referralCardDesc}
                  onChange={(e) => setForm({ ...form, referralCardDesc: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <BookOpen className="w-4 h-4 text-sky-600" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Tutorials, Support Desk, Notifications &amp; Account Settings Write-Ups
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  Tutorials Section
                </p>
                <input
                  type="text"
                  value={form.tutorialsTitle}
                  onChange={(e) => setForm({ ...form, tutorialsTitle: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.tutorialsSubtitle}
                  onChange={(e) => setForm({ ...form, tutorialsSubtitle: e.target.value })}
                  placeholder="Subtitle"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />
                  Support Desk Section
                </p>
                <input
                  type="text"
                  value={form.supportTitle}
                  onChange={(e) => setForm({ ...form, supportTitle: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.supportSubtitle}
                  onChange={(e) => setForm({ ...form, supportSubtitle: e.target.value })}
                  placeholder="Subtitle"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  Notifications Section
                </p>
                <input
                  type="text"
                  value={form.notificationsTitle}
                  onChange={(e) => setForm({ ...form, notificationsTitle: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.notificationsSubtitle}
                  onChange={(e) => setForm({ ...form, notificationsSubtitle: e.target.value })}
                  placeholder="Subtitle"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  Account Settings Section
                </p>
                <input
                  type="text"
                  value={form.settingsTitle}
                  onChange={(e) => setForm({ ...form, settingsTitle: e.target.value })}
                  placeholder="Title"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.settingsSubtitle}
                  onChange={(e) => setForm({ ...form, settingsSubtitle: e.target.value })}
                  placeholder="Subtitle"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl shadow-sm cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Write-Ups...' : 'Save Wallet & All Section Write-Ups'}
        </button>
      </div>
    </form>
  );
}
