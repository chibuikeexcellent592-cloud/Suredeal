import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BookOpen, Check, Copy, LifeBuoy, Send, Share2, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, copyText, formatNaira } from '../../lib/api';
import type { NotificationItem, SupportTicket, TutorialItem } from '../../types';

export function NotificationsPanel({ onRead }: { onRead?: () => void }) {
  const { user, notify } = useApp();
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
          Notifications &amp; Broadcasts
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Direct messages, deposit approvals, and platform announcements.
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
  const { notify } = useApp();
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
          Tutorials &amp; Guides
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Learn how to fund via Moniepoint, rent OTP numbers, and activate Vault tools.
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
  const { notify } = useApp();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Support Desk
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Open a ticket for receipt audits, order assistance, or custom asset requests.
        </p>
      </div>

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
    </div>
  );
}

export function SettingsPanel({ onOpenReferral }: { onOpenReferral?: () => void }) {
  const { user, catalog, refreshUser, notify } = useApp();
  const symbol = catalog?.settings?.currencySymbol || '₦';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
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
            Account Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your profile details and account password.
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
          onSubmit={handleProfileSave}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Profile &amp; Email
          </h2>
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
          onSubmit={handlePasswordChange}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
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
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
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
              className="flex-1 min-w-[220px] px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={async () => {
                await copyText(shareUrl);
                notify('Referral link copied!', 'success');
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
