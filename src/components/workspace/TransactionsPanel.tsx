import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Eye,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatNaira, resolveApiUrl } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';
import type { WalletTransaction } from '../../types';

interface WalletResponse {
  balance: number;
  transactions: WalletTransaction[];
}

interface TransactionsPanelProps {
  onFundWallet?: () => void;
}

const isCreditType = (type: WalletTransaction['type']) =>
  type === 'deposit' ||
  type === 'refund' ||
  type === 'admin_credit' ||
  type === 'referral_bonus' ||
  type === 'welcome_bonus';

export function TransactionsPanel({ onFundWallet }: TransactionsPanelProps) {
  const { user, catalog, notify, updateLocalBalance } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'purchase' | 'refund' | 'bonus'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<WalletResponse>('/api/wallet');
      setTransactions(res.transactions);
      if (typeof res.balance === 'number') {
        updateLocalBalance(res.balance);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load transaction history', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, updateLocalBalance]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const totals = useMemo(() => {
    let credits = 0;
    let spent = 0;
    let pending = 0;
    for (const tx of transactions) {
      if (tx.status === 'rejected') continue;
      if (tx.type === 'deposit' && tx.status === 'pending') {
        pending += tx.amount;
        continue;
      }
      if (isCreditType(tx.type)) {
        credits += tx.amount;
      } else {
        spent += tx.amount;
      }
    }
    return { credits, spent, pending };
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesType =
        filter === 'all' ||
        (filter === 'bonus'
          ? tx.type === 'referral_bonus' || tx.type === 'welcome_bonus' || tx.type === 'admin_credit'
          : tx.type === filter);
      const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
      const matchesSearch =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [transactions, filter, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {getSectionCopy(catalog?.settings, 'transactionsTitle', { symbol })}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getSectionCopy(catalog?.settings, 'transactionsSubtitle', { symbol })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTransactions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {onFundWallet && (
            <button
              type="button"
              onClick={onFundWallet}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              Add Funds
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Balance</p>
          <p className="font-display text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {formatNaira(user?.balance || 0, symbol)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Credited</p>
          <p className="font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatNaira(totals.credits, symbol)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Spent</p>
          <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatNaira(totals.spent, symbol)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending Deposits</p>
          <p className="font-display text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {formatNaira(totals.pending, symbol)}
          </p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'deposit', label: 'Deposits' },
              { id: 'purchase', label: 'Purchases' },
              { id: 'refund', label: 'Refunds' },
              { id: 'bonus', label: 'Bonuses & Credits' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                filter === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          <div className="flex-1 sm:w-64 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus-within:ring-2 focus-within:ring-blue-600">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description or ID..."
              className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Clear transaction search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading transaction history...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No transactions match your current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((tx) => {
              const isCredit = isCreditType(tx.type);
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => setSelectedTx(tx)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.status === 'rejected'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          : isCredit
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{new Date(tx.createdAt).toLocaleString()}</span>
                        <span>·</span>
                        <span
                          className={`uppercase font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            tx.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : tx.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        tx.status === 'rejected'
                          ? 'text-rose-500 line-through'
                          : isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatNaira(tx.amount, symbol)}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Transaction Receipt
              </h2>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {isCreditType(selectedTx.type) ? '+' : '-'}
                  {formatNaira(selectedTx.amount, symbol)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Status</span>
                <span className="font-bold uppercase">{selectedTx.status}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Type</span>
                <span className="capitalize">{selectedTx.type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Date</span>
                <span>{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">Reference ID</span>
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(selectedTx.id);
                    notify('Transaction ID copied', 'success');
                  }}
                  className="inline-flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  <span>{selectedTx.id}</span>
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedTx.description}
            </p>

            {selectedTx.adminNote && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                <strong>Note:</strong>{' '}
                {selectedTx.adminNote.replace(/Head Admin|Admin/gi, 'Our Team')}
              </div>
            )}

            {selectedTx.receiptImage && (
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                  Uploaded Receipt
                </p>
                <img
                  src={resolveApiUrl(selectedTx.receiptImage)}
                  alt="Deposit receipt"
                  className="max-h-56 rounded-xl border border-slate-200 dark:border-slate-800 mx-auto object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
