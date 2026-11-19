import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  LayoutGrid,
  Lock,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatNaira, parseAccountCredential } from '../../lib/api';
import type {
  CustomSection,
  CustomSectionProduct,
  MarketplaceCategory,
  MarketplaceListing,
  VaultItem,
} from '../../types';
import { SafeImage } from '../SafeImage';

interface MarketplacePanelProps {
  onOpenOrders?: () => void;
}

const DEFAULT_POPULAR_CHIPS = ['VPN', 'Proxy', 'Bots', 'Facebook'];

function ProductCoverBanner({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string;
}) {
  return (
    <div className="relative h-36 sm:h-40 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <SafeImage
        src={imageUrl || ''}
        alt={title}
        fallbackTitle={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

function ProductInlineLogo({
  title,
  logoUrl,
  size = 'sm',
}: {
  title: string;
  logoUrl?: string;
  bounceLogo?: boolean;
  size?: 'sm' | 'md';
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const lower = title.toLowerCase();
  const boxClass =
    size === 'md'
      ? 'w-10 h-10 rounded-xl shrink-0 animate-logo-bounce'
      : 'w-8 h-8 rounded-lg shrink-0 animate-logo-bounce';

  if (logoUrl && !imgFailed) {
    return (
      <div
        className={`${boxClass} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden`}
      >
        <img
          src={logoUrl}
          alt={`${title} logo`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center block"
        />
      </div>
    );
  }

  if (lower.includes('cliproxy')) {
    return (
      <div
        className={`${boxClass} bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800 flex items-center justify-center`}
      >
        <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
          <defs>
            <linearGradient id="cliproxyInlineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <path
            d="M28 10C18.6 10 11 17.6 11 27C11 33.6 15.2 38 22 38C27.4 38 32 34.9 35 30.8L29.2 27.6C27.5 29.8 25.2 31 22.6 31C18.8 31 16.5 28.6 16.5 24.8C16.5 20.1 20.4 16.4 26 16.4C29.4 16.4 32 17.5 34.4 19.6L38.2 14C35.3 11.4 31.8 10 28 10Z"
            fill="url(#cliproxyInlineGrad)"
          />
          <rect x="31" y="10" width="5" height="5" rx="1" fill="#60A5FA" />
        </svg>
      </div>
    );
  }

  if (lower.includes('9proxy')) {
    return (
      <div
        className={`${boxClass} bg-sky-500 text-white flex items-center justify-center shadow-xs`}
      >
        <span className="font-display text-base font-black leading-none">9</span>
      </div>
    );
  }

  if (lower.includes('pia')) {
    return (
      <div
        className={`${boxClass} bg-emerald-600 text-white flex items-center justify-center shadow-xs`}
      >
        <ShieldCheck className="w-4 h-4" />
      </div>
    );
  }

  const initial = title.trim().charAt(0).toUpperCase() || 'S';
  return (
    <div
      className={`${boxClass} bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center font-display font-bold text-xs shadow-xs`}
    >
      {initial}
    </div>
  );
}

export function MarketplacePanel({ onOpenOrders }: MarketplacePanelProps) {
  const { catalog, updateLocalBalance, notify } = useApp();
  const symbol = catalog?.settings.currencySymbol || '₦';

  const [tab, setTab] = useState<'store' | 'vault'>('store');
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [vault, setVault] = useState<VaultItem[]>([]);
  const [defaultBuyWarning, setDefaultBuyWarning] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedChip, setSelectedChip] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');
  const [compactGrid, setCompactGrid] = useState(true);

  // Checkout / Buy Modal State
  const [checkoutItem, setCheckoutItem] = useState<MarketplaceListing | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch<{
        categories: MarketplaceCategory[];
        listings: MarketplaceListing[];
        vault: VaultItem[];
        defaultBuyWarning?: string;
      }>('/api/marketplace/listings');
      setCategories(res.categories);
      setListings(res.listings);
      setVault(res.vault);
      setDefaultBuyWarning(
        res.defaultBuyWarning || catalog?.settings.defaultBuyWarning || '',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load marketplace', 'error');
    }
  }, [notify, catalog?.settings.defaultBuyWarning]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!checkoutItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCheckoutItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkoutItem]);

  const popularChips = useMemo(() => {
    const tags = new Set(DEFAULT_POPULAR_CHIPS);
    listings.forEach((l) => {
      if (l.popularTag) tags.add(l.popularTag);
    });
    return Array.from(tags).slice(0, 6);
  }, [listings]);

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = listings.filter((item) => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesChip =
        selectedChip === 'All' ||
        item.popularTag?.toLowerCase() === selectedChip.toLowerCase() ||
        item.title.toLowerCase().includes(selectedChip.toLowerCase()) ||
        item.category.toLowerCase().includes(selectedChip.toLowerCase());
      const matchesQ =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.shortSpec.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesChip && matchesQ;
    });

    if (sortOrder === 'price_asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortOrder === 'price_desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [listings, selectedCategory, selectedChip, search, sortOrder]);

  // Group filtered listings by category matching reference IMG_5841
  const groupedSections = useMemo(() => {
    const map = new Map<string, MarketplaceListing[]>();
    for (const item of filteredListings) {
      const group = map.get(item.category) || [];
      group.push(item);
      map.set(item.category, group);
    }
    return Array.from(map.entries());
  }, [filteredListings]);

  const handleConfirmPurchase = async (listing: MarketplaceListing) => {
    setBuyingId(listing.id);
    try {
      const res = await apiFetch<{
        vaultItem: VaultItem;
        listing: MarketplaceListing;
        balance: number;
      }>('/api/marketplace/purchase', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      setVault((prev) => [res.vaultItem, ...prev]);
      setListings((prev) => prev.map((l) => (l.id === listing.id ? res.listing : l)));
      updateLocalBalance(res.balance);
      setCheckoutItem(null);
      setPromoCode('');
      notify(`${listing.title} delivered to Orders & Vault!`, 'success');
      if (onOpenOrders) {
        onOpenOrders();
      } else {
        setTab('vault');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Purchase failed', 'error');
    } finally {
      setBuyingId(null);
    }
  };

  const cycleSort = () => {
    setSortOrder((prev) =>
      prev === 'featured' ? 'price_asc' : prev === 'price_asc' ? 'price_desc' : 'featured',
    );
  };

  const activeBuyWarning =
    checkoutItem?.buyWarning ||
    defaultBuyWarning ||
    'Verify proxy format and platform rules before deployment. Credentials are delivered once.';

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header Row with Store / Vault toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Marketplace
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Instant proxies, VPN licenses, and verified social accounts.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <button
            type="button"
            onClick={() => setTab('store')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'store'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Store ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('vault')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'vault'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Vault ({vault.length})
          </button>
        </div>
      </div>

      {tab === 'store' ? (
        <>
          {/* Reference IMG_5841 Search + Popular Filter Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCompactGrid((v) => !v)}
                className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                title={compactGrid ? 'Switch to 3-column grid' : 'Switch to 2-column grid'}
                aria-label="Toggle grid density"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for products or categories..."
                  className="w-full pl-11 pr-4 py-2.5 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={cycleSort}
                className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                title={`Sort: ${sortOrder}`}
                aria-label="Sort products"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                Popular:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedChip('All');
                  setSelectedCategory('All');
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  selectedChip === 'All' && selectedCategory === 'All'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                }`}
              >
                All
              </button>
              {popularChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSelectedChip(selectedChip === chip ? 'All' : chip)}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    selectedChip === chip
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                >
                  {chip}
                </button>
              ))}
              {sortOrder !== 'featured' && (
                <span className="ml-auto text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Sorted: {sortOrder === 'price_asc' ? 'Lowest Price' : 'Highest Price'}
                </span>
              )}
            </div>
          </div>

          {/* Category Filter Strip when more than 1 category */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['All', ...categories.map((c) => c.name)].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {groupedSections.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No products matched your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setSelectedChip('All');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedSections.map(([categoryName, items]) => (
                <section key={categoryName} className="space-y-4">
                  {/* Clean Blue Gradient Category Header Bar */}
                  <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-5 py-3.5 text-white flex items-center justify-between gap-3 shadow-sm shadow-blue-500/15">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Lock className="w-4 h-4 text-sky-100 shrink-0" />
                      <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wide truncate">
                        {categoryName}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === categoryName ? 'All' : categoryName,
                        )
                      }
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <span>{selectedCategory === categoryName ? 'Show All' : 'See More'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Product Card Grid matching IMG_5841 */}
                  <div
                    className={`grid gap-4 ${
                      compactGrid
                        ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {items.map((item) => (
                      <article
                        key={item.id}
                        onClick={() => setCheckoutItem(item)}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col cursor-pointer"
                      >
                        <ProductCoverBanner
                          title={item.title}
                          imageUrl={item.imageUrl}
                        />

                        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              <Lock className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="truncate">{item.category}</span>
                            </div>
                            <div className="flex items-center gap-2.5 mt-1.5">
                              <ProductInlineLogo
                                title={item.title}
                                logoUrl={item.logoUrl}
                                bounceLogo={item.bounceLogo}
                              />
                              <h3 className="font-display text-sm sm:text-base font-extrabold text-slate-900 dark:text-white uppercase leading-snug line-clamp-2 min-w-0">
                                {item.title}
                              </h3>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-1">
                              {item.shortSpec}
                            </p>
                          </div>

                          <div className="pt-2 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-display text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                                {formatNaira(item.price, symbol)}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={item.stock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCheckoutItem(item);
                              }}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sky-100 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
                              title="Instant Buy"
                              aria-label={`Buy ${item.title}`}
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          {vault.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your Vault is empty. Purchased proxies, VPNs, and credentials appear here
                immediately.
              </p>
              <button
                type="button"
                onClick={() => setTab('store')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {vault.map((item) => {
                const parsedCred = parseAccountCredential(item.deliveredCredential);
                return (
                  <div key={item.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.category} · {new Date(item.createdAt).toLocaleString()} ·{' '}
                          <span className="font-mono">{formatNaira(item.price, symbol)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await copyText(item.deliveredCredential);
                          notify('Credential copied from Vault', 'success');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {parsedCred ? 'Copy All' : 'Copy Key'}
                      </button>
                    </div>
                    {parsedCred ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { label: 'Login', value: parsedCred.login },
                          { label: 'Password', value: parsedCred.password },
                          { label: '2FA', value: parsedCred.twoFactor },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase text-slate-400">
                                {field.label}
                              </p>
                              <p className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                                {field.value}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await copyText(field.value);
                                notify(`${field.label} copied`, 'success');
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 shrink-0 cursor-pointer"
                              aria-label={`Copy ${field.label}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                        {item.deliveredCredential}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Buy Checkout & Admin Warning Modal */}
      {checkoutItem && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setCheckoutItem(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <ProductCoverBanner
                title={checkoutItem.title}
                imageUrl={checkoutItem.imageUrl}
              />
              <button
                type="button"
                onClick={() => setCheckoutItem(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-200 flex items-center justify-center shadow-sm cursor-pointer"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {checkoutItem.category} · {checkoutItem.deliveryType}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {checkoutItem.stock} available
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <ProductInlineLogo
                    title={checkoutItem.title}
                    logoUrl={checkoutItem.logoUrl}
                    bounceLogo={checkoutItem.bounceLogo}
                    size="md"
                  />
                  <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white min-w-0">
                    {checkoutItem.title}
                  </h2>
                </div>
              </div>

              {/* Admin-edited Description */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Product Description
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {checkoutItem.description || checkoutItem.shortSpec}
                </p>
              </div>

              {/* Features */}
              {checkoutItem.features.length > 0 && (
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {checkoutItem.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Admin-Authored Buy Page Warning Box */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Important Buyer Warning</span>
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">
                  {activeBuyWarning}
                </p>
              </div>

              {/* Promo Code Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Optional Promo Code (e.g. SURE10)"
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Total Payable
                  </p>
                  <p className="font-display text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatNaira(checkoutItem.price, symbol)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={buyingId === checkoutItem.id || checkoutItem.stock <= 0}
                  onClick={() => handleConfirmPurchase(checkoutItem)}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 disabled:opacity-50 rounded-xl shadow-md cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  {checkoutItem.stock <= 0
                    ? 'Out of Stock'
                    : buyingId === checkoutItem.id
                      ? 'Delivering...'
                      : 'Confirm & Buy Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomSectionPanel({ sectionId }: { sectionId: string }) {
  const { catalog, updateLocalBalance, notify } = useApp();
  const symbol = catalog?.settings.currencySymbol || '₦';
  const defaultBuyWarning = catalog?.settings.defaultBuyWarning || '';
  const [section, setSection] = useState<CustomSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [selectedProd, setSelectedProd] = useState<CustomSectionProduct | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ section: CustomSection }>(`/api/sections/${sectionId}`)
      .then((res) => setSection(res.section))
      .catch((err) => notify(err instanceof Error ? err.message : 'Failed to load section', 'error'))
      .finally(() => setLoading(false));
  }, [sectionId, notify]);

  useEffect(() => {
    if (!selectedProd) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProd(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProd]);

  const handleBuy = async (prod: CustomSectionProduct) => {
    setBuyingId(prod.id);
    try {
      const res = await apiFetch<{ product: CustomSectionProduct; balance: number }>(
        '/api/sections/purchase',
        {
          method: 'POST',
          body: JSON.stringify({ sectionId, productId: prod.id }),
        },
      );
      updateLocalBalance(res.balance);
      setSection((prev) =>
        prev
          ? {
              ...prev,
              products: prev.products.map((p) => (p.id === prod.id ? res.product : p)),
            }
          : prev,
      );
      setSelectedProd(null);
      notify(`${prod.title} delivered! Check your Orders section.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Purchase failed', 'error');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-sm text-slate-500">Loading section...</div>;
  }
  if (!section) {
    return <div className="py-12 text-sm text-slate-500">Section unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-sky-100">
          <Sparkles className="w-4 h-4" />
          <span>Featured Section</span>
        </div>
        <h1 className="font-display text-2xl font-bold mt-1">{section.name}</h1>
        {section.description && <p className="text-sm text-sky-100 mt-1">{section.description}</p>}
      </div>

      {section.products.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
          No active products in this section yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {section.products.map((prod) => (
            <article
              key={prod.id}
              onClick={() => setSelectedProd(prod)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            >
              <ProductCoverBanner
                title={prod.title}
                imageUrl={prod.imageUrl}
              />
              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    {section.name} · {prod.stock} in stock
                  </p>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <ProductInlineLogo
                      title={prod.title}
                      logoUrl={prod.logoUrl}
                      bounceLogo={prod.bounceLogo}
                    />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white min-w-0">
                      {prod.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">{prod.shortSpec}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-display text-lg font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatNaira(prod.price, symbol)}
                  </span>
                  <button
                    type="button"
                    disabled={prod.stock <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProd(prod);
                    }}
                    className="w-10 h-10 rounded-full bg-sky-100 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedProd && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedProd(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <ProductCoverBanner title={selectedProd.title} imageUrl={selectedProd.imageUrl} />
              <button
                type="button"
                onClick={() => setSelectedProd(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-200 flex items-center justify-center shadow-sm cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-blue-600">{section.name}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <ProductInlineLogo
                      title={selectedProd.title}
                      logoUrl={selectedProd.logoUrl}
                      bounceLogo={selectedProd.bounceLogo}
                      size="md"
                    />
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white min-w-0">
                      {selectedProd.title}
                    </h2>
                  </div>
                </div>
              </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {selectedProd.description || selectedProd.shortSpec}
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1">
              <p className="text-xs font-extrabold uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Important Buyer Warning
              </p>
              <p className="text-xs text-amber-900 dark:text-amber-100">
                {selectedProd.buyWarning || defaultBuyWarning}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-display text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                {formatNaira(selectedProd.price, symbol)}
              </span>
              <button
                type="button"
                disabled={buyingId === selectedProd.id || selectedProd.stock <= 0}
                onClick={() => handleBuy(selectedProd)}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                {buyingId === selectedProd.id ? 'Delivering...' : 'Confirm & Buy Now'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
