import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Crown,
  Edit3,
  Film,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  Layers,
  LayoutTemplate,
  Mail,
  Megaphone,
  MessageCircle,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../BrandLogo';
import {
  apiFetch,
  fileToDataUrl,
  formatAccountCredential,
  formatNaira,
  parseAccountCredential,
  resolveApiUrl,
} from '../../lib/api';
import { applyWebsitePalette, COLOR_PRESETS, DEFAULT_PALETTE } from '../../lib/themeColor';
import type {
  BoostingService,
  CustomSection,
  EmailLog,
  MarketplaceCategory,
  MarketplaceListing,
  NotificationItem,
  PlatformSettings,
  PublicUser,
  SmsCountry,
  SmsService,
  SupportTicket,
  TutorialItem,
} from '../../types';

export interface AdminOverviewPayload {
  settings: PlatformSettings;
  users: PublicUser[];
  smsServices: SmsService[];
  smsCountries: SmsCountry[];
  boostingServices: BoostingService[];
  marketplaceCategories: MarketplaceCategory[];
  marketplaceListings: MarketplaceListing[];
  customSections: CustomSection[];
  notifications: NotificationItem[];
  emailLogs: EmailLog[];
  tutorials: TutorialItem[];
  tickets: SupportTicket[];
}

interface CatalogProps {
  data: AdminOverviewPayload;
  onRefresh: () => Promise<void>;
}

