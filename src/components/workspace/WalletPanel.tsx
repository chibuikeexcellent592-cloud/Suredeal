import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, Landmark, UploadCloud, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, fileToDataUrl, formatNaira } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';
import type { WalletTransaction } from '../../types';

interface WalletResponse {
  balance: number;
  minimumDeposit: number;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  transactions: WalletTransaction[];
}

interface WalletPanelProps {
  onViewHistory?: () => void;
}

export function WalletPanel({ onViewHistory }: WalletPanelProps) {
  const { user, catalog, updateLocalBalance, refreshUser, notify } = useApp();
  const settings = catalog?.settings;
  const symbol = settings?.currencySymbol || '₦';

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [minDeposit, setMinDeposit] = useState(500);
  const [bankDetails, setBankDetails] = useState({
    bankName: 'MONIEPOINT',
    accountNumber: '7031537390',
    accountName: 'UCHECHI BLESSING OJI',
  });
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(2000);
  const [senderNote, setSenderNote] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    status: 'verified' | 'rejected' | 'pending';
    summary: string;
  } | null>(null);
  const [filter, setFilter] = useState('all');

  const loadWallet = useCallback(async () => {
    try {
      const res = await apiFetch<WalletResponse>('/api/wallet');
      setTransactions(res.transactions);
      setMinDeposit(res.minimumDeposit);
      setBankDetails(res.bankDetails);
      updateLocalBalance(res.balance);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load wallet', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, updateLocalBalance]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please upload a clear screenshot image of your bank transfer receipt', 'error');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      notify('Receipt image must be smaller than 6MB', 'error');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setReceiptDataUrl(dataUrl);
      setReceiptName(file.name);
      setLastResult(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not load image', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptDataUrl) {
      notify(`Please upload your ${bankDetails.bankName} transfer receipt image first`, 'error');
      return;
    }
    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await apiFetch<{
        transaction: WalletTransaction;
        balance: number;
        autoVerified: boolean;
        autoRejected: boolean;
      }>('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          receiptImage: receiptDataUrl,
          senderNote: senderNote.trim() || undefined,
        }),
      });
      setTransactions((prev) => [res.transaction, ...prev]);
      updateLocalBalance(res.balance);
      void refreshUser();

      const status = res.autoVerified
        ? 'verified'
        : res.autoRejected
          ? 'rejected'
          : 'pending';
      setLastResult({
        status,
        summary:
          res.transaction.aiAudit?.summary ||
          'Receipt uploaded and queued for our Team review.',
      });
      setReceiptDataUrl('');
      setReceiptName('');
      setSenderNote('');

      if (res.autoVerified) {
        notify('Transfer verified automatically! Wallet credited.', 'success');
      } else if (res.autoRejected) {
        notify('Receipt flagged during verification. Check details or contact support.', 'error');
      } else {
        notify('Receipt uploaded! Queued for our Team verification.', 'info');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Deposit submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTx = transactions.filter((t) => filter === 'all' || t.type === filter);
  const copyVars = {
    bank: bankDetails.bankName,
    symbol,
    site: settings?.siteName || 'SureDeal Store',
  };
  const walletNoticeText = (settings?.walletNoticeText || '').trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {getSectionCopy(settings, 'walletPageTitle', copyVars)}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getSectionCopy(settings, 'walletPageSubtitle', copyVars)}
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {settings?.dashboardBalanceLabel?.trim() || 'Available Balance'}
          </p>
          <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatNaira(user?.balance || 0, symbol)}
          </p>
        </div>
      </div>

      {walletNoticeText && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/35 px-4 py-3 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 whitespace-pre-line">
          {walletNoticeText}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Moniepoint Bank Card + Upload Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <Landmark className="w-4 h-4" />
                {getSectionCopy(settings, 'walletCardHeader', copyVars)}
              </div>
              <span className="text-xs font-mono text-slate-300">
                Min: {formatNaira(minDeposit, symbol)}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <p className="text-[11px] text-slate-400">Bank Name</p>
                <p className="font-display text-base font-bold">{bankDetails.bankName}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Account Number</p>
                <div className="flex items-center gap-2.5">
                  <p className="font-mono text-2xl font-bold tracking-wide">
                    {bankDetails.accountNumber}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(bankDetails.accountNumber);
                      notify('Account number copied!', 'success');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-md cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Account Name</p>
                <p className="text-sm font-semibold">{bankDetails.accountName}</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {getSectionCopy(settings, 'walletFormTitle', copyVars)}
            </h2>

            {lastResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  lastResult.status === 'verified'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                    : lastResult.status === 'rejected'
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                      : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                }`}
              >
                {lastResult.status === 'verified' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : lastResult.status === 'rejected' ? (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{lastResult.summary}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="dep-amount"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Transfer Amount ({symbol})
              </label>
              <input
                id="dep-amount"
                type="number"
                required
                min={minDeposit}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="dep-note"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Sender Name / Reference Note (Optional)
              </label>
              <input
                id="dep-note"
                type="text"
                value={senderNote}
                onChange={(e) => setSenderNote(e.target.value)}
                placeholder="Name on your bank account"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Upload Receipt Screenshot
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 cursor-pointer bg-slate-50 dark:bg-slate-950 transition-colors">
                <UploadCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                  {receiptName || getSectionCopy(settings, 'walletUploadHint', copyVars)}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {receiptDataUrl && (
                <img
                  src={receiptDataUrl}
                  alt="Receipt preview"
                  className="mt-3 max-h-40 rounded-lg border border-slate-200 dark:border-slate-800 object-contain mx-auto"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting
                ? 'Inspecting Receipt & Submitting...'
                : getSectionCopy(settings, 'walletSubmitButtonLabel', copyVars)}
            </button>
          </form>
        </div>

        {/* Transaction Ledger */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {getSectionCopy(settings, 'walletActivityTitle', copyVars)}
              </h2>
              {onViewHistory && (
                <button
                  type="button"
                  onClick={onViewHistory}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  View Full History →
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {[
                { id: 'all', label: 'All' },
                { id: 'deposit', label: 'Deposits' },
                { id: 'purchase', label: 'Purchases' },
                { id: 'refund', label: 'Refunds' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    filter === t.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading ledger...</div>
          ) : filteredTx.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {getSectionCopy(settings, 'walletEmptyActivityText', copyVars)}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTx.map((tx) => {
                const isCredit =
                  tx.type === 'deposit' ||
                  tx.type === 'refund' ||
                  tx.type === 'admin_credit' ||
                  tx.type === 'referral_bonus' ||
                  tx.type === 'welcome_bonus';
                return (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleString()} · Status:{' '}
                        <span className="capitalize font-medium">{tx.status}</span>
                        {tx.adminNote
                          ? ` · ${tx.adminNote.replace(/Head Admin|Admin/gi, 'Our Team')}`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
