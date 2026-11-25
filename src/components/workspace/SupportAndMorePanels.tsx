import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LifeBuoy,
  Lock,
  Mail,
  MessageCircle,
  Send,
  Share2,
  Shield,
  Upload,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, fileToDataUrl, formatNaira } from '../../lib/api';
import { getSectionCopy } from '../../lib/sectionCopy';
import { UserAvatar } from '../UserAvatar';
import type { NotificationItem, SupportTicket, TutorialItem } from '../../types';

export function NotificationsPanel({ onRead }: { onRead?: () => void }) {
  const { user, catalog, notify } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .catch((err) => notify(err instanceof Error ? err.message : 'Failed to load alerts', 'error'))
      .finally(() => setLoading(false));
  }, [notify]);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) =>
        prev.map((n) =>
          n.id === id && user && !n.readBy.includes(user.id)
            ? { ...n, readBy: [...n.readBy, user.id] }
            : n,
        ),
      );
      onRead?.();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {getSectionCopy(catalog?.settings, 'notificationsTitle')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {getSectionCopy(catalog?.settings, 'notificationsSubtitle')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No notifications yet.</div>
        ) : (
          items.map((n) => {
            const isRead = user ? n.readBy.includes(user.id) : false;
            return (
              <div key={n.id} className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Bell
                    className={`w-4 h-4 mt-1 shrink-0 ${
                      isRead ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!isRead && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md shrink-0 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TutorialsPanel() {
  const { catalog, notify } = useApp();
  const [tutorials, setTutorials] = useState<TutorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ tutorials: TutorialItem[] }>('/api/tutorials')
      .then((res) => setTutorials(res.tutorials))
      .catch((err) => notify(err instanceof Error ? err.message : 'Failed to load tutorials', 'error'))
      .finally(() => setLoading(false));
  }, [notify]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {getSectionCopy(catalog?.settings, 'tutorialsTitle', {
            bank: catalog?.settings?.bankName,
          })}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {getSectionCopy(catalog?.settings, 'tutorialsSubtitle', {
            bank: catalog?.settings?.bankName,
          })}
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-sm text-slate-500">Loading guides...</div>
      ) : tutorials.length === 0 ? (
        <div className="py-10 text-sm text-slate-500">No tutorials published yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tutorials.map((tut) => (
            <article
              key={tut.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{tut.category}</span>
                <span>·</span>
                <span>{tut.duration}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {tut.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">{tut.summary}</p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-3 border-t border-slate-100 dark:border-slate-800">
                {tut.content}
              </pre>
              {tut.videoUrl && (
                <a
                  href={tut.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                >
                  Open Video Walkthrough
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupportPanel() {
  const { catalog, notify } = useApp();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Moniepoint Funding');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await apiFetch<{ tickets: SupportTicket[] }>('/api/tickets');
      setTickets(res.tickets);
      setSelectedId((prev) => prev || res.tickets[0]?.id || '');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load tickets', 'error');
    }
  }, [notify]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ticket: SupportTicket }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, category, priority, message }),
      });
      setTickets((prev) => [res.ticket, ...prev]);
      setSelectedId(res.ticket.id);
      setSubject('');
      setMessage('');
      notify('Support ticket submitted to our Team.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    try {
      const res = await apiFetch<{ ticket: SupportTicket }>(`/api/tickets/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: replyText.trim() }),
      });
      setTickets((prev) => prev.map((t) => (t.id === selectedId ? res.ticket : t)));
      setReplyText('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to send reply', 'error');
    }
  };

  const activeTicket = tickets.find((t) => t.id === selectedId);
  const settings = catalog?.settings;
  const primaryChannel = settings?.supportPrimaryChannel || 'whatsapp';
  const whatsappRaw =
    settings?.supportWhatsapp?.trim() || settings?.adminNotifyPhone?.trim() || '+2347031537390';
  const whatsappDigits = whatsappRaw.replace(/[^\d]/g, '') || '2347031537390';
  const whatsappUrl = `https://wa.me/${whatsappDigits}`;
  const telegramRaw = settings?.supportTelegram?.trim() || '';
  const telegramUrl = telegramRaw
    ? telegramRaw.startsWith('http://') || telegramRaw.startsWith('https://')
      ? telegramRaw
      : `https://t.me/${telegramRaw.replace(/^@/, '')}`
    : '';

  const groupPlatform = settings?.supportGroupPlatform || 'whatsapp';
  const groupName = settings?.supportGroupName?.trim() || 'SureDeal Official Community Group';
  const groupUrlRaw =
    settings?.supportGroupUrl?.trim() || settings?.communityChannelUrl?.trim() || whatsappUrl;
  const safeGroupUrl = /^https?:\/\//i.test(groupUrlRaw) ? groupUrlRaw : whatsappUrl;
  const supportEmail = settings?.supportEmail?.trim() || 'chibuikeexcellent592@gmail.com';
  const deskNote = settings?.supportDeskNote?.trim();
  const allowTickets = settings?.supportAllowTickets !== false;

  const deskLayout = settings?.supportDeskLayout || 'grid_3';
  const cardStyle = settings?.supportCardStyle || 'tinted';
  const heroEnabled = settings?.supportHeroBannerEnabled !== false;
  const heroBadge = settings?.supportHeroBadge?.trim() || '24/7 Priority Desk';
  const heroTitle =
    settings?.supportHeroTitle?.trim() || 'How can we help your account today?';
  const responseTimeLabel = settings?.supportResponseTimeLabel?.trim() || 'Under 5 mins';
  const hoursLabel = settings?.supportHoursLabel?.trim() || 'Mon - Sun · 8AM - 10PM WAT';
  const whatsappLabel = settings?.supportWhatsappLabel?.trim() || 'WhatsApp Support';
  const whatsappBtnText = settings?.supportWhatsappButtonText?.trim() || 'Chat on WhatsApp';
  const telegramLabel = settings?.supportTelegramLabel?.trim() || 'Telegram Support';
  const telegramBtnText = settings?.supportTelegramButtonText?.trim() || 'Open Telegram';
  const groupBtnText = settings?.supportGroupButtonText?.trim() || 'Join Official Group';

  const showWhatsapp = primaryChannel === 'whatsapp' || primaryChannel === 'both';
  const showTelegram =
    (primaryChannel === 'telegram' || primaryChannel === 'both') && Boolean(telegramUrl);

  const cardsGridClass =
    deskLayout === 'stacked'
      ? 'grid grid-cols-1 gap-4'
      : deskLayout === 'grid_2'
        ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

  const getCardSurface = (tone: 'emerald' | 'sky' | 'blue') => {
    if (cardStyle === 'dark_pro') {
      return 'bg-slate-900 text-white border-slate-800 shadow-sm';
    }
    if (cardStyle === 'solid_clean') {
      return 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs';
    }
    if (cardStyle === 'outlined') {
      return 'bg-transparent border-slate-300 dark:border-slate-700';
    }
    if (tone === 'emerald') {
      return 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30';
    }
    if (tone === 'sky') {
      return 'border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30';
    }
    return 'border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30';
  };

  const isDarkCard = cardStyle === 'dark_pro';

  const heroBannerBlock = heroEnabled ? (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
          <span className="font-bold text-sky-300">{heroBadge}</span>
          <span aria-hidden="true">·</span>
          <span>Avg reply: {responseTimeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{hoursLabel}</span>
        </div>
        <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight">
          {heroTitle}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {showWhatsapp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {whatsappBtnText}
          </a>
        )}
        {showTelegram && (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            {telegramBtnText}
          </a>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {getSectionCopy(settings, 'supportTitle')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {getSectionCopy(settings, 'supportSubtitle')}
        </p>
      </div>

      {deskLayout === 'banner_first' && heroBannerBlock}

      {/* Admin-Configured Direct Channels: WhatsApp / Telegram Support + Copyable Official Group */}
      <div className={cardsGridClass}>
        {showWhatsapp && (
          <div
            className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${getCardSurface(
              'emerald',
            )}`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider ${
                    isDarkCard ? 'text-emerald-400' : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {whatsappLabel}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Direct Help · {responseTimeLabel}
                </span>
              </div>
              <p
                className={`font-mono text-sm font-bold ${
                  isDarkCard ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                {whatsappRaw}
              </p>
              <p
                className={`text-xs ${
                  isDarkCard ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Chat directly with our live support desk on WhatsApp for order or wallet assistance.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{whatsappBtnText}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={async () => {
                  await copyText(whatsappRaw);
                  notify('WhatsApp support number copied!', 'success');
                }}
                className="px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
                title="Copy WhatsApp number"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {showTelegram && (
          <div
            className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${getCardSurface(
              'sky',
            )}`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider ${
                    isDarkCard ? 'text-sky-400' : 'text-sky-700 dark:text-sky-300'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {telegramLabel}
                </span>
                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  Fast Desk · {responseTimeLabel}
                </span>
              </div>
              <p
                className={`font-mono text-sm font-bold truncate ${
                  isDarkCard ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                {telegramRaw}
              </p>
              <p
                className={`text-xs ${
                  isDarkCard ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Message our verified Telegram support agent directly for instant help.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{telegramBtnText}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={async () => {
                  await copyText(telegramRaw);
                  notify('Telegram handle copied!', 'success');
                }}
                className="px-3 py-2 rounded-xl border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 text-xs font-bold cursor-pointer"
                title="Copy Telegram handle"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Official Group Card with Copyable Group Invite Link */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${getCardSurface(
            'blue',
          )}`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider ${
                  isDarkCard ? 'text-blue-300' : 'text-blue-700 dark:text-blue-300'
                }`}
              >
                <Users className="w-4 h-4" />
                {groupPlatform === 'telegram' ? 'Telegram Group' : 'WhatsApp Group'}
              </span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                Official Community
              </span>
            </div>
            <p
              className={`font-display text-sm font-extrabold truncate ${
                isDarkCard ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}
            >
              {groupName}
            </p>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-blue-200/80 dark:border-blue-900/70">
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate flex-1">
                {safeGroupUrl}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await copyText(safeGroupUrl);
                  notify('Official group link copied!', 'success');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={safeGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
            >
              <span>{groupBtnText}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              title={`Email ${supportEmail}`}
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {deskLayout !== 'banner_first' && heroBannerBlock}

      {deskNote && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex flex-wrap items-center justify-between gap-2">
          <span>{deskNote}</span>
          <span className="text-[11px] text-slate-500">{hoursLabel}</span>
        </div>
      )}

      {allowTickets && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              New Support Ticket
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option>Moniepoint Funding</option>
                <option>SMS Verification</option>
                <option>Social Boosting</option>
                <option>Marketplace / Vault</option>
                <option>Account &amp; General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'high' | 'urgent')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Message
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include order ID or transfer details..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Your Conversations ({tickets.length})
          </h2>

          {tickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No support tickets created yet.
            </p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedId === t.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t.subject} · {t.status}
                  </button>
                ))}
              </div>

              {activeTicket && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {activeTicket.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-lg text-xs ${
                          m.senderRole === 'admin'
                            ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900'
                            : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {m.senderName} ({m.senderRole === 'admin' ? 'Our Team' : 'You'})
                        </p>
                        <p className="text-slate-700 dark:text-slate-300 mt-1">{m.text}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Reply
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

export function SettingsPanel({
  onOpenReferral,
  focusSection,
}: {
  onOpenReferral?: () => void;
  focusSection?: 'profile' | 'password';
}) {
  const { user, catalog, refreshUser, notify } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [referralData, setReferralData] = useState<{
    referralCode: string;
    bonusPerReferral: number;
    invited: { id: string; name: string; email: string; createdAt: string }[];
    totalEarned: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  useEffect(() => {
    apiFetch<{
      referralCode: string;
      bonusPerReferral: number;
      invited: { id: string; name: string; email: string; createdAt: string }[];
      totalEarned: number;
    }>('/api/user/referral')
      .then(setReferralData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!focusSection) return;
    const elId = focusSection === 'password' ? 'settings-password-card' : 'settings-profile-card';
    const el = document.getElementById(elId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusSection]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email, avatarUrl }),
      });
      await refreshUser();
      notify('Profile updated', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/user/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated successfully', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Password change failed', 'error');
    }
  };

  const shareUrl = `${window.location.origin}/?ref=${referralData?.referralCode || user?.referralCode || ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {getSectionCopy(catalog?.settings, 'settingsTitle')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {getSectionCopy(catalog?.settings, 'settingsSubtitle')}
          </p>
        </div>
        {onOpenReferral && (
          <button
            type="button"
            onClick={onOpenReferral}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-xl cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Refer &amp; Earn Hub →
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          id="settings-profile-card"
          onSubmit={handleProfileSave}
          className={`lg:col-span-6 bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-4 transition-all ${
            focusSection === 'profile'
              ? 'border-blue-400 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Profile, Avatar &amp; Email
          </h2>

          <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <UserAvatar name={name || user?.name} avatarUrl={avatarUrl} size="xl" />
            <div className="flex-1 min-w-[180px] space-y-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Profile Picture
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await fileToDataUrl(file);
                        setAvatarUrl(dataUrl);
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Could not load image', 'error');
                      }
                    }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Use 3D Avatar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
          >
            Save Profile
          </button>
        </form>

        <form
          id="settings-password-card"
          onSubmit={handlePasswordChange}
          className={`lg:col-span-6 bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-4 transition-all ${
            focusSection === 'password'
              ? 'border-blue-400 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Update Password
            </h2>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type={showCurrentPw ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw((v) => !v)}
                className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type={showNewPw ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPw((v) => !v)}
                className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Change Password
          </button>
        </form>

        <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Referral Program
              </h2>
            </div>
            <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              Earned: {formatNaira(referralData?.totalEarned || 0, symbol)} · Bonus/Invite:{' '}
              {formatNaira(referralData?.bonusPerReferral || 500, symbol)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Referral share link"
              className="flex-1 min-w-[220px] px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={async () => {
                const site = catalog?.settings?.siteName || 'SureDeal Store';
                const inviteText = `Join ${site} for instant virtual SMS numbers, social growth boosting & verified digital accounts: ${shareUrl}`;
                if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                  try {
                    await navigator.share({
                      title: site,
                      text: `Join ${site} — Virtual SMS Numbers, Social Boosting & Digital Vault`,
                      url: shareUrl,
                    });
                    return;
                  } catch (err) {
                    if (err instanceof Error && err.name === 'AbortError') return;
                  }
                }
                await copyText(inviteText);
                notify(`${site} invite link & message copied!`, 'success');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Link
            </button>
            <button
              type="button"
              onClick={async () => {
                await copyText(shareUrl);
                notify(`${catalog?.settings?.siteName || 'SureDeal Store'} link copied!`, 'success');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