export function AdminCatalogPanel({ data, onRefresh }: CatalogProps) {
  const { notify, refreshCatalog } = useApp();
  const symbol = data.settings.currencySymbol || '₦';
  const [subTab, setSubTab] = useState<
    'marketplace' | 'sms' | 'countries' | 'boosting' | 'sections'
  >('marketplace');

  // Create Marketplace Listing state
  const [mktTitle, setMktTitle] = useState('');
  const [mktCategory, setMktCategory] = useState(
    data.marketplaceCategories[0]?.name || 'Proxies',
  );
  const [mktPopularTag, setMktPopularTag] = useState('Proxy');
  const [mktPrice, setMktPrice] = useState(3500);
  const [mktStock, setMktStock] = useState(25);
  const [mktSpec, setMktSpec] = useState('');
  const [mktDescription, setMktDescription] = useState('');
  const [mktBuyWarning, setMktBuyWarning] = useState(data.settings.defaultBuyWarning || '');
  const [mktTemplate, setMktTemplate] = useState('KEY-{{KEY4}}-{{KEY4}}-{{RAND4}}');
  const [mktImage, setMktImage] = useState(
    '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
  );
  const [mktLogo, setMktLogo] = useState('');
  const [mktBounce, setMktBounce] = useState(true);
  const [mktAccounts, setMktAccounts] = useState<string[]>([]);
  const [acctLogin, setAcctLogin] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [acct2fa, setAcct2fa] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Full Product Edit Modal state
  const [editingListing, setEditingListing] = useState<MarketplaceListing | null>(null);
  const [editFeaturesText, setEditFeaturesText] = useState('');
  const [editStockKeys, setEditStockKeys] = useState<string[]>([]);
  const [editAcctLogin, setEditAcctLogin] = useState('');
  const [editAcctPassword, setEditAcctPassword] = useState('');
  const [editAcct2fa, setEditAcct2fa] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // SMS Service form
  const [svcName, setSvcName] = useState('');
  const [svcCat, setSvcCat] = useState('Social');
  const [svcPrice, setSvcPrice] = useState(1200);
  const [svcStock, setSvcStock] = useState(1000);
  const [svcTemplate, setSvcTemplate] = useState('Your verification code is {{CODE}}.');

  // Country form
  const [cntName, setCntName] = useState('');
  const [cntCode, setCntCode] = useState('US');
  const [cntDial, setCntDial] = useState('+1');
  const [cntMult, setCntMult] = useState(1.0);

  // Boosting form
  const [bstPlatform, setBstPlatform] = useState('Instagram');
  const [bstCategory, setBstCategory] = useState('Followers');
  const [bstName, setBstName] = useState('');
  const [bstRate, setBstRate] = useState(2500);
  const [bstMin, setBstMin] = useState(100);
  const [bstMax, setBstMax] = useState(50000);
  const [bstSpeed, setBstSpeed] = useState('15K / day');
  const [bstRefill, setBstRefill] = useState('30-Day Refill');

  // Custom Sections form
  const [secName, setSecName] = useState('');
  const [secDesc, setSecDesc] = useState('');
  const [prodSectionId, setProdSectionId] = useState(data.customSections[0]?.id || '');
  const [prodTitle, setProdTitle] = useState('');
  const [prodSpec, setProdSpec] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodWarning, setProdWarning] = useState('');
  const [prodPrice, setProdPrice] = useState(2500);
  const [prodStock, setProdStock] = useState(20);
  const [prodTemplate, setProdTemplate] = useState('ACCESS-{{KEY4}}-{{RAND4}}');

  const syncAll = async () => {
    await onRefresh();
    await refreshCatalog();
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setter(url);
    } catch {
      notify('Could not read image file', 'error');
    }
  };

  const openEditModal = (item: MarketplaceListing) => {
    setEditingListing({ ...item });
    setEditFeaturesText((item.features || []).join('\n'));
    setEditStockKeys([...(item.stockKeys || [])]);
    setEditAcctLogin('');
    setEditAcctPassword('');
    setEditAcct2fa('');
  };

  const handleQueueCreateAccount = () => {
    if (!acctLogin.trim() || !acctPassword.trim()) {
      notify('Please enter both Login and Password before adding', 'error');
      return;
    }
    const formatted = formatAccountCredential(acctLogin, acctPassword, acct2fa);
    const next = [...mktAccounts, formatted];
    setMktAccounts(next);
    setMktStock(next.length);
    setAcctLogin('');
    setAcctPassword('');
    setAcct2fa('');
    notify(`Account #${next.length} added! Add another or publish product.`, 'success');
  };

  const handleQueueEditAccount = () => {
    if (!editAcctLogin.trim() || !editAcctPassword.trim()) {
      notify('Please enter both Login and Password before adding', 'error');
      return;
    }
    const formatted = formatAccountCredential(editAcctLogin, editAcctPassword, editAcct2fa);
    const next = [...editStockKeys, formatted];
    setEditStockKeys(next);
    setEditingListing((prev) => (prev ? { ...prev, stock: next.length } : prev));
    setEditAcctLogin('');
    setEditAcctPassword('');
    setEditAcct2fa('');
    notify(`Account #${next.length} queued! Add another or save changes.`, 'success');
  };

  const handleSaveListingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;
    if ((editAcctLogin.trim() && !editAcctPassword.trim()) || (!editAcctLogin.trim() && editAcctPassword.trim())) {
      notify('Complete both Login and Password for the account you started typing, or clear it.', 'error');
      return;
    }
    const finalKeys = [...editStockKeys];
    if (editAcctLogin.trim() && editAcctPassword.trim()) {
      finalKeys.push(formatAccountCredential(editAcctLogin, editAcctPassword, editAcct2fa));
    }
    setSavingEdit(true);
    try {
      await apiFetch(`/api/admin/marketplace-listings/${editingListing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editingListing.title,
          category: editingListing.category,
          popularTag: editingListing.popularTag,
          shortSpec: editingListing.shortSpec,
          description: editingListing.description,
          buyWarning: editingListing.buyWarning,
          deliveryType: editingListing.deliveryType,
          price: Number(editingListing.price),
          stock: finalKeys.length > 0 ? finalKeys.length : Number(editingListing.stock),
          imageUrl: editingListing.imageUrl,
          logoUrl: editingListing.logoUrl,
          bounceLogo: editingListing.bounceLogo,
          credentialTemplate: editingListing.credentialTemplate,
          features: editFeaturesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          stockKeys: finalKeys,
          active: editingListing.active,
        }),
      });
      setEditingListing(null);
      notify('Product details, accounts & buy warning saved permanently!', 'success');
      await syncAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update product', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'marketplace', label: `Marketplace (${data.marketplaceListings.length})` },
            { id: 'sms', label: `SMS Services (${data.smsServices.length})` },
            { id: 'countries', label: `SMS Countries (${data.smsCountries.length})` },
            { id: 'boosting', label: `Boosting Packages (${data.boostingServices.length})` },
            { id: 'sections', label: `Custom Sections (${data.customSections.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              subTab === t.id
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MARKETPLACE CRUD */}
      {subTab === 'marketplace' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  (acctLogin.trim() && !acctPassword.trim()) ||
                  (!acctLogin.trim() && acctPassword.trim())
                ) {
                  notify(
                    'Please enter both Login and Password for the account you started typing, or clear the fields.',
                    'error',
                  );
                  return;
                }
                const finalAccounts = [...mktAccounts];
                if (acctLogin.trim() && acctPassword.trim()) {
                  finalAccounts.push(formatAccountCredential(acctLogin, acctPassword, acct2fa));
                }
                try {
                  await apiFetch('/api/admin/marketplace-listings', {
                    method: 'POST',
                    body: JSON.stringify({
                      title: mktTitle,
                      category: mktCategory,
                      popularTag: mktPopularTag,
                      price: Number(mktPrice),
                      stock:
                        finalAccounts.length > 0 ? finalAccounts.length : Number(mktStock),
                      shortSpec: mktSpec,
                      description: mktDescription,
                      buyWarning: mktBuyWarning,
                      credentialTemplate: mktTemplate,
                      stockKeys: finalAccounts,
                      imageUrl: mktImage,
                      logoUrl: mktLogo,
                      bounceLogo: mktBounce,
                    }),
                  });
                  setMktTitle('');
                  setMktSpec('');
                  setMktDescription('');
                  setMktLogo('');
                  setMktAccounts([]);
                  setAcctLogin('');
                  setAcctPassword('');
                  setAcct2fa('');
                  setMktStock(25);
                  notify(
                    finalAccounts.length > 0
                      ? `Product published with ${finalAccounts.length} account(s) ready for delivery!`
                      : 'Marketplace listing created!',
                    'success',
                  );
                  await syncAll();
                } catch (err) {
                  notify(err instanceof Error ? err.message : 'Failed to create listing', 'error');
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Create New Marketplace Product
              </h3>

              <input
                type="text"
                required
                value={mktTitle}
                onChange={(e) => setMktTitle(e.target.value)}
                placeholder="Product Title (e.g. Aged Instagram Account)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={mktCategory}
                  onChange={(e) => setMktCategory(e.target.value)}
                  className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {data.marketplaceCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={mktPopularTag}
                  onChange={(e) => setMktPopularTag(e.target.value)}
                  placeholder="Popular Filter Tag (VPN, Proxy, Facebook)"
                  className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  required
                  value={mktPrice}
                  onChange={(e) => setMktPrice(Number(e.target.value))}
                  placeholder="Price (₦)"
                  className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="number"
                  required
                  value={mktAccounts.length > 0 ? mktAccounts.length : mktStock}
                  disabled={mktAccounts.length > 0}
                  onChange={(e) => setMktStock(Number(e.target.value))}
                  placeholder="Stock"
                  title={
                    mktAccounts.length > 0
                      ? 'Stock is automatically synced to queued accounts count'
                      : 'Stock'
                  }
                  className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 disabled:opacity-70"
                />
              </div>
              <input
                type="text"
                value={mktSpec}
                onChange={(e) => setMktSpec(e.target.value)}
                placeholder="Short subtitle (shown on card)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={mktDescription}
                onChange={(e) => setMktDescription(e.target.value)}
                placeholder="Full product description (shown on buy modal)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={mktBuyWarning}
                onChange={(e) => setMktBuyWarning(e.target.value)}
                placeholder="Custom Buy Page Warning (shown in alert box before checkout)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
              />

              {/* Sequential Login + Password + 2FA Account Builder */}
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Product Accounts / Credentials ({mktAccounts.length} queued)
                  </p>
                  {mktAccounts.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                      Stock: {mktAccounts.length}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Enter Login, Password &amp; 2FA, click <strong>+ Add Account</strong>, then add
                  more accounts one by one before uploading the product.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={acctLogin}
                    onChange={(e) => setAcctLogin(e.target.value)}
                    placeholder="Login / Username / Email"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={acctPassword}
                      onChange={(e) => setAcctPassword(e.target.value)}
                      placeholder="Password"
                      className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      value={acct2fa}
                      onChange={(e) => setAcct2fa(e.target.value)}
                      placeholder="2FA Key / Code (optional)"
                      className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleQueueCreateAccount}
                    className="w-full py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Account ({mktAccounts.length + 1}) &amp; Add Another
                  </button>
                </div>

                {mktAccounts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                    {mktAccounts.map((raw, idx) => {
                      const parsed = parseAccountCredential(raw);
                      return (
                        <div
                          key={`${idx}-${raw.slice(0, 12)}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]"
                        >
                          <div className="min-w-0 flex-1 font-mono truncate">
                            <span className="font-bold text-blue-600 mr-1.5">#{idx + 1}</span>
                            {parsed ? (
                              <span className="text-slate-700 dark:text-slate-300">
                                {parsed.login} · {parsed.password} · 2FA: {parsed.twoFactor}
                              </span>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300">{raw}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = mktAccounts.filter((_, i) => i !== idx);
                              setMktAccounts(next);
                              if (next.length > 0) setMktStock(next.length);
                            }}
                            className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                            aria-label={`Remove account ${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <details className="text-[11px] text-slate-500">
                <summary className="cursor-pointer font-semibold hover:text-slate-700 dark:hover:text-slate-300">
                  Fallback Key Template (only if 0 accounts queued)
                </summary>
                <input
                  type="text"
                  value={mktTemplate}
                  onChange={(e) => setMktTemplate(e.target.value)}
                  placeholder="Credential Template ({{KEY4}}, {{RAND4}})"
                  className="mt-2 w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </details>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload Cover
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadImage(e, setMktImage)}
                    className="hidden"
                  />
                </label>
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadImage(e, setMktLogo)}
                    className="hidden"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mktBounce}
                  onChange={(e) => setMktBounce(e.target.checked)}
                />
                Enable floating/bouncing product logo
              </label>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                {mktAccounts.length > 0
                  ? `Publish Product (${mktAccounts.length} Accounts)`
                  : 'Publish Product'}
              </button>
            </form>

            {/* Category Manager */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Marketplace Categories
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newCatName.trim()) return;
                    try {
                      await apiFetch('/api/admin/marketplace-categories', {
                        method: 'POST',
                        body: JSON.stringify({ name: newCatName.trim() }),
                      });
                      setNewCatName('');
                      notify('Category added', 'success');
                      await syncAll();
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'Failed to add category', 'error');
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-xl cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.marketplaceCategories.map((c) => (
                  <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/marketplace-categories/${c.id}`, {
                            method: 'DELETE',
                          });
                          await syncAll();
                        } catch (err) {
                          notify(
                            err instanceof Error ? err.message : 'Failed to delete category',
                            'error',
                          );
                        }
                      }}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  All Marketplace Products
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click &ldquo;Full Edit&rdquo; on any item to customize descriptions, buy-page
                  warnings, stock keys, and logos.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.marketplaceListings.map((item) => (
                <div key={item.id} className="py-4 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {item.description || item.shortSpec}
                      </p>
                      {item.buyWarning && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1 line-clamp-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Warning: {item.buyWarning}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        defaultValue={item.price}
                        onBlur={async (e) => {
                          const val = Number(e.target.value);
                          if (!Number.isFinite(val) || val < 0) {
                            e.target.value = String(item.price);
                            return;
                          }
                          if (val !== item.price) {
                            try {
                              await apiFetch(`/api/admin/marketplace-listings/${item.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ price: val }),
                              });
                              notify(`Updated ${item.title} price`, 'success');
                              await syncAll();
                            } catch (err) {
                              e.target.value = String(item.price);
                              notify(
                                err instanceof Error ? err.message : 'Failed to update price',
                                'error',
                              );
                            }
                          }
                        }}
                        className="w-24 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                        title="Price"
                      />
                      <input
                        type="number"
                        min={0}
                        defaultValue={item.stock}
                        onBlur={async (e) => {
                          const val = Number(e.target.value);
                          if (!Number.isFinite(val) || val < 0) {
                            e.target.value = String(item.stock);
                            return;
                          }
                          if (val !== item.stock) {
                            try {
                              await apiFetch(`/api/admin/marketplace-listings/${item.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ stock: val }),
                              });
                              notify(`Updated ${item.title} stock`, 'success');
                              await syncAll();
                            } catch (err) {
                              e.target.value = String(item.stock);
                              notify(
                                err instanceof Error ? err.message : 'Failed to update stock',
                                'error',
                              );
                            }
                          }
                        }}
                        className="w-16 px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                        title="Stock"
                      />
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Full Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/admin/marketplace-listings/${item.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ active: !item.active }),
                            });
                            await syncAll();
                          } catch (err) {
                            notify(
                              err instanceof Error ? err.message : 'Failed to toggle listing',
                              'error',
                            );
                          }
                        }}
                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg cursor-pointer ${
                          item.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.active ? 'Active' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/admin/marketplace-listings/${item.id}`, {
                              method: 'DELETE',
                            });
                            notify('Listing deleted', 'info');
                            await syncAll();
                          } catch (err) {
                            notify(
                              err instanceof Error ? err.message : 'Failed to delete listing',
                              'error',
                            );
                          }
                        }}
                        className="text-rose-500 hover:text-rose-600 p-1.5 cursor-pointer"
                        aria-label="Delete listing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FULL PRODUCT EDIT MODAL */}
      {editingListing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingListing(null)}
        >
          <form
            onSubmit={handleSaveListingEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 my-auto shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Edit Marketplace Product
                </h3>
                <p className="text-xs text-slate-500">
                  Changes save permanently to disk and appear immediately on user checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Product Title
                </label>
                <input
                  type="text"
                  required
                  value={editingListing.title}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Category
                </label>
                <select
                  value={editingListing.category}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, category: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {data.marketplaceCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Price ({symbol})
                </label>
                <input
                  type="number"
                  required
                  value={editingListing.price}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, price: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Stock Count
                </label>
                <input
                  type="number"
                  required
                  value={editingListing.stock}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, stock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Popular Filter Chip Tag
                </label>
                <input
                  type="text"
                  value={editingListing.popularTag || ''}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, popularTag: e.target.value })
                  }
                  placeholder="Proxy, VPN, Bots, Facebook"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Short Spec Subtitle
                </label>
                <input
                  type="text"
                  value={editingListing.shortSpec}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, shortSpec: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Full Product Description (Shown on Buy Modal)
              </label>
              <textarea
                rows={3}
                value={editingListing.description}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, description: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400 mb-1">
                Admin Buy Page Warning Notice (Shown to user before purchase)
              </label>
              <textarea
                rows={3}
                value={editingListing.buyWarning || ''}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, buyWarning: e.target.value })
                }
                placeholder="Write the exact warning buyers must read before purchasing this item..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Features (One per line)
                </label>
                <textarea
                  rows={2}
                  value={editFeaturesText}
                  onChange={(e) => setEditFeaturesText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Product Accounts: Login, Password &amp; 2FA ({editStockKeys.length} queued)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editAcctLogin}
                    onChange={(e) => setEditAcctLogin(e.target.value)}
                    placeholder="Login / Username"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={editAcctPassword}
                    onChange={(e) => setEditAcctPassword(e.target.value)}
                    placeholder="Password"
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={editAcct2fa}
                    onChange={(e) => setEditAcct2fa(e.target.value)}
                    placeholder="2FA Key / Code"
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQueueEditAccount}
                  className="w-full py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Account ({editStockKeys.length + 1}) &amp; Add Another
                </button>

                {editStockKeys.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                    {editStockKeys.map((raw, idx) => {
                      const parsed = parseAccountCredential(raw);
                      return (
                        <div
                          key={`${idx}-${raw.slice(0, 12)}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]"
                        >
                          <div className="min-w-0 flex-1 font-mono truncate">
                            <span className="font-bold text-blue-600 mr-1.5">#{idx + 1}</span>
                            {parsed ? (
                              <span>
                                {parsed.login} · {parsed.password} · 2FA: {parsed.twoFactor}
                              </span>
                            ) : (
                              <span>{raw}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = editStockKeys.filter((_, i) => i !== idx);
                              setEditStockKeys(next);
                              setEditingListing((prev) =>
                                prev ? { ...prev, stock: next.length } : prev,
                              );
                            }}
                            className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                            aria-label={`Remove queued account ${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Credential Fallback Template
                </label>
                <input
                  type="text"
                  value={editingListing.credentialTemplate}
                  onChange={(e) =>
                    setEditingListing({ ...editingListing, credentialTemplate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Cover Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleUploadImage(e, (url) =>
                        setEditingListing((prev) => (prev ? { ...prev, imageUrl: url } : prev)),
                      )
                    }
                    className="hidden"
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Brand Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleUploadImage(e, (url) =>
                        setEditingListing((prev) => (prev ? { ...prev, logoUrl: url } : prev)),
                      )
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingListing.bounceLogo}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, bounceLogo: e.target.checked })
                    }
                  />
                  Bounce Logo
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingListing.active}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, active: e.target.checked })
                    }
                  />
                  Visible in Store
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Product Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SMS SERVICES CRUD */}
      {subTab === 'sms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch('/api/admin/sms-services', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: svcName,
                    category: svcCat,
                    basePrice: Number(svcPrice),
                    stock: Number(svcStock),
                    sampleTemplate: svcTemplate,
                  }),
                });
                setSvcName('');
                notify('SMS service added!', 'success');
                await syncAll();
              } catch (err) {
                notify(err instanceof Error ? err.message : 'Failed to add SMS service', 'error');
              }
            }}
            className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Add SMS Service
            </h3>
            <input
              type="text"
              required
              value={svcName}
              onChange={(e) => setSvcName(e.target.value)}
              placeholder="Service Name (e.g. PayPal)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={svcCat}
                onChange={(e) => setSvcCat(e.target.value)}
                placeholder="Category"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="number"
                value={svcPrice}
                onChange={(e) => setSvcPrice(Number(e.target.value))}
                placeholder="Base Price (₦)"
                className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <input
              type="number"
              value={svcStock}
              onChange={(e) => setSvcStock(Number(e.target.value))}
              placeholder="Stock count"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <input
              type="text"
              value={svcTemplate}
              onChange={(e) => setSvcTemplate(e.target.value)}
              placeholder="OTP SMS Template with {{CODE}}"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
            >
              Add SMS Service
            </button>
          </form>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              SMS Services (Edit Base Price Inline)
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.smsServices.map((svc) => (
                <div key={svc.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{svc.name}</p>
                    <p className="text-xs text-slate-500">
                      {svc.category} · {svc.successRate}% rate · {svc.stock} stock
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{symbol}</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={svc.basePrice}
                      onBlur={async (e) => {
                        const val = Number(e.target.value);
                        if (!Number.isFinite(val) || val < 0) {
                          e.target.value = String(svc.basePrice);
                          return;
                        }
                        if (val !== svc.basePrice) {
                          try {
                            await apiFetch(`/api/admin/sms-services/${svc.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ basePrice: val }),
                            });
                            notify(`Updated ${svc.name} price`, 'success');
                            await syncAll();
                          } catch (err) {
                            e.target.value = String(svc.basePrice);
                            notify(err instanceof Error ? err.message : 'Price update failed', 'error');
                          }
                        }
                      }}
                      className="w-24 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/sms-services/${svc.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ active: !svc.active }),
                          });
                          await syncAll();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Toggle failed', 'error');
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                        svc.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {svc.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/sms-services/${svc.id}`, { method: 'DELETE' });
                          await syncAll();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                        }
                      }}
                      className="text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SMS COUNTRIES CRUD */}
      {subTab === 'countries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch('/api/admin/sms-countries', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: cntName,
                    code: cntCode,
                    dialCode: cntDial,
                    multiplier: Number(cntMult),
                  }),
                });
                setCntName('');
                notify('Country added!', 'success');
                await syncAll();
              } catch (err) {
                notify(err instanceof Error ? err.message : 'Failed to add country', 'error');
              }
            }}
            className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Add SMS Country
            </h3>
            <input
              type="text"
              required
              value={cntName}
              onChange={(e) => setCntName(e.target.value)}
              placeholder="Country Name"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={cntCode}
                onChange={(e) => setCntCode(e.target.value)}
                placeholder="ISO (US)"
                className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={cntDial}
                onChange={(e) => setCntDial(e.target.value)}
                placeholder="Dial (+1)"
                className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="number"
                step="0.05"
                value={cntMult}
                onChange={(e) => setCntMult(Number(e.target.value))}
                placeholder="1.0x"
                className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
            >
              Add Country
            </button>
          </form>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 divide-y divide-slate-100 dark:divide-slate-800">
            {data.smsCountries.map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {c.name} ({c.dialCode})
                  </p>
                  <p className="text-xs text-slate-500">ISO: {c.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min={0.1}
                    defaultValue={c.multiplier}
                    onBlur={async (e) => {
                      const val = Number(e.target.value);
                      if (!Number.isFinite(val) || val < 0.1) {
                        e.target.value = String(c.multiplier);
                        return;
                      }
                      if (val !== c.multiplier) {
                        try {
                          await apiFetch(`/api/admin/sms-countries/${c.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ multiplier: val }),
                          });
                          notify(`Updated ${c.name} rate multiplier`, 'success');
                          await syncAll();
                        } catch (err) {
                          e.target.value = String(c.multiplier);
                          notify(err instanceof Error ? err.message : 'Multiplier update failed', 'error');
                        }
                      }
                    }}
                    className="w-20 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/sms-countries/${c.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ active: !c.active }),
                        });
                        await syncAll();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Toggle failed', 'error');
                      }
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                      c.active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/sms-countries/${c.id}`, { method: 'DELETE' });
                        await syncAll();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                      }
                    }}
                    className="text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOOSTING SERVICES CRUD */}
      {subTab === 'boosting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch('/api/admin/boosting-services', {
                  method: 'POST',
                  body: JSON.stringify({
                    platform: bstPlatform,
                    category: bstCategory,
                    name: bstName,
                    ratePer1k: Number(bstRate),
                    minQty: Number(bstMin),
                    maxQty: Number(bstMax),
                    speedLabel: bstSpeed,
                    refillPolicy: bstRefill,
                  }),
                });
                setBstName('');
                notify('Boosting package created!', 'success');
                await syncAll();
              } catch (err) {
                notify(err instanceof Error ? err.message : 'Failed to add boosting service', 'error');
              }
            }}
            className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Add Boosting Package
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bstPlatform}
                onChange={(e) => setBstPlatform(e.target.value)}
                placeholder="Platform (e.g. YouTube)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={bstCategory}
                onChange={(e) => setBstCategory(e.target.value)}
                placeholder="Category (Followers)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <input
              type="text"
              required
              value={bstName}
              onChange={(e) => setBstName(e.target.value)}
              placeholder="Package Name"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={bstRate}
                onChange={(e) => setBstRate(Number(e.target.value))}
                placeholder="Rate/1K"
                className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="number"
                value={bstMin}
                onChange={(e) => setBstMin(Number(e.target.value))}
                placeholder="Min Qty"
                className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="number"
                value={bstMax}
                onChange={(e) => setBstMax(Number(e.target.value))}
                placeholder="Max Qty"
                className="px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={bstSpeed}
                onChange={(e) => setBstSpeed(e.target.value)}
                placeholder="Speed"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={bstRefill}
                onChange={(e) => setBstRefill(e.target.value)}
                placeholder="Refill Policy"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
            >
              Publish Boosting Service
            </button>
          </form>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 divide-y divide-slate-100 dark:divide-slate-800">
            {data.boostingServices.map((b) => (
              <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {b.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.platform} · {b.speedLabel} · {b.refillPolicy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={b.ratePer1k}
                    onBlur={async (e) => {
                      const val = Number(e.target.value);
                      if (!Number.isFinite(val) || val < 0) {
                        e.target.value = String(b.ratePer1k);
                        return;
                      }
                      if (val !== b.ratePer1k) {
                        try {
                          await apiFetch(`/api/admin/boosting-services/${b.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ ratePer1k: val }),
                          });
                          notify(`Updated ${b.name} rate`, 'success');
                          await syncAll();
                        } catch (err) {
                          e.target.value = String(b.ratePer1k);
                          notify(err instanceof Error ? err.message : 'Rate update failed', 'error');
                        }
                      }
                    }}
                    className="w-24 px-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/boosting-services/${b.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ active: !b.active }),
                        });
                        await syncAll();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Toggle failed', 'error');
                      }
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg cursor-pointer ${
                      b.active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/boosting-services/${b.id}`, { method: 'DELETE' });
                        await syncAll();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                      }
                    }}
                    className="text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUSTOM STOREFRONT SECTIONS */}
      {subTab === 'sections' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiFetch<{ section: CustomSection }>('/api/admin/sections', {
                    method: 'POST',
                    body: JSON.stringify({ name: secName, description: secDesc }),
                  });
                  setSecName('');
                  setSecDesc('');
                  setProdSectionId(res.section.id);
                  notify('Custom navigation section created!', 'success');
                  await syncAll();
                } catch (err) {
                  notify(err instanceof Error ? err.message : 'Failed to create section', 'error');
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Create Custom Storefront Section
              </h3>
              <input
                type="text"
                required
                value={secName}
                onChange={(e) => setSecName(e.target.value)}
                placeholder="Section Name (e.g. Streaming Accounts)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={secDesc}
                onChange={(e) => setSecDesc(e.target.value)}
                placeholder="Short description"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Create Sidebar Section
              </button>
            </form>

            {data.customSections.length > 0 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch('/api/admin/section-products', {
                      method: 'POST',
                      body: JSON.stringify({
                        sectionId: prodSectionId || data.customSections[0]?.id,
                        title: prodTitle,
                        shortSpec: prodSpec,
                        description: prodDesc,
                        buyWarning: prodWarning,
                        price: Number(prodPrice),
                        stock: Number(prodStock),
                        credentialTemplate: prodTemplate,
                      }),
                    });
                    setProdTitle('');
                    setProdSpec('');
                    setProdDesc('');
                    setProdWarning('');
                    notify('Product added to custom section!', 'success');
                    await syncAll();
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Failed to add product', 'error');
                  }
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Add Product to Custom Section
                </h3>
                <select
                  value={prodSectionId || data.customSections[0]?.id || ''}
                  onChange={(e) => setProdSectionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {data.customSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="Product Title"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={prodSpec}
                  onChange={(e) => setProdSpec(e.target.value)}
                  placeholder="Short Spec"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Full Product Description"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <textarea
                  rows={2}
                  value={prodWarning}
                  onChange={(e) => setProdWarning(e.target.value)}
                  placeholder="Buy Warning Notice"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    placeholder="Price"
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    placeholder="Stock"
                    className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <input
                  type="text"
                  value={prodTemplate}
                  onChange={(e) => setProdTemplate(e.target.value)}
                  placeholder="Vault Credential Template"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 dark:bg-blue-600 rounded-xl cursor-pointer"
                >
                  Add Section Product
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Active Sidebar Sections
            </h3>
            {data.customSections.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No custom sections created yet. Add one on the left to extend your navigation menu.
              </p>
            ) : (
              data.customSections.map((sec) => (
                <div
                  key={sec.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{sec.name}</p>
                      <p className="text-xs text-slate-500">{sec.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/sections/${sec.id}`, { method: 'DELETE' });
                          await syncAll();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Failed to delete section', 'error');
                        }
                      }}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {sec.products.length > 0 && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {sec.products.map((p) => (
                        <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                          <span>
                            {p.title} · <span className="font-mono">{formatNaira(p.price, symbol)}</span> ({p.stock})
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/admin/section-products/${p.id}`, {
                                  method: 'DELETE',
                                });
                                await syncAll();
                              } catch (err) {
                                notify(
                                  err instanceof Error ? err.message : 'Failed to remove product',
                                  'error',
                                );
                              }
                            }}
                            className="text-rose-500 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCommsAndSettingsPanel({
  tab,
  data,
  onRefresh,
  initialRecipientUserId,
}: {
  tab: 'notifications' | 'tutorials' | 'support' | 'settings' | 'cms';
  data: AdminOverviewPayload;
  onRefresh: () => Promise<void>;
  initialRecipientUserId?: string | null;
}) {
  const { notify, refreshCatalog } = useApp();
  const symbol = data.settings.currencySymbol || '₦';

  // Broadcast & Email state
  const [ntfTitle, setNtfTitle] = useState('');
  const [ntfMsg, setNtfMsg] = useState('');
  const [ntfTarget, setNtfTarget] = useState('all');
  const [ntfType, setNtfType] = useState<'info' | 'success' | 'warning'>('info');
  const [ntfUserSearch, setNtfUserSearch] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailUserSearch, setEmailUserSearch] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    if (initialRecipientUserId) {
      const targetUser = data.users.find((u) => u.id === initialRecipientUserId);
      if (targetUser) {
        setNtfTarget(targetUser.id);
        setNtfUserSearch(targetUser.name);
        setEmailTo(targetUser.email);
      }
    }
  }, [initialRecipientUserId, data.users]);

  // Tutorials state
  const [tutTitle, setTutTitle] = useState('');
  const [tutCat, setTutCat] = useState('Wallet & Funding');
  const [tutDur, setTutDur] = useState('2 min read');
  const [tutSum, setTutSum] = useState('');
  const [tutBody, setTutBody] = useState('');
  const [tutVideo, setTutVideo] = useState('');

  // Tickets state
  const [selectedTicketId, setSelectedTicketId] = useState(data.tickets[0]?.id || '');
  const [ticketReply, setTicketReply] = useState('');

  // Default CMS templates for safe hydration & one-click reset
  const DEFAULT_LANDING_STATS = [
    { value: '99.4%', label: 'Campaign completion & auto-refill reliability' },
    { value: '10+ Countries', label: 'Clean SMS OTP carrier coverage worldwide' },
    { value: 'Unified Wallet', label: 'Fast Naira deposits inside your dashboard' },
    { value: 'Instant Vault', label: 'Zero-wait Login, Password & 2FA delivery' },
  ];

  const DEFAULT_SHOWCASE_CARDS = [
    {
      id: 'sc_boost',
      category: 'Social Boosting',
      deliveryType: 'Creator Growth',
      title: 'Instagram & TikTok Viral Velocity',
      shortSpec: 'High-retention followers, reels views, and instant engagement campaigns.',
      priceLabel: '',
      imageUrl: '/src/assets/images/social_creator_filming_1794991853059.jpg',
    },
    {
      id: 'sc_sms',
      category: 'Virtual SMS OTP',
      deliveryType: '10+ Countries',
      title: 'Instant Account Verification Numbers',
      shortSpec: 'Dedicated WhatsApp, Telegram, TikTok, Instagram, and OpenAI OTP routing.',
      priceLabel: '',
      imageUrl: '/src/assets/images/social_mobile_lifestyle_1794991853436.jpg',
    },
    {
      id: 'sc_analytics',
      category: 'Creator & Proxies',
      deliveryType: 'Instant Vault',
      title: 'CLiproxy, 9Proxy & Creator Suites',
      shortSpec: 'Clean residential IPs, VPN licenses, and aged creator accounts for scaling.',
      priceLabel: '',
      imageUrl: '/src/assets/images/social_workspace_creators_1794991853444.jpg',
    },
  ];

  const DEFAULT_WORKFLOW_STEPS = [
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
      desc: 'Unlock CLiproxy, 9Proxy, PIAVPN, and verified accounts with Login, Password & 2FA in your Vault, plus earn referral rewards on invites.',
    },
  ];

  const hydrateSettings = (s: PlatformSettings): PlatformSettings => ({
    ...s,
    brandColor: s.brandColor ?? DEFAULT_PALETTE.brandColor,
    accentColor: s.accentColor ?? DEFAULT_PALETTE.accentColor,
    surfaceBgLight: s.surfaceBgLight ?? DEFAULT_PALETTE.surfaceBgLight,
    surfaceBgDark: s.surfaceBgDark ?? DEFAULT_PALETTE.surfaceBgDark,
    colorPreset: s.colorPreset ?? DEFAULT_PALETTE.colorPreset,
    supportWhatsapp: s.supportWhatsapp ?? s.adminNotifyPhone ?? '+2347031537390',
    showFloatingWhatsapp: s.showFloatingWhatsapp ?? true,
    creatorName: s.creatorName ?? 'Excellent',
    creatorUrl: s.creatorUrl ?? '',
    allowNewSignups: s.allowNewSignups ?? true,
    enableSmsService: s.enableSmsService ?? true,
    enableBoostingService: s.enableBoostingService ?? true,
    enableMarketplace: s.enableMarketplace ?? true,
    allowPromoCodes: s.allowPromoCodes ?? true,
    showLandingShowcase: s.showLandingShowcase ?? true,
    showLandingRates: s.showLandingRates ?? true,
    heroSecondaryHeadline:
      s.heroSecondaryHeadline ??
      'SMS Verification, Social Boosting, VPN, Proxy & Verified Accounts — Fast, Secure & Affordable.',
    heroSecondaryCta: s.heroSecondaryCta ?? 'Explore Services',
    snapshotKicker: s.snapshotKicker ?? 'Live Catalog Snapshot',
    snapshotTitle: s.snapshotTitle ?? 'Instant Delivery Hub',
    snapshotBadge: s.snapshotBadge ?? 'Active Now',
    snapshotFooterText:
      s.snapshotFooterText ?? 'Instant Vault Delivery & 24/7 Automated Dispatch',
    servicesKicker: s.servicesKicker ?? 'What You Can Do Here',
    servicesTitle:
      s.servicesTitle ?? 'Built for creators, agencies, and digital marketers',
    landingStats:
      s.landingStats && s.landingStats.length > 0 ? s.landingStats : DEFAULT_LANDING_STATS,
    landingShowcaseCards:
      s.landingShowcaseCards && s.landingShowcaseCards.length > 0
        ? s.landingShowcaseCards
        : DEFAULT_SHOWCASE_CARDS,
    workflowKicker: s.workflowKicker ?? 'Simple 4-Step Workflow',
    workflowTitle: s.workflowTitle ?? 'Fund once, deploy across every tool',
    workflowSubtitle:
      s.workflowSubtitle ??
      'Every service shares one Naira wallet with instant Vault credential delivery and protected SMS escrow refunds.',
    workflowSteps:
      s.workflowSteps && s.workflowSteps.length > 0
        ? s.workflowSteps
        : DEFAULT_WORKFLOW_STEPS,
    ctaKicker: s.ctaKicker ?? 'Instant Account Access & Live Support',
    ctaTitle: s.ctaTitle ?? 'Ready to start scaling faster?',
    ctaSubtitle:
      s.ctaSubtitle ??
      'Create your free account, open Wallet & Fund inside your dashboard to top up your Naira balance, and access every growth service right away.',
    maintenanceHeadline:
      s.maintenanceHeadline ?? 'Scheduled system refinement in progress.',
    maintenanceMessage:
      s.maintenanceMessage ??
      'We are updating our systems to deliver faster service. All Naira balances, receipts, and Vault credentials remain completely safe.',
  });

  // Global Settings + CMS state
  const [formSettings, setFormSettings] = useState<PlatformSettings>(() =>
    hydrateSettings(data.settings),
  );
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    setFormSettings(hydrateSettings(data.settings));
  }, [data.settings]);

  const saveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(formSettings),
      });
      applyWebsitePalette(formSettings);
      notify('Overwatch settings, website colours & customizations saved permanently!', 'success');
      await onRefresh();
      await refreshCatalog();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    }
  };

  const updateColorSettings = (patch: Partial<PlatformSettings>) => {
    setFormSettings((prev) => {
      const next = { ...prev, ...patch };
      applyWebsitePalette(next);
      return next;
    });
  };

  const handleUploadLandingImage = async (
    cardIndex: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setFormSettings((prev) => {
        const cards = [...(prev.landingShowcaseCards || DEFAULT_SHOWCASE_CARDS)];
        cards[cardIndex] = { ...cards[cardIndex], imageUrl: dataUrl };
        return { ...prev, landingShowcaseCards: cards };
      });
      notify('Showcase picture loaded! Click Save & Publish to apply live.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read image file', 'error');
    }
  };

  const handleUploadLandingVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      notify('Video must be under 40MB for fast storefront playback', 'error');
      return;
    }
    setUploadingVideo(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiFetch<{ url: string; settings: PlatformSettings }>(
        '/api/admin/upload-video',
        {
          method: 'POST',
          body: JSON.stringify({ videoDataUrl: dataUrl, fileName: file.name }),
        },
      );
      setFormSettings((prev) => ({ ...prev, landingVideoUrl: res.url }));
      notify('Landing video uploaded and published!', 'success');
      await onRefresh();
      await refreshCatalog();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Video upload failed', 'error');
    } finally {
      setUploadingVideo(false);
    }
  };

  if (tab === 'notifications') {
    const selectedRecipientUser =
      ntfTarget === 'all' ? null : data.users.find((u) => u.id === ntfTarget) || null;
    const ntfQuery = ntfUserSearch.trim().toLowerCase();
    const matchingNtfUsers = data.users
      .filter((u) => {
        if (!ntfQuery) return true;
        return (
          u.name.toLowerCase().includes(ntfQuery) ||
          u.email.toLowerCase().includes(ntfQuery) ||
          u.referralCode.toLowerCase().includes(ntfQuery)
        );
      })
      .slice(0, 8);

    const emailQuery = emailUserSearch.trim().toLowerCase();
    const matchingEmailUsers = emailQuery
      ? data.users
          .filter(
            (u) =>
              u.name.toLowerCase().includes(emailQuery) ||
              u.email.toLowerCase().includes(emailQuery),
          )
          .slice(0, 6)
      : [];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch('/api/admin/notifications', {
                method: 'POST',
                body: JSON.stringify({
                  title: ntfTitle,
                  message: ntfMsg,
                  type: ntfType,
                  targetUserId: ntfTarget,
                }),
              });
              setNtfTitle('');
              setNtfMsg('');
              notify(
                selectedRecipientUser
                  ? `Notification sent to ${selectedRecipientUser.name}!`
                  : 'Broadcast notification dispatched to all users!',
                'success',
              );
              await onRefresh();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Failed to send notification', 'error');
            }
          }}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              Send User / Broadcast Notification
            </h3>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              {selectedRecipientUser ? `To: ${selectedRecipientUser.name}` : 'All Users'}
            </span>
          </div>

          {/* Target Switch + Search User Name Picker */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNtfTarget('all');
                  setNtfUserSearch('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  ntfTarget === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All Users (Broadcast)
              </button>
              {selectedRecipientUser && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>
                    Selected: {selectedRecipientUser.name} ({selectedRecipientUser.email})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNtfTarget('all');
                      setNtfUserSearch('');
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                    aria-label="Clear selected user"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ntfUserSearch}
                onChange={(e) => setNtfUserSearch(e.target.value)}
                placeholder="Search user by name or email to send private notification..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              {ntfUserSearch && (
                <button
                  type="button"
                  onClick={() => setNtfUserSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              {matchingNtfUsers.length === 0 ? (
                <p className="p-3 text-center text-[11px] text-slate-500">
                  No users matched "{ntfUserSearch}"
                </p>
              ) : (
                matchingNtfUsers.map((u) => {
                  const isSelected = ntfTarget === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setNtfTarget(u.id)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {u.name}{' '}
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            · {u.role}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {formatNaira(u.balance, symbol)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              value={ntfTitle}
              onChange={(e) => setNtfTitle(e.target.value)}
              placeholder="Notification Title"
              className="sm:col-span-2 w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <select
              value={ntfType}
              onChange={(e) => setNtfType(e.target.value as 'info' | 'success' | 'warning')}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-semibold"
            >
              <option value="info">Info Notice</option>
              <option value="success">Success / Credit</option>
              <option value="warning">Important Warning</option>
            </select>
          </div>
          <textarea
            required
            rows={3}
            value={ntfMsg}
            onChange={(e) => setNtfMsg(e.target.value)}
            placeholder="Notification message..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {selectedRecipientUser ? `Send to ${selectedRecipientUser.name}` : 'Send Broadcast'}
          </button>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 max-h-64 overflow-y-auto">
            {data.notifications.map((n) => {
              const targetUser =
                n.targetUserId === 'all'
                  ? null
                  : data.users.find((u) => u.id === n.targetUserId);
              return (
                <div
                  key={n.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {n.targetUserId === 'all'
                          ? 'All Users'
                          : targetUser
                            ? `To: ${targetUser.name}`
                            : 'Specific User'}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/admin/notifications/${n.id}`, { method: 'DELETE' });
                        await onRefresh();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                      }
                    }}
                    className="text-rose-500 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </form>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch('/api/admin/email', {
                method: 'POST',
                body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
              });
              setEmailTo('');
              setEmailUserSearch('');
              setEmailSubject('');
              setEmailBody('');
              notify('Direct message dispatched to user!', 'success');
              await onRefresh();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Failed to send email message', 'error');
            }
          }}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            Send Direct Message to User Email
          </h3>

          {/* Search User Name to Auto-Fill Email */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={emailUserSearch}
                onChange={(e) => setEmailUserSearch(e.target.value)}
                placeholder="Search user name to pick recipient email..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            {matchingEmailUsers.length > 0 && (
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {matchingEmailUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setEmailTo(u.email);
                      setEmailUserSearch('');
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center justify-between text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white">{u.name}</span>
                    <span className="text-[11px] text-slate-500">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="email"
            required
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Recipient Email Address"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <input
            type="text"
            required
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Email Subject"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <textarea
            required
            rows={4}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Email Body..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-blue-600 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Send Email Message
          </button>

          {data.emailLogs.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Recent Sent Messages ({data.emailLogs.length})
              </p>
              {data.emailLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {log.subject}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                    To: {log.to}
                  </p>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    );
  }

  if (tab === 'tutorials') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch('/api/admin/tutorials', {
                method: 'POST',
                body: JSON.stringify({
                  title: tutTitle,
                  category: tutCat,
                  duration: tutDur,
                  summary: tutSum,
                  content: tutBody,
                  videoUrl: tutVideo,
                }),
              });
              setTutTitle('');
              setTutSum('');
              setTutBody('');
              setTutVideo('');
              notify('Tutorial published to users!', 'success');
              await onRefresh();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Failed to publish tutorial', 'error');
            }
          }}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
        >
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Publish New Tutorial
          </h3>
          <input
            type="text"
            required
            value={tutTitle}
            onChange={(e) => setTutTitle(e.target.value)}
            placeholder="Guide Title"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={tutCat}
              onChange={(e) => setTutCat(e.target.value)}
              placeholder="Category"
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <input
              type="text"
              value={tutDur}
              onChange={(e) => setTutDur(e.target.value)}
              placeholder="Duration"
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <input
            type="text"
            value={tutSum}
            onChange={(e) => setTutSum(e.target.value)}
            placeholder="Short Summary"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <input
            type="text"
            value={tutVideo}
            onChange={(e) => setTutVideo(e.target.value)}
            placeholder="Optional Video URL"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <textarea
            required
            rows={5}
            value={tutBody}
            onChange={(e) => setTutBody(e.target.value)}
            placeholder="Step-by-step instructions..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
          >
            Publish Guide
          </button>
        </form>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 divide-y divide-slate-100 dark:divide-slate-800">
          {data.tutorials.map((t) => (
            <div key={t.id} className="py-3.5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.category} · {t.duration}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t.summary}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch(`/api/admin/tutorials/${t.id}`, { method: 'DELETE' });
                    await onRefresh();
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Delete failed', 'error');
                  }
                }}
                className="text-rose-500 p-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'support') {
    const activeTicket = data.tickets.find((t) => t.id === selectedTicketId) || data.tickets[0];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {data.tickets.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No support tickets yet.</p>
          ) : (
            data.tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTicketId(t.id)}
                className={`w-full text-left p-4 transition-colors cursor-pointer ${
                  activeTicket?.id === t.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                }`}
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t.subject}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.userEmail} · {t.status} · {t.priority}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          {!activeTicket ? (
            <p className="py-10 text-center text-sm text-slate-500">Select a ticket to inspect.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {activeTicket.subject}
                  </h3>
                  <p className="text-xs text-slate-500">{activeTicket.userEmail}</p>
                </div>
                <select
                  value={activeTicket.status}
                  onChange={async (e) => {
                    try {
                      await apiFetch(`/api/admin/tickets/${activeTicket.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      notify('Ticket status updated', 'success');
                      await onRefresh();
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'Status update failed', 'error');
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {activeTicket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-xs ${
                      m.senderRole === 'admin'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900'
                        : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <p className="font-bold">
                      {m.senderName} ({m.senderRole})
                    </p>
                    <p className="mt-1">{m.text}</p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!ticketReply.trim()) return;
                  try {
                    await apiFetch(`/api/tickets/${activeTicket.id}/reply`, {
                      method: 'POST',
                      body: JSON.stringify({ text: ticketReply.trim() }),
                    });
                    setTicketReply('');
                    notify('Admin reply sent', 'success');
                    await onRefresh();
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Reply failed', 'error');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={ticketReply}
                  onChange={(e) => setTicketReply(e.target.value)}
                  placeholder="Write official Admin reply..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Reply
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'cms') {
    const showcaseCards = formSettings.landingShowcaseCards || DEFAULT_SHOWCASE_CARDS;
    const statsList = formSettings.landingStats || DEFAULT_LANDING_STATS;
    const stepsList = formSettings.workflowSteps || DEFAULT_WORKFLOW_STEPS;

    return (
      <form onSubmit={saveGlobalSettings} className="space-y-6 max-w-5xl">
        {/* Top Creator Studio Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 border border-slate-800 shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Crown className="w-3.5 h-3.5" />
              Overwatch · Landing Studio
            </div>
            <h2 className="font-display text-lg font-extrabold">
              Full Storefront Visual &amp; Copy Creator
            </h2>
            <p className="text-xs text-slate-300">
              Edit every picture, headline, showcase card, workflow step, and &ldquo;made by&rdquo; credit on your landing page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFormSettings((prev) => ({
                  ...prev,
                  heroKicker: "Africa's all-in-one marketplace for digital growth",
                  heroHeadline: 'All-in-One Digital Tools & Growth Services in Africa',
                  heroSecondaryHeadline:
                    'SMS Verification, Social Boosting, VPN, Proxy & Verified Accounts — Fast, Secure & Affordable.',
                  heroSubheadline:
                    'Verify WhatsApp, Telegram, and global accounts with instant one-time codes, launch high-retention social boosting campaigns, and acquire CLiproxy, 9Proxy, PIAVPN, and verified accounts from one clean dashboard.',
                  heroPrimaryCta: 'Get Started',
                  heroSecondaryCta: 'Explore Services',
                  landingStats: DEFAULT_LANDING_STATS,
                  landingShowcaseCards: DEFAULT_SHOWCASE_CARDS,
                  workflowSteps: DEFAULT_WORKFLOW_STEPS,
                }));
                notify('Default storefront copy & pictures loaded. Click Publish to save.', 'info');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-sm cursor-pointer"
            >
              Publish All Landing Changes
            </button>
          </div>
        </div>

        {/* Showcase Pictures & Feature Cards */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Landing Page Pictures &amp; Feature Showcase Cards
                </h3>
                <p className="text-[11px] text-slate-500">
                  Upload custom photos or paste URLs for the 3 visual cards shown on the landing page.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.showLandingShowcase ?? true}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, showLandingShowcase: e.target.checked })
                  }
                />
                {formSettings.showLandingShowcase ?? true ? 'Visible on Landing' : 'Hidden'}
              </label>
              <button
                type="button"
                onClick={() =>
                  setFormSettings({
                    ...formSettings,
                    landingShowcaseCards: [
                      ...showcaseCards,
                      {
                        id: `sc_${Date.now()}`,
                        category: 'Featured Service',
                        deliveryType: 'Instant',
                        title: 'New Highlight Card',
                        shortSpec: 'Describe what makes this service fast and reliable.',
                        priceLabel: '',
                        imageUrl: '/src/assets/images/social_creator_filming_1794991853059.jpg',
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Card
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {showcaseCards.map((card, idx) => (
              <div
                key={card.id || idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden flex flex-col"
              >
                <div className="relative h-36 bg-slate-200 dark:bg-slate-800">
                  <img
                    src={resolveApiUrl(card.imageUrl)}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[11px] font-bold cursor-pointer backdrop-blur-xs">
                      <Upload className="w-3 h-3" />
                      Change Picture
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadLandingImage(idx, e)}
                        className="hidden"
                      />
                    </label>
                    {showcaseCards.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormSettings({
                            ...formSettings,
                            landingShowcaseCards: showcaseCards.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer"
                        title="Remove showcase card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 space-y-2.5 text-xs flex-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Picture URL
                    </label>
                    <input
                      type="text"
                      value={card.imageUrl}
                      onChange={(e) => {
                        const next = [...showcaseCards];
                        next[idx] = { ...next[idx], imageUrl: e.target.value };
                        setFormSettings({ ...formSettings, landingShowcaseCards: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Category
                      </label>
                      <input
                        type="text"
                        value={card.category}
                        onChange={(e) => {
                          const next = [...showcaseCards];
                          next[idx] = { ...next[idx], category: e.target.value };
                          setFormSettings({ ...formSettings, landingShowcaseCards: next });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Badge Tag
                      </label>
                      <input
                        type="text"
                        value={card.deliveryType}
                        onChange={(e) => {
                          const next = [...showcaseCards];
                          next[idx] = { ...next[idx], deliveryType: e.target.value };
                          setFormSettings({ ...formSettings, landingShowcaseCards: next });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Card Title
                    </label>
                    <input
                      type="text"
                      value={card.title}
                      onChange={(e) => {
                        const next = [...showcaseCards];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setFormSettings({ ...formSettings, landingShowcaseCards: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Write-Up Description
                    </label>
                    <textarea
                      rows={2}
                      value={card.shortSpec}
                      onChange={(e) => {
                        const next = [...showcaseCards];
                        next[idx] = { ...next[idx], shortSpec: e.target.value };
                        setFormSettings({ ...formSettings, landingShowcaseCards: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                      Price Label (Optional Override)
                    </label>
                    <input
                      type="text"
                      value={card.priceLabel}
                      placeholder="Auto-calculated from live catalog if blank"
                      onChange={(e) => {
                        const next = [...showcaseCards];
                        next[idx] = { ...next[idx], priceLabel: e.target.value };
                        setFormSettings({ ...formSettings, landingShowcaseCards: next });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero & Live Snapshot Card Write-Ups */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Hero Section &amp; Snapshot Card Write-Ups
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Hero Top Kicker Badge</label>
              <input
                type="text"
                value={formSettings.heroKicker}
                onChange={(e) => setFormSettings({ ...formSettings, heroKicker: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Primary CTA Button</label>
                <input
                  type="text"
                  value={formSettings.heroPrimaryCta}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, heroPrimaryCta: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Secondary CTA</label>
                <input
                  type="text"
                  value={formSettings.heroSecondaryCta || ''}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, heroSecondaryCta: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-blue-600 dark:text-sky-400">
                Blue Typewriter Main Headline
              </label>
              <input
                type="text"
                value={formSettings.heroHeadline}
                onChange={(e) => setFormSettings({ ...formSettings, heroHeadline: e.target.value })}
                className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Secondary Bold Headline</label>
              <input
                type="text"
                value={formSettings.heroSecondaryHeadline || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, heroSecondaryHeadline: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Hero Subheadline Paragraph</label>
              <textarea
                rows={2}
                value={formSettings.heroSubheadline}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, heroSubheadline: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Snapshot Card Kicker</label>
              <input
                type="text"
                value={formSettings.snapshotKicker || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, snapshotKicker: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Snapshot Card Title</label>
              <input
                type="text"
                value={formSettings.snapshotTitle || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, snapshotTitle: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Snapshot Status Pill</label>
              <input
                type="text"
                value={formSettings.snapshotBadge || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, snapshotBadge: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Snapshot Footer Strip</label>
              <input
                type="text"
                value={formSettings.snapshotFooterText || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, snapshotFooterText: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* Services, KPI Stats, 4-Step Workflow & CTA Write-Ups */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Services Section, KPI Stats &amp; 4-Step Workflow Copy
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Services Section Kicker</label>
              <input
                type="text"
                value={formSettings.servicesKicker || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, servicesKicker: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Services Section Title</label>
              <input
                type="text"
                value={formSettings.servicesTitle || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, servicesTitle: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          {/* 4 KPI Highlights */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Landing KPI Highlights Strip ({statsList.length})
              </p>
              <button
                type="button"
                onClick={() =>
                  setFormSettings({
                    ...formSettings,
                    landingStats: [...statsList, { value: '24/7', label: 'Instant automated access' }],
                  })
                }
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                + Add Stat
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {statsList.map((st, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Stat #{idx + 1}
                    </span>
                    {statsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormSettings({
                            ...formSettings,
                            landingStats: statsList.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-rose-500 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={st.value}
                    onChange={(e) => {
                      const next = [...statsList];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setFormSettings({ ...formSettings, landingStats: next });
                    }}
                    placeholder="Metric (e.g. 99.4%)"
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    value={st.label}
                    onChange={(e) => {
                      const next = [...statsList];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setFormSettings({ ...formSettings, landingStats: next });
                    }}
                    placeholder="Caption..."
                    className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 4-Step Workflow */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              How It Works (4-Step Walkthrough Section)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={formSettings.workflowKicker || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, workflowKicker: e.target.value })
                }
                placeholder="Workflow Kicker"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={formSettings.workflowTitle || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, workflowTitle: e.target.value })
                }
                placeholder="Workflow Title"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={formSettings.workflowSubtitle || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, workflowSubtitle: e.target.value })
                }
                placeholder="Workflow Subtitle"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stepsList.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
                >
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Step {idx + 1} Title &amp; Write-Up
                  </label>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const next = [...stepsList];
                      next[idx] = { ...next[idx], title: e.target.value };
                      setFormSettings({ ...formSettings, workflowSteps: next });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <textarea
                    rows={2}
                    value={step.desc}
                    onChange={(e) => {
                      const next = [...stepsList];
                      next[idx] = { ...next[idx], desc: e.target.value };
                      setFormSettings({ ...formSettings, workflowSteps: next });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTA Banner & Maintenance Copy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold mb-1">Bottom CTA Kicker</label>
              <input
                type="text"
                value={formSettings.ctaKicker || ''}
                onChange={(e) => setFormSettings({ ...formSettings, ctaKicker: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Bottom CTA Title</label>
              <input
                type="text"
                value={formSettings.ctaTitle || ''}
                onChange={(e) => setFormSettings({ ...formSettings, ctaTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Bottom CTA Subtitle</label>
              <textarea
                rows={2}
                value={formSettings.ctaSubtitle || ''}
                onChange={(e) => setFormSettings({ ...formSettings, ctaSubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-amber-700 dark:text-amber-400">
                Maintenance Screen Headline
              </label>
              <input
                type="text"
                value={formSettings.maintenanceHeadline || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, maintenanceHeadline: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-amber-700 dark:text-amber-400">
                Maintenance Screen Message
              </label>
              <input
                type="text"
                value={formSettings.maintenanceMessage || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, maintenanceMessage: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* Website Creator Credit ("Made By") + Footer + Default Buy Warning */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Website Creator Credit (&ldquo;Made By&rdquo;), Footer &amp; Buy Warning
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Website Creator Name (&ldquo;made by ...&rdquo; in Footer &amp; Copyright)
              </label>
              <input
                type="text"
                value={formSettings.creatorName || ''}
                onChange={(e) => setFormSettings({ ...formSettings, creatorName: e.target.value })}
                placeholder="e.g. Excellent"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Creator Link / Portfolio URL (Optional)
              </label>
              <input
                type="text"
                value={formSettings.creatorUrl || ''}
                onChange={(e) => setFormSettings({ ...formSettings, creatorUrl: e.target.value })}
                placeholder="https://... (leave blank for plain text)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Footer Tagline</label>
              <input
                type="text"
                value={formSettings.footerTagline}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, footerTagline: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-amber-700 dark:text-amber-400">
                Default Buy Page Warning (Fallback for products without a custom warning)
              </label>
              <textarea
                rows={2}
                value={formSettings.defaultBuyWarning}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, defaultBuyWarning: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20"
              />
            </div>
          </div>
        </div>

        {/* Pinned Top Right-to-Left Marquee Controller */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Pinned Dashboard Scrolling Notification (Right to Left)
              </h3>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.pinnedTickerEnabled}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, pinnedTickerEnabled: e.target.checked })
                }
              />
              {formSettings.pinnedTickerEnabled ? 'Pinned & Live' : 'Disabled'}
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold mb-1">
                Scrolling Notification Message
              </label>
              <input
                type="text"
                value={formSettings.pinnedTickerText}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, pinnedTickerText: e.target.value })
                }
                placeholder="Type breaking promo, restock notice, or warning..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Bar Theme</label>
              <select
                value={formSettings.pinnedTickerTheme}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    pinnedTickerTheme: e.target.value as PlatformSettings['pinnedTickerTheme'],
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="blue">Blue Gradient</option>
                <option value="dark">Obsidian Dark</option>
                <option value="amber">Amber Alert</option>
                <option value="purple">Purple Gradient</option>
              </select>
            </div>
          </div>
        </div>

        {/* Direct Landing Page Video Upload */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Landing Page Video Showcase (Direct File Upload)
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Upload a video directly from your computer or phone (MP4 / WebM / MOV). Uploaded videos are stored permanently on the server.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploadingVideo ? 'Uploading Video...' : 'Upload Video File'}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                onChange={handleUploadLandingVideo}
                className="hidden"
                disabled={uploadingVideo}
              />
            </label>

            {formSettings.landingVideoUrl && (
              <button
                type="button"
                onClick={() => setFormSettings({ ...formSettings, landingVideoUrl: '' })}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl cursor-pointer"
              >
                Remove Video
              </button>
            )}
          </div>

          {formSettings.landingVideoUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black max-w-md">
              <video
                src={resolveApiUrl(formSettings.landingVideoUrl)}
                controls
                className="w-full aspect-video object-cover"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="px-6 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm cursor-pointer"
        >
          Save &amp; Publish All Landing Studio Changes Permanently
        </button>
      </form>
    );
  }

  // tab === 'settings' — Overwatch Master Controls
  return (
    <form onSubmit={saveGlobalSettings} className="space-y-6 max-w-5xl">
      {/* Branding, Creator Credit & Support Channels */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Website Logo, Identity &amp; Creator Credit
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Website Name</label>
            <input
              type="text"
              value={formSettings.siteName}
              onChange={(e) => setFormSettings({ ...formSettings, siteName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Support Contact Email</label>
            <input
              type="email"
              value={formSettings.supportEmail}
              onChange={(e) => setFormSettings({ ...formSettings, supportEmail: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Website Creator Name (&ldquo;made by ...&rdquo;)
            </label>
            <input
              type="text"
              value={formSettings.creatorName || ''}
              onChange={(e) => setFormSettings({ ...formSettings, creatorName: e.target.value })}
              placeholder="e.g. Excellent"
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Creator Portfolio / Social URL (Optional)
            </label>
            <input
              type="text"
              value={formSettings.creatorUrl || ''}
              onChange={(e) => setFormSettings({ ...formSettings, creatorUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Site Logo URL (or Upload)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formSettings.siteLogoUrl}
                onChange={(e) => setFormSettings({ ...formSettings, siteLogoUrl: e.target.value })}
                placeholder="https://... or upload any size logo"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <label className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await fileToDataUrl(file);
                        setFormSettings({ ...formSettings, siteLogoUrl: url });
                        notify('Logo loaded! Click Save All Overwatch Controls to publish.', 'success');
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Failed to load logo', 'error');
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
              {formSettings.siteLogoUrl && (
                <button
                  type="button"
                  onClick={() => setFormSettings({ ...formSettings, siteLogoUrl: '' })}
                  className="px-2.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrandLogo
                  logoUrl={formSettings.siteLogoUrl}
                  siteName={formSettings.siteName}
                  size="md"
                  shape="circle"
                />
                <BrandLogo
                  logoUrl={formSettings.siteLogoUrl}
                  siteName={formSettings.siteName}
                  size="md"
                  shape="rounded"
                />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    System Frame Fit Preview
                  </p>
                  <p>Any uploaded image fills the exact system logo size and shape.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={formSettings.currencySymbol}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, currencySymbol: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Currency Code</label>
                <input
                  type="text"
                  value={formSettings.currencyCode}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, currencyCode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                Floating WhatsApp Support Number
              </label>
              <input
                type="text"
                value={formSettings.supportWhatsapp || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, supportWhatsapp: e.target.value })
                }
                placeholder="+2347031537390"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Website Colour & Theme Studio */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Website Colour &amp; Theme Studio
              </h3>
              <p className="text-[11px] text-slate-500">
                Change the primary brand, accent, and canvas colours across the entire website — preserved permanently across all updates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateColorSettings({ ...DEFAULT_PALETTE });
              notify('Default Royal Blue palette loaded. Click Save Settings below to publish.', 'info');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Default Blue
          </button>
        </div>

        {/* One-Click Color Presets */}
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Quick Theme Presets (Live Preview)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = formSettings.colorPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    updateColorSettings({
                      colorPreset: preset.id,
                      brandColor: preset.brandColor,
                      accentColor: preset.accentColor,
                      surfaceBgLight: preset.surfaceBgLight,
                      surfaceBgDark: preset.surfaceBgDark,
                    })
                  }
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-600'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.brandColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: preset.surfaceBgLight }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {preset.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Colour Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold">Primary Brand Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formSettings.brandColor || DEFAULT_PALETTE.brandColor}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    brandColor: e.target.value.toUpperCase(),
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={formSettings.brandColor || DEFAULT_PALETTE.brandColor}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    brandColor: e.target.value.toUpperCase(),
                  })
                }
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[10px] text-slate-500">Buttons, links, icons &amp; hero heading</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold">Secondary Accent Colour</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formSettings.accentColor || DEFAULT_PALETTE.accentColor}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    accentColor: e.target.value.toUpperCase(),
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={formSettings.accentColor || DEFAULT_PALETTE.accentColor}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    accentColor: e.target.value.toUpperCase(),
                  })
                }
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[10px] text-slate-500">Gradients, badges &amp; dark highlights</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold">Light Mode Canvas</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formSettings.surfaceBgLight || DEFAULT_PALETTE.surfaceBgLight}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    surfaceBgLight: e.target.value.toUpperCase(),
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={formSettings.surfaceBgLight || DEFAULT_PALETTE.surfaceBgLight}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    surfaceBgLight: e.target.value.toUpperCase(),
                  })
                }
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[10px] text-slate-500">Page background in light mode</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-semibold">Dark Mode Canvas</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formSettings.surfaceBgDark || DEFAULT_PALETTE.surfaceBgDark}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    surfaceBgDark: e.target.value.toUpperCase(),
                  })
                }
                className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={formSettings.surfaceBgDark || DEFAULT_PALETTE.surfaceBgDark}
                onChange={(e) =>
                  updateColorSettings({
                    colorPreset: 'custom',
                    surfaceBgDark: e.target.value.toUpperCase(),
                  })
                }
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[10px] text-slate-500">Page background in dark mode</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500">
            Click &ldquo;Save All Overwatch Controls&rdquo; at the bottom (or save now) to publish your colour scheme to every user.
          </p>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
          >
            Save &amp; Publish Website Colours
          </button>
        </div>
      </div>

      {/* Overwatch Master Platform Controls (Control Over Everything) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Overwatch Master Controls (Total Platform Authority)
              </h3>
              <p className="text-[11px] text-slate-500">
                Enable or pause any core feature, registration gate, checkout rule, or storefront section, then click Save Controls.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
          >
            Save Master Controls
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(
            [
              {
                key: 'allowNewSignups',
                title: 'New User Registrations',
                desc: 'Allow visitors to create new accounts',
              },
              {
                key: 'enableSmsService',
                title: 'Virtual SMS OTP Service',
                desc: 'Allow renting SMS numbers inside dashboard',
              },
              {
                key: 'enableBoostingService',
                title: 'Social Boosting Service',
                desc: 'Allow placing social growth boost orders',
              },
              {
                key: 'enableMarketplace',
                title: 'Marketplace & Vault Sales',
                desc: 'Allow purchasing proxies, VPNs & accounts',
              },
              {
                key: 'allowPromoCodes',
                title: 'Promo Codes at Checkout',
                desc: 'Allow discount promo codes during purchase',
              },
              {
                key: 'showFloatingWhatsapp',
                title: 'Floating WhatsApp Ball',
                desc: 'Show floating green WhatsApp support button',
              },
              {
                key: 'showLandingShowcase',
                title: 'Landing Showcase Pictures',
                desc: 'Show the 3 visual picture cards on landing',
              },
              {
                key: 'showLandingRates',
                title: 'Landing Live Rates Table',
                desc: 'Show live service pricing preview on landing',
              },
              {
                key: 'autoApproveDeposits',
                title: 'AI Receipt Auto-Approval',
                desc: 'Auto-credit AI-matched Moniepoint transfers',
              },
              {
                key: 'welcomePromoEnabled',
                title: 'Welcome Signup Bonus',
                desc: 'Credit new signups automatically on join',
              },
              {
                key: 'maintenanceMode',
                title: 'Maintenance Lockdown',
                desc: 'Restrict public & non-admin logins',
                danger: true,
              },
            ] as {
              key: keyof PlatformSettings;
              title: string;
              desc: string;
              danger?: boolean;
            }[]
          ).map((ctrl) => {
            const checked = Boolean(formSettings[ctrl.key]);
            return (
              <label
                key={ctrl.key}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                  ctrl.danger && checked
                    ? 'border-amber-400 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30'
                    : checked
                      ? 'border-blue-200 dark:border-blue-900/70 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{ctrl.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{ctrl.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, [ctrl.key]: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Funding Bank Account, Thresholds & Alert Routing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Funding Bank Account, Thresholds &amp; Alert Routing
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Bank Name</label>
            <input
              type="text"
              value={formSettings.bankName}
              onChange={(e) => setFormSettings({ ...formSettings, bankName: e.target.value })}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Account Number</label>
            <input
              type="text"
              value={formSettings.bankAccountNumber}
              onChange={(e) =>
                setFormSettings({ ...formSettings, bankAccountNumber: e.target.value })
              }
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Account Name</label>
            <input
              type="text"
              value={formSettings.bankAccountName}
              onChange={(e) =>
                setFormSettings({ ...formSettings, bankAccountName: e.target.value })
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold mb-1">Minimum Deposit ({formSettings.currencySymbol})</label>
            <input
              type="number"
              value={formSettings.minimumDeposit}
              onChange={(e) =>
                setFormSettings({ ...formSettings, minimumDeposit: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Referral Bonus ({formSettings.currencySymbol})</label>
            <input
              type="number"
              value={formSettings.referralBonusAmount}
              onChange={(e) =>
                setFormSettings({ ...formSettings, referralBonusAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Welcome Signup Bonus ({formSettings.currencySymbol})</label>
            <input
              type="number"
              value={formSettings.welcomePromoAmount}
              onChange={(e) =>
                setFormSettings({ ...formSettings, welcomePromoAmount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              Creator WhatsApp Dispatch Phone
            </label>
            <input
              type="text"
              value={formSettings.adminNotifyPhone}
              onChange={(e) =>
                setFormSettings({ ...formSettings, adminNotifyPhone: e.target.value })
              }
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              Automated Webhook Alert URL (Optional)
            </label>
            <input
              type="text"
              value={formSettings.adminWebhookUrl}
              onChange={(e) =>
                setFormSettings({ ...formSettings, adminWebhookUrl: e.target.value })
              }
              placeholder="https://hooks.example.com/..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="px-6 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm cursor-pointer"
      >
        Save All Overwatch Controls Permanently
      </button>
    </form>
  );
}
