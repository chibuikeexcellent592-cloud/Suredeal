import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  generateCustomSectionSetupWithAi,
  verifyMoniepointReceiptWithAi,
} from './server/ai.ts';
import { sendTransactionalEmail, sendVerificationCodeEmail } from './server/mailer.ts';
import { dispatchAdminPhoneAlert } from './server/notify.ts';
import {
  hashPassword,
  makeId,
  store,
  toPublicUser,
  UPLOADS_DIR,
  verifyPassword,
  type StoredUser,
} from './server/store.ts';
import { HEAD_ADMIN_EMAIL } from './shared/initialData.ts';
import { applyFlashSaleDiscount } from './shared/pricing.ts';
import type {
  AdminFeatureTab,
  BoostingService,
  CustomSection,
  CustomSectionProduct,
  MarketplaceListing,
  PromoCode,
  SmsCountry,
  SmsService,
} from './src/types.ts';

function resolveServerPort(): number {
  if (process.env.PORT) {
    const envPort = Number(process.env.PORT);
    if (Number.isFinite(envPort) && envPort > 0) return envPort;
  }
  const flagIdx = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    const argPort = Number(process.argv[flagIdx + 1]);
    if (Number.isFinite(argPort) && argPort > 0) return argPort;
  }
  const eqFlag = process.argv.find((arg) => arg.startsWith('--port='));
  if (eqFlag) {
    const eqPort = Number(eqFlag.slice('--port='.length));
    if (Number.isFinite(eqPort) && eqPort > 0) return eqPort;
  }
  return 3000;
}
const PORT = resolveServerPort();
const TOKEN_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('suredeal-store-token-key-2026').digest('hex');

interface TokenPayload {
  userId: string;
  exp: number;
  epoch?: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function signToken(userId: string): string {
  const currentEpoch = Math.max(1, Math.floor(Number(store.db.settings.authSessionEpoch ?? 1)));
  const payload: TokenPayload = {
    userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    epoch: currentEpoch,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.userId || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  currentUser?: StoredUser;
}

function resolveAuthedUser(req: AuthedRequest, res: Response): StoredUser | null {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return null;
  }
  const user = store.db.users.find((u) => u.id === payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return null;
  }
  const isHead =
    user.id === 'usr_head_admin' ||
    Boolean(user.isMainAdmin) ||
    user.email.toLowerCase() === (store.db.settings.mainAdminEmail || HEAD_ADMIN_EMAIL).toLowerCase();
  const minEpoch = Math.max(1, Math.floor(Number(store.db.settings.authSessionEpoch ?? 1)));
  if (!isHead && (payload.epoch ?? 1) < minEpoch) {
    res.status(401).json({ error: 'Session reset by administrator. Please sign in again.' });
    return null;
  }
  if ((user.role === 'admin' || isHead) && user.status !== 'active') {
    user.status = 'active';
    store.save();
  }
  if (user.status === 'suspended') {
    res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    return null;
  }
  return user;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = resolveAuthedUser(req, res);
  if (!user) return;
  if (store.db.settings.maintenanceMode && user.role !== 'admin') {
    res.status(503).json({ error: 'Platform is currently in maintenance mode.' });
    return;
  }
  req.currentUser = user;
  next();
}

function creditReferrerOnFirstVerifiedDeposit(depositor: StoredUser, now: string): boolean {
  if (!depositor.referredBy || depositor.referralRewardClaimed) {
    return false;
  }
  const inviter = store.db.users.find((u) => u.id === depositor.referredBy);
  depositor.referralRewardClaimed = true;
  const bonus = store.db.settings.referralBonusAmount || 0;
  if (!inviter || bonus <= 0) {
    return false;
  }
  inviter.balance += bonus;
  const bonusTxId = makeId('tx');
  store.db.transactions.unshift({
    id: bonusTxId,
    userId: inviter.id,
    userName: inviter.name,
    userEmail: inviter.email,
    type: 'referral_bonus',
    amount: bonus,
    status: 'completed',
    description: `Referral bonus unlocked on ${depositor.email}'s first verified deposit`,
    createdAt: now,
  });
  store.recordAccountingEntry({
    kind: 'transaction',
    sourceId: bonusTxId,
    category: 'referral_bonus',
    userId: inviter.id,
    userName: inviter.name,
    userEmail: inviter.email,
    title: 'REFERRAL BONUS',
    detail: `Referral bonus unlocked on ${depositor.email}'s first verified deposit`,
    amount: bonus,
    status: 'completed',
    createdAt: now,
  });
  store.db.notifications.unshift({
    id: makeId('ntf'),
    title: 'Referral Bonus Credited',
    message: `You earned ${store.db.settings.currencySymbol}${bonus.toLocaleString()} because ${depositor.name} completed their first verified deposit.`,
    type: 'success',
    targetUserId: inviter.id,
    readBy: [],
    createdAt: now,
  });
  return true;
}

function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const rank = new Map<string, number>();
  orderedIds.forEach((id, idx) => rank.set(id, idx));
  return [...items].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

const DELEGATABLE_ADMIN_TABS: AdminFeatureTab[] = [
  'overview',
  'power_suite',
  'revenue',
  'live',
  'users',
  'orders',
  'sms_numbers',
  'accounting',
  'catalog',
  'cms',
  'copy',
  'promos',
  'notifications',
  'tutorials',
  'support',
  'audit',
  'settings',
];

function isMainAdminUser(user: StoredUser): boolean {
  const mainEmail = (store.db.settings.mainAdminEmail || HEAD_ADMIN_EMAIL).toLowerCase();
  return (
    user.id === 'usr_head_admin' ||
    Boolean(user.isMainAdmin) ||
    user.email.toLowerCase() === mainEmail
  );
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  next();
}

function requireMainAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser || req.currentUser.role !== 'admin' || !isMainAdminUser(req.currentUser)) {
    res.status(403).json({ error: 'Main Admin privileges required for this action' });
    return;
  }
  next();
}

function requireAdminScope(...allowedTabs: AdminFeatureTab[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.currentUser;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required' });
      return;
    }
    if (isMainAdminUser(user) || !user.allowedAdminTab) {
      next();
      return;
    }
    if (!allowedTabs.includes(user.allowedAdminTab)) {
      res.status(403).json({
        error: `Access restricted: your admin account is assigned to "${user.allowedAdminTab}" only.`,
      });
      return;
    }
    next();
  };
}

function hashVerificationCode(email: string, code: string): string {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${email.toLowerCase()}:${code}`)
    .digest('hex');
}

function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function createRegisteredUserRecord(params: {
  name: string;
  email: string;
  passwordHash: string;
  referralCodeInput?: string;
  authProvider: 'email' | 'google';
  avatarUrl?: string;
}): StoredUser {
  const now = new Date().toISOString();
  const newCode = `SD${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const inviter = params.referralCodeInput
    ? store.db.users.find((u) => u.referralCode.toUpperCase() === params.referralCodeInput!.toUpperCase())
    : undefined;

  const welcomeBonus = store.db.settings.welcomePromoEnabled
    ? Math.max(0, store.db.settings.welcomePromoAmount || 0)
    : 0;

  const newUser: StoredUser = {
    id: makeId('usr'),
    name: params.name,
    email: params.email.toLowerCase(),
    passwordHash: params.passwordHash,
    role: 'user',
    authProvider: params.authProvider,
    emailVerified: true,
    avatarUrl: params.avatarUrl || undefined,
    balance: welcomeBonus,
    status: 'active',
    referralCode: newCode,
    referredBy: inviter?.id,
    referralRewardClaimed: false,
    createdAt: now,
    lastLoginAt: now,
  };

  store.db.users.push(newUser);

  if (welcomeBonus > 0) {
    const welcomeTxId = makeId('tx');
    store.db.transactions.unshift({
      id: welcomeTxId,
      userId: newUser.id,
      userName: newUser.name,
      userEmail: newUser.email,
      type: 'welcome_bonus',
      amount: welcomeBonus,
      status: 'completed',
      description: 'Welcome Promo Bonus credited on signup',
      createdAt: now,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: welcomeTxId,
      category: 'welcome_bonus',
      userId: newUser.id,
      userName: newUser.name,
      userEmail: newUser.email,
      title: 'WELCOME BONUS',
      detail: 'Welcome Promo Bonus credited on signup',
      amount: welcomeBonus,
      status: 'completed',
      createdAt: now,
    });
  }

  if (inviter) {
    store.db.notifications.unshift({
      id: makeId('ntf'),
      title: 'New Referral Registered',
      message: `${newUser.name} signed up with your referral link. Your bonus unlocks once their first deposit is verified.`,
      type: 'info',
      targetUserId: inviter.id,
      readBy: [],
      createdAt: now,
    });
  }

  store.db.notifications.unshift({
    id: makeId('ntf'),
    title: `Welcome to ${store.db.settings.siteName}`,
    message: `Your account (${newUser.email}) is verified and active.`,
    type: 'success',
    targetUserId: newUser.id,
    readBy: [],
    createdAt: now,
  });

  store.addAdminAlert(
    'New User Registered',
    `${newUser.name} (${newUser.email}) joined via ${params.authProvider === 'google' ? 'Google Sign-In' : 'Verified Email'}.`,
    'user',
  );
  store.save();

  void dispatchAdminPhoneAlert({
    eventType: 'new_user',
    message: `[${store.db.settings.siteName}] New User Signup: ${newUser.name} (${newUser.email}) at ${new Date(now).toLocaleString()}`,
  });

  return newUser;
}

function buildCredentialFromTemplate(template: string): string {
  const key4 = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const rand4 = () => Math.floor(1000 + Math.random() * 9000).toString();
  return template
    .replace(/\{\{KEY4\}\}/g, () => key4())
    .replace(/\{\{RAND4\}\}/g, () => rand4());
}

async function startServer() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const reqOrigin = req.headers.origin;
    if (allowedOrigins.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '60mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'suredeal-store-api',
      timestamp: new Date().toISOString(),
    });
  });

  // --- PUBLIC MAINTENANCE STATUS ---
  app.get('/api/public/maintenance-status', (_req, res) => {
    const s = store.db.settings;
    res.json({
      maintenanceMode: Boolean(s.maintenanceMode),
      maintenanceHeadline: s.maintenanceHeadline || 'Scheduled Maintenance in Progress',
      maintenanceMessage:
        s.maintenanceMessage ||
        'We’re currently performing scheduled maintenance. Please check back shortly.',
      siteName: s.siteName || 'SureDeal Store',
      siteLogoUrl: s.siteLogoUrl || '',
      siteNameColorMode: s.siteNameColorMode || 'split',
      siteNameColor1: s.siteNameColor1 || '#0F172A',
      siteNameColor2: s.siteNameColor2 || '#2563EB',
      siteNameSplitRule: s.siteNameSplitRule || 'words',
      siteNameThemeTarget: s.siteNameThemeTarget || 'first',
      siteNameAutoTheme: s.siteNameAutoTheme !== false,
      seasonalTheme: s.seasonalTheme || 'none',
      seasonalBannerEnabled: s.seasonalBannerEnabled !== false,
      seasonalHeadline: s.seasonalHeadline || '',
      seasonalEffectsEnabled: s.seasonalEffectsEnabled !== false,
      seasonalCustomEmoji: s.seasonalCustomEmoji || '✨',
      seasonalCustomColor: s.seasonalCustomColor || '#2563EB',
      supportWhatsapp: s.supportWhatsapp || s.adminNotifyPhone || '+2347031537390',
      supportEmail: s.supportEmail || 'chibuikeexcellent592@gmail.com',
      creatorName: s.creatorName || 'Excellent',
      checkedAt: new Date().toISOString(),
    });
  });

  // --- PUBLIC VISITOR NOTIFICATION ---
  app.post('/api/public/visit', (req, res) => {
    const visitorId = String(req.body?.visitorId || req.ip || 'anon').trim().slice(0, 64);
    const visitPath = String(req.body?.path || '/').trim().slice(0, 120) || '/';
    const device = String(req.body?.device || req.headers['user-agent'] || 'Web Browser')
      .trim()
      .slice(0, 80);

    if (!store.db.visitorStats) {
      store.db.visitorStats = { totalVisits: 0, recentSessions: [] };
    }
    const stats = store.db.visitorStats;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const fiveMinMs = 5 * 60 * 1000;
    const alreadySeenRecently = (stats.recentSessions || []).some(
      (s) => s.visitorId === visitorId && nowMs - new Date(s.visitedAt).getTime() < fiveMinMs,
    );

    if (!alreadySeenRecently) {
      stats.totalVisits = (stats.totalVisits || 0) + 1;
      stats.lastVisitAt = nowIso;
      stats.recentSessions = [
        { visitorId, path: visitPath, device, visitedAt: nowIso },
        ...(stats.recentSessions || []),
      ].slice(0, 50);

      store.addAdminAlert(
        'Website Visitor',
        `Visitor viewed ${visitPath} · ${device}`,
        'visitor',
      );
      store.save();

      void dispatchAdminPhoneAlert({
        eventType: 'system',
        message: `[${store.db.settings.siteName || 'SureDeal Store'}] Website Visitor on ${visitPath} (${device})`,
      });
    }

    res.json({ ok: true, totalVisits: stats.totalVisits });
  });

  // --- PUBLIC CATALOG ---
  app.get('/api/public/catalog', (_req, res) => {
    const db = store.db;
    const {
      smtpHost: _smtpHost,
      smtpPort: _smtpPort,
      smtpUser: _smtpUser,
      smtpPass: _smtpPass,
      smtpFrom: _smtpFrom,
      resendApiKey: _resendApiKey,
      mainAdminEmail: _mainAdminEmail,
      ...publicSettings
    } = db.settings;
    res.json({
      settings: {
        ...publicSettings,
        googleClientId: publicSettings.googleClientId || process.env.GOOGLE_CLIENT_ID || '',
      },
      smsCountriesCount: db.smsCountries.filter((c) => c.active).length,
      smsServices: db.smsServices.filter((s) => s.active),
      boostingServices: db.boostingServices.filter((b) => b.active),
      marketplaceListings: db.marketplaceListings.filter((l) => l.active),
      marketplaceCategories: db.marketplaceCategories,
      customSections: db.customSections
        .filter((s) => s.active)
        .map((s) => ({
          ...s,
          products: s.products.filter((p) => p.active),
        })),
    });
  });

  // --- AUTH ---
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const user = store.db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email address or password' });
      return;
    }
    if ((user.role === 'admin' || isMainAdminUser(user)) && user.status !== 'active') {
      user.status = 'active';
      store.save();
    }
    if (user.status === 'suspended') {
      res.status(403).json({ error: 'This account is suspended. Reach out to support.' });
      return;
    }
    if (store.db.settings.maintenanceMode && user.role !== 'admin') {
      res.status(503).json({
        error: 'Maintenance mode is active. Only our team can sign in right now.',
      });
      return;
    }
    user.lastLoginAt = new Date().toISOString();
    store.save();
    const token = signToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/signup', async (req, res) => {
    if (store.db.settings.maintenanceMode) {
      res.status(503).json({ error: 'Registrations are paused during maintenance.' });
      return;
    }
    if (store.db.settings.allowNewSignups === false) {
      res.status(403).json({ error: 'New account registrations are currently paused.' });
      return;
    }
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const referralCodeInput = String(req.body?.referralCode || '').trim().toUpperCase();

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Please provide your full name' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address' });
      return;
    }
    const emailDomain = email.split('@')[1] || '';
    const blockedDomains = (store.db.settings.blockedEmailDomains || []).map((d) =>
      String(d || '').trim().toLowerCase(),
    );
    if (emailDomain && blockedDomains.includes(emailDomain)) {
      res.status(403).json({ error: 'Registrations from this email domain are currently blocked.' });
      return;
    }
    const blockedNames = (store.db.settings.blockedNameKeywords || [])
      .map((kw) => String(kw || '').trim().toLowerCase())
      .filter(Boolean);
    const lowerName = name.toLowerCase();
    if (blockedNames.some((kw) => lowerName.includes(kw))) {
      res.status(403).json({ error: 'That display name contains a restricted keyword.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    if (store.db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = hashPassword(password);

    if (store.db.settings.requireEmailVerification !== false) {
      const nowMs = Date.now();
      store.db.pendingSignups = (store.db.pendingSignups || []).filter(
        (p) => p.expiresAt > nowMs && p.email.toLowerCase() !== email,
      );
      const code = generateSixDigitCode();
      const expiresInMinutes = 15;
      store.db.pendingSignups.unshift({
        email,
        name,
        passwordHash,
        referralCodeInput: referralCodeInput || undefined,
        codeHash: hashVerificationCode(email, code),
        expiresAt: nowMs + expiresInMinutes * 60 * 1000,
        attempts: 0,
        lastSentAt: nowMs,
      });
      store.save();

      const mailRes = await sendVerificationCodeEmail({
        to: email,
        name,
        code,
        expiresInMinutes,
        settings: store.db.settings,
      });

      res.json({
        requiresVerification: true,
        email,
        mailSent: mailRes.delivered,
        message: mailRes.delivered
          ? `We sent a 6-digit verification code to ${email}. Enter it below to activate your account.`
          : mailRes.error ||
            'Email delivery could not be completed. Configure SMTP or Resend in Admin Settings, or ask Admin for support.',
      });
      return;
    }

    const newUser = createRegisteredUserRecord({
      name,
      email,
      passwordHash,
      referralCodeInput,
      authProvider: 'email',
    });

    const token = signToken(newUser.id);
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/signup/verify', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim().replace(/\s+/g, '');
    if (!email || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Enter the 6-digit verification code sent to your email.' });
      return;
    }
    const nowMs = Date.now();
    const pendingList = store.db.pendingSignups || [];
    const pending = pendingList.find((p) => p.email.toLowerCase() === email);
    if (!pending) {
      res.status(400).json({ error: 'No pending verification found for this email. Please sign up again.' });
      return;
    }
    if (nowMs > pending.expiresAt) {
      store.db.pendingSignups = pendingList.filter((p) => p.email.toLowerCase() !== email);
      store.save();
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }
    if (pending.attempts >= 5) {
      store.db.pendingSignups = pendingList.filter((p) => p.email.toLowerCase() !== email);
      store.save();
      res.status(429).json({ error: 'Too many invalid attempts. Please register again.' });
      return;
    }

    const expectedHash = Buffer.from(pending.codeHash, 'hex');
    const providedHash = Buffer.from(hashVerificationCode(email, code), 'hex');
    if (
      expectedHash.length !== providedHash.length ||
      !crypto.timingSafeEqual(expectedHash, providedHash)
    ) {
      pending.attempts += 1;
      store.save();
      res.status(400).json({ error: 'Invalid verification code. Check your email and try again.' });
      return;
    }

    if (store.db.users.some((u) => u.email.toLowerCase() === email)) {
      store.db.pendingSignups = pendingList.filter((p) => p.email.toLowerCase() !== email);
      store.save();
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    store.db.pendingSignups = pendingList.filter((p) => p.email.toLowerCase() !== email);
    const newUser = createRegisteredUserRecord({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      referralCodeInput: pending.referralCodeInput,
      authProvider: 'email',
    });

    const token = signToken(newUser.id);
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/signup/resend', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }
    const pendingList = store.db.pendingSignups || [];
    const pending = pendingList.find((p) => p.email.toLowerCase() === email);
    if (!pending) {
      res.status(404).json({ error: 'No pending registration found. Please fill out the signup form again.' });
      return;
    }
    const nowMs = Date.now();
    if (nowMs - pending.lastSentAt < 30_000) {
      const waitSec = Math.ceil((30_000 - (nowMs - pending.lastSentAt)) / 1000);
      res.status(429).json({ error: `Please wait ${waitSec}s before requesting another code.` });
      return;
    }

    const code = generateSixDigitCode();
    const expiresInMinutes = 15;
    pending.codeHash = hashVerificationCode(email, code);
    pending.expiresAt = nowMs + expiresInMinutes * 60 * 1000;
    pending.attempts = 0;
    pending.lastSentAt = nowMs;
    store.save();

    const mailRes = await sendVerificationCodeEmail({
      to: email,
      name: pending.name,
      code,
      expiresInMinutes,
      settings: store.db.settings,
    });

    res.json({
      ok: true,
      mailSent: mailRes.delivered,
      error: mailRes.delivered ? undefined : mailRes.error || 'Mail provider rejected or not configured',
    });
  });

  app.post('/api/auth/google', async (req, res) => {
    const settings = store.db.settings;
    if (!settings.googleAuthEnabled) {
      res.status(403).json({ error: 'Google Sign-In is currently disabled by Admin.' });
      return;
    }
    const expectedClientId = (settings.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!expectedClientId) {
      res.status(400).json({ error: 'Google Client ID is not configured yet.' });
      return;
    }
    const credential = String(req.body?.credential || '').trim();
    const referralCodeInput = String(req.body?.referralCode || '').trim().toUpperCase();
    if (!credential) {
      res.status(400).json({ error: 'Missing Google sign-in token' });
      return;
    }

    try {
      const verifyResp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );
      if (!verifyResp.ok) {
        res.status(401).json({ error: 'Google sign-in token could not be verified' });
        return;
      }
      const info = (await verifyResp.json()) as {
        aud?: string;
        email?: string;
        email_verified?: string | boolean;
        name?: string;
        picture?: string;
        exp?: string;
      };
      const email = String(info.email || '').trim().toLowerCase();
      const verified = info.email_verified === true || info.email_verified === 'true';
      const expMs = info.exp ? Number(info.exp) * 1000 : Date.now() + 60_000;
      if (!email || !verified || info.aud !== expectedClientId || expMs < Date.now()) {
        res.status(401).json({ error: 'Google token verification failed or mismatched Client ID' });
        return;
      }

      const existing = store.db.users.find((u) => u.email.toLowerCase() === email);
      if (existing) {
        if (existing.status === 'suspended') {
          res.status(403).json({ error: 'This account is suspended. Reach out to support.' });
          return;
        }
        if (settings.maintenanceMode && existing.role !== 'admin') {
          res.status(503).json({ error: 'Maintenance mode is active. Only our team can sign in right now.' });
          return;
        }
        existing.lastLoginAt = new Date().toISOString();
        existing.emailVerified = true;
        if (!existing.avatarUrl && info.picture) {
          existing.avatarUrl = info.picture;
        }
        store.save();
        const token = signToken(existing.id);
        res.json({ token, user: toPublicUser(existing) });
        return;
      }

      if (settings.maintenanceMode) {
        res.status(503).json({ error: 'Registrations are paused during maintenance.' });
        return;
      }
      if (settings.allowNewSignups === false) {
        res.status(403).json({ error: 'New account registrations are currently paused.' });
        return;
      }

      const newUser = createRegisteredUserRecord({
        name: String(info.name || email.split('@')[0]).trim(),
        email,
        passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        referralCodeInput,
        authProvider: 'google',
        avatarUrl: info.picture,
      });
      const token = signToken(newUser.id);
      res.status(201).json({ token, user: toPublicUser(newUser) });
    } catch (err) {
      console.error('Google tokeninfo verification error:', err);
      res.status(502).json({ error: 'Could not reach Google verification service. Try again.' });
    }
  });

  app.get('/api/auth/me', (req: AuthedRequest, res) => {
    const user = resolveAuthedUser(req, res);
    if (!user) return;
    res.json({
      user: toPublicUser(user),
      maintenanceMode: Boolean(store.db.settings.maintenanceMode),
    });
  });

  // --- USER DASHBOARD OVERVIEW & UNIFIED ORDERS ---
  app.get('/api/dashboard/overview', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const db = store.db;
    const smsOrders = db.smsOrders.filter((o) => o.userId === user.id);
    const boostingOrders = db.boostingOrders.filter((o) => o.userId === user.id);
    const vaultItems = db.vaultItems.filter((v) => v.userId === user.id);
    const transactions = db.transactions.filter((t) => t.userId === user.id).slice(0, 12);
    const notifications = db.notifications.filter(
      (n) => n.targetUserId === 'all' || n.targetUserId === user.id,
    );
    const unreadNotifications = notifications.filter((n) => !n.readBy.includes(user.id)).length;
    const referralsCount = db.users.filter((u) => u.referredBy === user.id).length;

    res.json({
      user: toPublicUser(user),
      stats: {
        activeSmsCount: smsOrders.filter((o) => o.status === 'waiting').length,
        totalSmsCount: smsOrders.length,
        activeBoostingCount: boostingOrders.filter(
          (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'refilling',
        ).length,
        vaultCount: vaultItems.length,
        referralsCount,
        unreadNotifications,
      },
      recentTransactions: transactions,
      notifications: notifications.slice(0, 5),
      tutorials: db.tutorials.slice(0, 3),
    });
  });

  function expireTimedOutSmsOrders(): number {
    const now = Date.now();
    let expiredCount = 0;
    for (const order of store.db.smsOrders) {
      if (order.status !== 'waiting') continue;
      const expMs = new Date(order.expiresAt).getTime();
      if (!Number.isFinite(expMs) || now < expMs) continue;

      order.status = 'expired';
      expiredCount += 1;

      const user = store.db.users.find((u) => u.id === order.userId);
      if (user) {
        user.balance += order.price;
        const refundIso = new Date(now).toISOString();
        const refundTxId = makeId('tx');
        store.db.transactions.unshift({
          id: refundTxId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          type: 'refund',
          amount: order.price,
          status: 'completed',
          description: `Auto-Refund (15m Timer Expired): ${order.serviceName} (${order.phoneNumber})`,
          createdAt: refundIso,
        });
        store.syncAccountingStatus(order.id, 'expired');
        store.recordAccountingEntry({
          kind: 'transaction',
          sourceId: refundTxId,
          category: 'refund',
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          title: 'SMS EXPIRED REFUND',
          detail: `Auto-Refund (15m Timer Expired): ${order.serviceName} (${order.phoneNumber})`,
          amount: order.price,
          status: 'completed',
          createdAt: refundIso,
        });
        store.db.notifications.unshift({
          id: makeId('ntf'),
          title: `SMS Session Expired (${order.serviceName})`,
          message: `15-minute OTP wait expired for ${order.phoneNumber}. ${store.db.settings.currencySymbol}${order.price.toLocaleString()} was automatically refunded to your wallet.`,
          type: 'info',
          targetUserId: user.id,
          readBy: [],
          createdAt: new Date(now).toISOString(),
        });
      }

      const poolItem = store.db.smsPool.find((p) => p.assignedOrderId === order.id);
      if (poolItem) {
        poolItem.used = false;
        poolItem.assignedOrderId = undefined;
      }
    }
    if (expiredCount > 0) {
      store.save();
    }
    return expiredCount;
  }

  const expiryInterval = setInterval(() => {
    expireTimedOutSmsOrders();
  }, 15_000);
  expiryInterval.unref();

  app.get('/api/orders/all', requireAuth, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const userId = req.currentUser!.id;
    res.json({
      vaultItems: store.db.vaultItems.filter((v) => v.userId === userId),
      smsOrders: store.db.smsOrders.filter((s) => s.userId === userId),
      boostingOrders: store.db.boostingOrders.filter((b) => b.userId === userId),
      balance: req.currentUser!.balance,
    });
  });

  // --- SMS VERIFICATION ---
  app.get('/api/sms/catalog', requireAuth, (_req, res) => {
    res.json({
      countries: store.db.smsCountries.filter((c) => c.active),
      services: store.db.smsServices.filter((s) => s.active),
    });
  });

  app.get('/api/sms/orders', requireAuth, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const orders = store.db.smsOrders.filter((o) => o.userId === req.currentUser!.id);
    res.json({ orders, balance: req.currentUser!.balance });
  });

  app.post('/api/sms/rent', requireAuth, (req: AuthedRequest, res) => {
    if (store.db.settings.enableSmsService === false) {
      res.status(403).json({ error: 'Virtual SMS verification is temporarily paused.' });
      return;
    }
    const user = req.currentUser!;
    const serviceId = String(req.body?.serviceId || '');
    const countryId = String(req.body?.countryId || '');
    const tier = req.body?.tier === 'alternate' ? 'alternate' : 'prime';
    const promoCodeStr = String(req.body?.promoCode || '').trim().toUpperCase();

    const service = store.db.smsServices.find((s) => s.id === serviceId && s.active);
    const country = store.db.smsCountries.find((c) => c.id === countryId && c.active);
    if (!service || !country) {
      res.status(404).json({ error: 'Selected SMS service or country is unavailable' });
      return;
    }

    const basePrice = Math.round(service.basePrice * country.multiplier);
    const altMode = store.db.settings.smsAlternateMode === 'markup' ? 'markup' : 'discount';
    const rawAltPct = Math.max(0, Number(store.db.settings.smsAlternateDiscountPct ?? 15));
    const altPct = Math.min(altMode === 'markup' ? 500 : 90, rawAltPct);
    const tierPrice =
      tier === 'alternate'
        ? altMode === 'markup'
          ? Math.max(50, Math.round(basePrice * (1 + altPct / 100)))
          : Math.max(50, Math.round(basePrice * (1 - altPct / 100)))
        : basePrice;
    const smsFlash = applyFlashSaleDiscount(tierPrice, store.db.settings, 'sms');
    const saleTierPrice = smsFlash.active ? Math.max(50, smsFlash.finalAmount) : tierPrice;

    let price = saleTierPrice;
    let appliedPromo: PromoCode | undefined;
    if (promoCodeStr) {
      if (store.db.settings.allowPromoCodes === false) {
        res.status(403).json({ error: 'Promo codes are currently disabled.' });
        return;
      }
      appliedPromo = store.db.promoCodes.find(
        (p) => p.active && p.code.toUpperCase() === promoCodeStr && p.uses < p.maxUses,
      );
      if (!appliedPromo) {
        res.status(400).json({ error: 'Coupon code is invalid or expired' });
        return;
      }
      if (appliedPromo.discountType === 'percent') {
        price = Math.max(50, Math.round(saleTierPrice * (1 - appliedPromo.value / 100)));
      } else {
        price = Math.max(50, saleTierPrice - appliedPromo.value);
      }
    }

    if (user.balance < price) {
      res.status(400).json({
        error: `Insufficient wallet balance. You need ${store.db.settings.currencySymbol}${price.toLocaleString()}.`,
      });
      return;
    }

    const poolMatch = store.db.smsPool.find(
      (p) =>
        !p.used &&
        p.countryId === country.id &&
        (!p.serviceId || p.serviceId === service.id),
    );

    const now = Date.now();
    const phoneNumber = poolMatch ? poolMatch.phoneNumber : 'Awaiting number';
    const orderId = makeId('sms');

    user.balance -= price;
    if (service.stock > 0) service.stock -= 1;
    if (appliedPromo) appliedPromo.uses += 1;

    const tierLabel =
      tier === 'alternate'
        ? store.db.settings.smsAlternateLabel || 'Alternate'
        : store.db.settings.smsPrimeLabel || 'Prime';

    const smsExpiryMins = Math.max(5, Math.min(120, Number(store.db.settings.smsOrderExpiryMinutes ?? 15)));
    const order: (typeof store.db.smsOrders)[number] = {
      id: orderId,
      userId: user.id,
      userEmail: user.email,
      serviceId: service.id,
      serviceName: service.name,
      countryId: country.id,
      countryName: country.name,
      phoneNumber,
      price,
      status: 'waiting',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + smsExpiryMins * 60 * 1000).toISOString(),
    };

    if (poolMatch) {
      poolMatch.used = true;
      poolMatch.assignedOrderId = orderId;
      if (poolMatch.presetOtp) {
        order.status = 'received';
        order.otpCode = poolMatch.presetOtp;
        order.smsText = service.sampleTemplate.replace('{{CODE}}', poolMatch.presetOtp);
      }
    }

    store.db.smsOrders.unshift(order);
    const smsTxId = makeId('tx');
    const smsNowIso = new Date(now).toISOString();
    const descSuffix = `${tierLabel}${appliedPromo ? ` · ${appliedPromo.code}` : ''}`;
    store.db.transactions.unshift({
      id: smsTxId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'purchase',
      amount: price,
      status: 'completed',
      description: `SMS Rental: ${service.name} (${country.name}) [${descSuffix}]`,
      createdAt: smsNowIso,
    });
    store.recordAccountingEntry({
      kind: 'order',
      sourceId: order.id,
      category: 'SMS Verification',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: `${service.name} (${country.name})`,
      detail: `Number: ${phoneNumber} · ${descSuffix}`,
      amount: price,
      status: order.status,
      createdAt: smsNowIso,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: smsTxId,
      category: 'purchase',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'SMS RENTAL',
      detail: `SMS Rental: ${service.name} (${country.name}) [${descSuffix}]`,
      amount: price,
      status: 'completed',
      createdAt: smsNowIso,
    });
    store.addAdminAlert(
      'New SMS Number Rented',
      `${user.email} rented ${service.name} (${country.name} · ${tierLabel}) · ${phoneNumber}`,
      'order',
    );
    store.save();

    void dispatchAdminPhoneAlert({
      eventType: 'new_order',
      message: `[${store.db.settings.siteName}] New SMS Order: ${user.email} rented ${service.name} (${country.name}) for ${store.db.settings.currencySymbol}${price.toLocaleString()}`,
    });

    res.status(201).json({ order, balance: user.balance });
  });

  app.post('/api/sms/orders/:id/check-otp', requireAuth, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const user = req.currentUser!;
    const order = store.db.smsOrders.find((o) => o.id === req.params.id && o.userId === user.id);
    if (!order) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    if (order.status === 'cancelled') {
      res.status(400).json({ error: 'This number was already cancelled and refunded.' });
      return;
    }
    res.json({ order, balance: user.balance });
  });

  app.post('/api/sms/orders/:id/request-another', requireAuth, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const user = req.currentUser!;
    const order = store.db.smsOrders.find((o) => o.id === req.params.id && o.userId === user.id);
    if (!order) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    if (order.status === 'cancelled' || order.status === 'expired') {
      res.status(400).json({ error: 'Cannot request another code on a closed or expired number' });
      return;
    }
    order.status = 'waiting';
    order.otpCode = undefined;
    order.smsText = 'Waiting for another OTP code from our team.';
    order.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    store.addAdminAlert(
      'SMS New OTP Requested',
      `${user.email} requested another OTP for ${order.serviceName} (${order.phoneNumber})`,
      'order',
    );
    store.save();
    res.json({ order });
  });

  app.post('/api/sms/orders/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const user = req.currentUser!;
    const order = store.db.smsOrders.find((o) => o.id === req.params.id && o.userId === user.id);
    if (!order) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    if (order.status === 'expired') {
      res.json({ order, balance: user.balance });
      return;
    }
    if (order.status !== 'waiting') {
      res.status(400).json({ error: 'Only waiting orders without an OTP can be cancelled for refund' });
      return;
    }
    order.status = 'cancelled';
    user.balance += order.price;
    const poolItem = store.db.smsPool.find((p) => p.assignedOrderId === order.id);
    if (poolItem) {
      poolItem.used = false;
      poolItem.assignedOrderId = undefined;
    }
    const cancelNow = new Date().toISOString();
    const cancelTxId = makeId('tx');
    store.db.transactions.unshift({
      id: cancelTxId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'refund',
      amount: order.price,
      status: 'completed',
      description: `Instant SMS Refund: ${order.serviceName} (${order.phoneNumber})`,
      createdAt: cancelNow,
    });
    store.syncAccountingStatus(order.id, 'cancelled');
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: cancelTxId,
      category: 'refund',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'SMS CANCEL REFUND',
      detail: `Instant SMS Refund: ${order.serviceName} (${order.phoneNumber})`,
      amount: order.price,
      status: 'completed',
      createdAt: cancelNow,
    });
    store.save();
    res.json({ order, balance: user.balance });
  });

  // --- SOCIAL BOOSTING ---
  app.get('/api/boosting/catalog', requireAuth, (_req, res) => {
    res.json({
      services: store.db.boostingServices.filter((s) => s.active),
    });
  });

  app.get('/api/boosting/orders', requireAuth, (req: AuthedRequest, res) => {
    const orders = store.db.boostingOrders.filter((o) => o.userId === req.currentUser!.id);
    res.json({ orders });
  });

  app.post('/api/boosting/order', requireAuth, (req: AuthedRequest, res) => {
    if (store.db.settings.enableBoostingService === false) {
      res.status(403).json({ error: 'Social boosting orders are temporarily paused.' });
      return;
    }
    const user = req.currentUser!;
    const serviceId = String(req.body?.serviceId || '');
    const targetUrl = String(req.body?.targetUrl || '').trim();
    const quantity = Number(req.body?.quantity || 0);

    const service = store.db.boostingServices.find((s) => s.id === serviceId && s.active);
    if (!service) {
      res.status(404).json({ error: 'Boosting service not found' });
      return;
    }
    if (!targetUrl || targetUrl.length < 4) {
      res.status(400).json({ error: 'Please enter a valid profile or post link' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity < service.minQty || quantity > service.maxQty) {
      res.status(400).json({
        error: `Quantity must be between ${service.minQty.toLocaleString()} and ${service.maxQty.toLocaleString()}`,
      });
      return;
    }

    const rawBoostAmount = Math.max(10, Math.round((service.ratePer1k * quantity) / 1000));
    const boostFlash = applyFlashSaleDiscount(rawBoostAmount, store.db.settings, 'boosting');
    const amount = boostFlash.active ? Math.max(10, boostFlash.finalAmount) : rawBoostAmount;
    if (user.balance < amount) {
      res.status(400).json({
        error: `Insufficient wallet balance. Campaign costs ${store.db.settings.currencySymbol}${amount.toLocaleString()}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    user.balance -= amount;

    const order: (typeof store.db.boostingOrders)[number] = {
      id: makeId('bsto'),
      userId: user.id,
      userEmail: user.email,
      serviceId: service.id,
      serviceName: service.name,
      platform: service.platform,
      targetUrl,
      quantity,
      amount,
      status: 'pending',
      startCount: Math.floor(120 + Math.random() * 1400),
      remains: quantity,
      createdAt: now,
      updatedAt: now,
    };

    store.db.boostingOrders.unshift(order);
    const boostTxId = makeId('tx');
    store.db.transactions.unshift({
      id: boostTxId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'purchase',
      amount,
      status: 'completed',
      description: `Social Boost: ${service.platform} · ${quantity.toLocaleString()} qty`,
      createdAt: now,
    });
    store.recordAccountingEntry({
      kind: 'order',
      sourceId: order.id,
      category: 'Social Boosting',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: `${service.platform} · ${service.name}`,
      detail: `Qty: ${quantity.toLocaleString()} · Link: ${targetUrl}`,
      amount,
      status: order.status,
      createdAt: now,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: boostTxId,
      category: 'purchase',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'SOCIAL BOOST',
      detail: `Social Boost: ${service.platform} · ${quantity.toLocaleString()} qty`,
      amount,
      status: 'completed',
      createdAt: now,
    });
    store.addAdminAlert(
      'New Boosting Order',
      `${user.name} (${user.email}) · ${service.platform} ${service.name} · Qty: ${quantity.toLocaleString()} · Link: ${targetUrl} · ${store.db.settings.currencySymbol}${amount.toLocaleString()}`,
      'order',
    );
    store.db.emailLogs.unshift({
      id: makeId('eml'),
      to: store.db.settings.supportEmail || 'chibuikeexcellent592@gmail.com',
      subject: `New Boosting Purchase #${order.id} — ${service.platform} ${service.name}`,
      body: `User: ${user.name} (${user.email})\nPlatform: ${service.platform}\nPackage: ${service.name}\nTarget Link: ${targetUrl}\nQuantity: ${quantity.toLocaleString()}\nAmount Paid: ${store.db.settings.currencySymbol}${amount.toLocaleString()}\nTime: ${now}`,
      sentBy: user.email,
      createdAt: now,
    });
    store.save();

    void dispatchAdminPhoneAlert({
      eventType: 'new_order',
      message: `[${store.db.settings.siteName}] BOOSTING ORDER #${order.id}\nUser: ${user.name} (${user.email})\nPlatform: ${service.platform}\nPackage: ${service.name}\nQuantity: ${quantity.toLocaleString()}\nLink: ${targetUrl}\nPaid: ${store.db.settings.currencySymbol}${amount.toLocaleString()}`,
    });

    res.status(201).json({ order, balance: user.balance });
  });

  app.post('/api/boosting/orders/:id/refill', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const order = store.db.boostingOrders.find((o) => o.id === req.params.id && o.userId === user.id);
    if (!order) {
      res.status(404).json({ error: 'Boosting order not found' });
      return;
    }
    if (order.status !== 'completed') {
      res.status(400).json({ error: 'Refill can only be requested on completed orders' });
      return;
    }
    order.status = 'refilling';
    order.updatedAt = new Date().toISOString();
    store.addAdminAlert('Refill Requested', `${user.email} requested refill for ${order.id}`, 'order');
    store.save();
    res.json({ order });
  });

  // --- MARKETPLACE & VAULT ---
  app.get('/api/marketplace/listings', requireAuth, (req: AuthedRequest, res) => {
    res.json({
      categories: store.db.marketplaceCategories,
      listings: store.db.marketplaceListings.filter((l) => l.active),
      vault: store.db.vaultItems.filter((v) => v.userId === req.currentUser!.id),
      defaultBuyWarning: store.db.settings.defaultBuyWarning,
    });
  });

  app.post('/api/marketplace/purchase', requireAuth, (req: AuthedRequest, res) => {
    if (store.db.settings.enableMarketplace === false) {
      res.status(403).json({ error: 'Marketplace purchases are temporarily paused.' });
      return;
    }
    const user = req.currentUser!;
    const listingId = String(req.body?.listingId || '');
    const rawQty = Number(req.body?.quantity ?? 1);
    const quantity = Number.isFinite(rawQty) ? Math.floor(rawQty) : 0;
    const promoCodeStr = String(req.body?.promoCode || '').trim().toUpperCase();
    const listing = store.db.marketplaceListings.find((l) => l.id === listingId && l.active);
    if (!listing) {
      res.status(404).json({ error: 'Marketplace listing not found' });
      return;
    }
    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }
    const availableStock =
      listing.stockKeys && listing.stockKeys.length > 0 ? listing.stockKeys.length : listing.stock;
    if (availableStock <= 0) {
      res.status(400).json({ error: 'This product is currently out of stock' });
      return;
    }
    if (quantity > availableStock) {
      res.status(400).json({
        error: `Only ${availableStock} unit${availableStock === 1 ? '' : 's'} available in stock`,
      });
      return;
    }

    const rawTotal = listing.price * quantity;
    const mktFlash = applyFlashSaleDiscount(rawTotal, store.db.settings, 'marketplace');
    const baseTotal = mktFlash.active ? mktFlash.finalAmount : rawTotal;
    let finalTotal = baseTotal;
    let appliedPromo: PromoCode | undefined;
    if (promoCodeStr) {
      if (store.db.settings.allowPromoCodes === false) {
        res.status(403).json({ error: 'Promo codes are currently disabled.' });
        return;
      }
      appliedPromo = store.db.promoCodes.find(
        (p) => p.active && p.code.toUpperCase() === promoCodeStr && p.uses < p.maxUses,
      );
      if (!appliedPromo) {
        res.status(400).json({ error: 'Promo code is invalid or expired' });
        return;
      }
      if (appliedPromo.discountType === 'percent') {
        finalTotal = Math.max(0, Math.round(baseTotal * (1 - appliedPromo.value / 100)));
      } else {
        finalTotal = Math.max(0, baseTotal - appliedPromo.value);
      }
    }

    if (user.balance < finalTotal) {
      res.status(400).json({
        error: `Insufficient wallet balance. Need ${store.db.settings.currencySymbol}${finalTotal.toLocaleString()}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    user.balance -= finalTotal;
    const hadStockKeys = Boolean(listing.stockKeys && listing.stockKeys.length > 0);
    const createdVaultItems: (typeof store.db.vaultItems)[number][] = [];
    const perUnitPaid = quantity === 1 ? finalTotal : Math.round(finalTotal / quantity);

    for (let i = 0; i < quantity; i++) {
      let deliveredCredential = '';
      if (hadStockKeys && listing.stockKeys.length > 0) {
        deliveredCredential = listing.stockKeys.shift()!;
      } else {
        deliveredCredential = buildCredentialFromTemplate(listing.credentialTemplate);
      }
      const itemPrice =
        i === quantity - 1 ? Math.max(0, finalTotal - perUnitPaid * (quantity - 1)) : perUnitPaid;
      createdVaultItems.push({
        id: makeId('vlt'),
        userId: user.id,
        sourceType: 'marketplace',
        sourceId: listing.id,
        title: quantity > 1 ? `${listing.title} (${i + 1}/${quantity})` : listing.title,
        category: listing.category,
        price: itemPrice,
        deliveredCredential,
        deliveryType: listing.deliveryType,
        buyWarningShown: listing.buyWarning || store.db.settings.defaultBuyWarning,
        buyWarningLevel:
          listing.buyWarningLevel || store.db.settings.defaultBuyWarningLevel || 'serious',
        createdAt: now,
      });
    }

    if (hadStockKeys) {
      listing.stock = listing.stockKeys.length;
    } else {
      listing.stock = Math.max(0, listing.stock - quantity);
    }
    listing.soldCount += quantity;
    if (appliedPromo) {
      appliedPromo.uses += 1;
    }

    for (let i = createdVaultItems.length - 1; i >= 0; i--) {
      store.db.vaultItems.unshift(createdVaultItems[i]);
      store.recordAccountingEntry({
        kind: 'order',
        sourceId: createdVaultItems[i].id,
        category: 'Marketplace',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        title: createdVaultItems[i].title,
        detail: `${listing.category} · ${listing.deliveryType}`,
        amount: createdVaultItems[i].price,
        status: 'delivered',
        createdAt: now,
      });
    }
    const mktTxId = makeId('tx');
    store.db.transactions.unshift({
      id: mktTxId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'purchase',
      amount: finalTotal,
      status: 'completed',
      description: `Marketplace Order: ${listing.title}${quantity > 1 ? ` × ${quantity}` : ''}${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
      createdAt: now,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: mktTxId,
      category: 'purchase',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'MARKETPLACE PURCHASE',
      detail: `Marketplace Order: ${listing.title}${quantity > 1 ? ` × ${quantity}` : ''}${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
      amount: finalTotal,
      status: 'completed',
      createdAt: now,
    });
    store.addAdminAlert(
      'Marketplace Asset Sold',
      `${user.email} purchased ${quantity}× ${listing.title} for ${store.db.settings.currencySymbol}${finalTotal.toLocaleString()}`,
      'order',
    );
    store.save();

    void dispatchAdminPhoneAlert({
      eventType: 'new_order',
      message: `[${store.db.settings.siteName}] New Marketplace Order: ${user.email} bought ${quantity}× ${listing.title} for ${store.db.settings.currencySymbol}${finalTotal.toLocaleString()}`,
    });

    res.status(201).json({
      vaultItem: createdVaultItems[0],
      vaultItems: createdVaultItems,
      quantity,
      totalPaid: finalTotal,
      listing,
      balance: user.balance,
    });
  });

  // --- CUSTOM STOREFRONT SECTIONS ---
  app.get('/api/sections/:id', requireAuth, (req: AuthedRequest, res) => {
    const section = store.db.customSections.find((s) => s.id === req.params.id && s.active);
    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    res.json({
      section: {
        ...section,
        products: section.products.filter((p) => p.active),
      },
    });
  });

  app.post('/api/sections/purchase', requireAuth, (req: AuthedRequest, res) => {
    if (store.db.settings.enableMarketplace === false) {
      res.status(403).json({ error: 'Marketplace purchases are temporarily paused.' });
      return;
    }
    const user = req.currentUser!;
    const sectionId = String(req.body?.sectionId || '');
    const productId = String(req.body?.productId || '');
    const rawQty = Number(req.body?.quantity ?? 1);
    const quantity = Number.isFinite(rawQty) ? Math.floor(rawQty) : 0;

    const section = store.db.customSections.find((s) => s.id === sectionId && s.active);
    const product = section?.products.find((p) => p.id === productId && p.active);
    if (!section || !product) {
      res.status(404).json({ error: 'Product not found in section' });
      return;
    }
    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }
    if (product.stock <= 0) {
      res.status(400).json({ error: 'Out of stock' });
      return;
    }
    if (quantity > product.stock) {
      res.status(400).json({
        error: `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available in stock`,
      });
      return;
    }
    const rawSectionPrice = product.price * quantity;
    const secFlash = applyFlashSaleDiscount(rawSectionPrice, store.db.settings, 'marketplace');
    const totalPrice = secFlash.active ? secFlash.finalAmount : rawSectionPrice;
    if (user.balance < totalPrice) {
      res.status(400).json({
        error: `Insufficient wallet balance. Need ${store.db.settings.currencySymbol}${totalPrice.toLocaleString()}.`,
      });
      return;
    }

    const now = new Date().toISOString();
    user.balance -= totalPrice;
    product.stock -= quantity;

    const secUnitPaid = quantity === 1 ? totalPrice : Math.round(totalPrice / quantity);
    const createdVaultItems: (typeof store.db.vaultItems)[number][] = [];
    for (let i = 0; i < quantity; i++) {
      const itemPrice =
        i === quantity - 1 ? Math.max(0, totalPrice - secUnitPaid * (quantity - 1)) : secUnitPaid;
      createdVaultItems.push({
        id: makeId('vlt'),
        userId: user.id,
        sourceType: 'section',
        sourceId: product.id,
        title: quantity > 1 ? `${product.title} (${i + 1}/${quantity})` : product.title,
        category: section.name,
        price: itemPrice,
        deliveredCredential: buildCredentialFromTemplate(product.credentialTemplate),
        deliveryType: 'Vault Delivery',
        buyWarningShown:
          product.buyWarning || section.defaultBuyWarning || store.db.settings.defaultBuyWarning,
        buyWarningLevel:
          product.buyWarningLevel ||
          section.defaultBuyWarningLevel ||
          store.db.settings.defaultBuyWarningLevel ||
          'serious',
        createdAt: now,
      });
    }

    for (let i = createdVaultItems.length - 1; i >= 0; i--) {
      store.db.vaultItems.unshift(createdVaultItems[i]);
      store.recordAccountingEntry({
        kind: 'order',
        sourceId: createdVaultItems[i].id,
        category: 'Custom Section',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        title: createdVaultItems[i].title,
        detail: `${section.name} · Vault Delivery`,
        amount: createdVaultItems[i].price,
        status: 'delivered',
        createdAt: now,
      });
    }
    const secTxId = makeId('tx');
    store.db.transactions.unshift({
      id: secTxId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'purchase',
      amount: totalPrice,
      status: 'completed',
      description: `${section.name}: ${product.title}${quantity > 1 ? ` × ${quantity}` : ''}`,
      createdAt: now,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: secTxId,
      category: 'purchase',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'SECTION PURCHASE',
      detail: `${section.name}: ${product.title}${quantity > 1 ? ` × ${quantity}` : ''}`,
      amount: totalPrice,
      status: 'completed',
      createdAt: now,
    });
    store.save();

    void dispatchAdminPhoneAlert({
      eventType: 'new_order',
      message: `[${store.db.settings.siteName}] New Section Order: ${user.email} bought ${quantity}× ${product.title} (${section.name}) for ${store.db.settings.currencySymbol}${totalPrice.toLocaleString()}`,
    });

    res.status(201).json({
      vaultItem: createdVaultItems[0],
      vaultItems: createdVaultItems,
      quantity,
      totalPaid: totalPrice,
      product,
      balance: user.balance,
    });
  });

  // --- WALLET & MONIEPOINT RECEIPT FUNDING ---
  app.get('/api/wallet', requireAuth, (req: AuthedRequest, res) => {
    const db = store.db;
    const transactions = db.transactions.filter((t) => t.userId === req.currentUser!.id);
    res.json({
      balance: req.currentUser!.balance,
      minimumDeposit: db.settings.minimumDeposit,
      bankDetails: {
        bankName: db.settings.bankName,
        accountNumber: db.settings.bankAccountNumber,
        accountName: db.settings.bankAccountName,
      },
      transactions,
    });
  });

  app.post('/api/wallet/deposit', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const db = store.db;
    const amount = Number(req.body?.amount || 0);
    const receiptImage = String(req.body?.receiptImage || '');
    const senderNote = String(req.body?.senderNote || '').trim();

    if (!Number.isFinite(amount) || amount < db.settings.minimumDeposit) {
      res.status(400).json({
        error: `Minimum deposit is ${db.settings.currencySymbol}${db.settings.minimumDeposit.toLocaleString()}`,
      });
      return;
    }
    const maxDep = Number(db.settings.maxDepositAmount ?? 0);
    if (maxDep > 0 && amount > maxDep) {
      res.status(400).json({
        error: `Maximum deposit per transfer is ${db.settings.currencySymbol}${maxDep.toLocaleString()}`,
      });
      return;
    }
    if (!receiptImage || !receiptImage.startsWith('data:image/')) {
      res.status(400).json({ error: 'Please upload a valid Moniepoint transfer receipt image' });
      return;
    }

    const existingDeposits = db.transactions
      .filter((t) => t.type === 'deposit')
      .map((t) => ({
        id: t.id,
        receiptHash: t.receiptHash,
        reference: t.aiAudit?.extractedReference,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
      }));

    const { aiAudit, receiptHash, allChecksPassed } = await verifyMoniepointReceiptWithAi({
      receiptDataUrl: receiptImage,
      claimedAmount: amount,
      expectedBank: db.settings.bankName,
      expectedAccountNumber: db.settings.bankAccountNumber,
      expectedAccountName: db.settings.bankAccountName,
      existingDeposits,
    });

    const autoVerified =
      db.settings.autoApproveDeposits &&
      aiAudit.verdict === 'match' &&
      aiAudit.confidence >= 88 &&
      allChecksPassed;
    const autoRejected =
      db.settings.autoApproveDeposits &&
      aiAudit.verdict === 'mismatch' &&
      aiAudit.confidence >= 85;

    const status = autoVerified ? 'verified' : autoRejected ? 'rejected' : 'pending';
    const now = new Date().toISOString();

    if (autoVerified) {
      user.balance += amount;
      creditReferrerOnFirstVerifiedDeposit(user, now);
    }

    const transaction: (typeof db.transactions)[number] = {
      id: makeId('dep'),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: 'deposit',
      amount,
      status,
      description: `${db.settings.bankName} Transfer Deposit (${db.settings.bankAccountNumber})`,
      receiptImage,
      receiptHash,
      senderNote: senderNote || undefined,
      aiAudit,
      createdAt: now,
    };

    db.transactions.unshift(transaction);
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: transaction.id,
      category: 'deposit',
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: 'WALLET DEPOSIT',
      detail: transaction.description,
      amount,
      status,
      createdAt: now,
    });
    store.addAdminAlert(
      autoVerified
        ? 'Deposit Auto-Verified'
        : autoRejected
          ? 'Deposit Auto-Rejected'
          : 'Moniepoint Receipt Uploaded',
      `${user.email} submitted ${db.settings.currencySymbol}${amount.toLocaleString()} (${aiAudit.verdict} · ${aiAudit.confidence}%)`,
      'deposit',
    );
    store.save();

    void dispatchAdminPhoneAlert({
      eventType: 'wallet_funding',
      message: `[${db.settings.siteName}] Wallet Funding (${status.toUpperCase()}): ${user.name} (${user.email}) submitted ${db.settings.currencySymbol}${amount.toLocaleString()} to ${db.settings.bankName} ${db.settings.bankAccountNumber}. AI: ${aiAudit.verdict}`,
    });

    res.status(201).json({
      transaction,
      balance: user.balance,
      autoVerified,
      autoRejected,
    });
  });

  // --- NOTIFICATIONS ---
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const items = store.db.notifications.filter(
      (n) => n.targetUserId === 'all' || n.targetUserId === user.id,
    );
    res.json({ notifications: items });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const item = store.db.notifications.find((n) => n.id === req.params.id);
    if (item && !item.readBy.includes(user.id)) {
      item.readBy.push(user.id);
      store.save();
    }
    res.json({ ok: true });
  });

  // --- TUTORIALS ---
  app.get('/api/tutorials', requireAuth, (_req, res) => {
    res.json({ tutorials: store.db.tutorials });
  });

  // --- SUPPORT TICKETS ---
  app.get('/api/tickets', requireAuth, (req: AuthedRequest, res) => {
    const tickets = store.db.tickets.filter((t) => t.userId === req.currentUser!.id);
    res.json({ tickets });
  });

  app.post('/api/tickets', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const subject = String(req.body?.subject || '').trim();
    const category = String(req.body?.category || 'General').trim();
    const priority = (['normal', 'high', 'urgent'].includes(req.body?.priority)
      ? req.body.priority
      : 'normal') as 'normal' | 'high' | 'urgent';
    const message = String(req.body?.message || '').trim();

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required' });
      return;
    }

    const now = new Date().toISOString();
    const ticket: (typeof store.db.tickets)[number] = {
      id: makeId('tkt'),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      subject,
      category,
      priority,
      status: 'open',
      messages: [
        {
          id: makeId('msg'),
          senderRole: 'user',
          senderName: user.name,
          text: message,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    store.db.tickets.unshift(ticket);
    store.addAdminAlert('New Support Ticket', `${user.email}: ${subject}`, 'ticket');
    store.save();
    res.status(201).json({ ticket });
  });

  app.post('/api/tickets/:id/reply', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Reply message cannot be empty' });
      return;
    }
    const ticket = store.db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    if (user.role !== 'admin' && ticket.userId !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (
      user.role === 'admin' &&
      !isMainAdminUser(user) &&
      user.allowedAdminTab &&
      user.allowedAdminTab !== 'support' &&
      user.allowedAdminTab !== 'live' &&
      ticket.userId !== user.id
    ) {
      res.status(403).json({
        error: `Access restricted: your admin account is assigned to "${user.allowedAdminTab}" only.`,
      });
      return;
    }

    const now = new Date().toISOString();
    ticket.messages.push({
      id: makeId('msg'),
      senderRole: user.role === 'admin' ? 'admin' : 'user',
      senderName: user.name,
      text,
      createdAt: now,
    });
    ticket.updatedAt = now;
    if (user.role === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    store.save();
    res.json({ ticket });
  });

  // --- USER PROFILE & REFERRALS ---
  app.patch('/api/user/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const hasName = req.body?.name !== undefined;
    const hasEmail = req.body?.email !== undefined;
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (hasName) {
      if (name.length < 2) {
        res.status(400).json({ error: 'Display name must be at least 2 characters' });
        return;
      }
      user.name = name;
    }
    if (hasEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address' });
        return;
      }
      if (email !== user.email.toLowerCase()) {
        const taken = store.db.users.some(
          (u) => u.id !== user.id && u.email.toLowerCase() === email,
        );
        if (taken) {
          res.status(409).json({ error: 'Email already used by another account' });
          return;
        }
        user.email = email;
        if (isMainAdminUser(user)) {
          user.isMainAdmin = true;
          store.db.settings.mainAdminEmail = email;
        }
      }
    }
    if (typeof req.body?.avatarUrl === 'string') {
      const av = req.body.avatarUrl.trim();
      if (!av) {
        user.avatarUrl = undefined;
      } else if (
        (av.startsWith('data:image/') || av.startsWith('https://') || av.startsWith('http://')) &&
        av.length <= 2_500_000
      ) {
        user.avatarUrl = av;
      } else {
        res.status(400).json({ error: 'Invalid avatar image format or size too large.' });
        return;
      }
    }
    store.save();
    res.json({ user: toPublicUser(user) });
  });

  app.post('/api/user/password', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }
    user.passwordHash = hashPassword(newPassword);
    store.save();
    res.json({ ok: true });
  });

  app.get('/api/user/referral', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const verifiedDepositorIds = new Set(
      store.db.transactions
        .filter((t) => t.type === 'deposit' && t.status === 'verified')
        .map((t) => t.userId),
    );
    const invited = store.db.users
      .filter((u) => u.referredBy === user.id)
      .map((u) => {
        const deposited = verifiedDepositorIds.has(u.id);
        const rewarded = Boolean(u.referralRewardClaimed);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt,
          deposited,
          rewarded,
        };
      });
    const totalEarned = store.db.transactions
      .filter((t) => t.userId === user.id && t.type === 'referral_bonus')
      .reduce((sum, t) => sum + t.amount, 0);
    const rewardedCount = invited.filter((i) => i.rewarded).length;
    const pendingCount = invited.length - rewardedCount;
    res.json({
      referralCode: user.referralCode,
      bonusPerReferral: store.db.settings.referralBonusAmount,
      invited,
      rewardedCount,
      pendingCount,
      totalEarned,
    });
  });

  // ============================================================================
  // GOD-MODE ADMIN PANEL APIs
  // ============================================================================

  app.get('/api/admin/overview', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const db = store.db;
    const caller = req.currentUser!;
    const main = isMainAdminUser(caller);
    const scope = caller.allowedAdminTab;
    const isScoped = !main && Boolean(scope);
    const allow = (tabs: AdminFeatureTab[]) => !isScoped || (scope !== undefined && tabs.includes(scope));

    const visibleTransactions = db.transactions.filter((t) => !t.adminCleared);
    const visibleSmsOrders = db.smsOrders.filter((s) => !s.adminCleared);
    const visibleBoostingOrders = db.boostingOrders.filter((b) => !b.adminCleared);
    const userById = new Map(db.users.map((u) => [u.id, u]));
    const visibleVaultItems = db.vaultItems
      .filter((v) => !v.adminCleared)
      .map((v) => {
        const buyer = userById.get(v.userId);
        return {
          ...v,
          buyerEmail: v.buyerEmail || buyer?.email || 'Unknown user',
          buyerName: v.buyerName || buyer?.name || 'User',
        };
      });

    const totalRevenue = visibleTransactions
      .filter((t) => t.type === 'purchase')
      .reduce((s, t) => s + t.amount, 0);
    const totalDeposits = visibleTransactions
      .filter((t) => t.type === 'deposit' && t.status === 'verified')
      .reduce((s, t) => s + t.amount, 0);
    const totalUserBalances = db.users.reduce((s, u) => s + u.balance, 0);
    const pendingDeposits = visibleTransactions.filter(
      (t) => t.type === 'deposit' && t.status === 'pending',
    );
    const openTickets = db.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
    const unreadAlerts = db.adminAlerts.filter((a) => !a.read).length;

    const {
      smtpPass: _smtpPass,
      resendApiKey: _resendApiKey,
      mainAdminEmail: _mainEmail,
      ...redactedSettings
    } = db.settings;

    res.json({
      settings: main || scope === 'settings' ? db.settings : redactedSettings,
      metrics: {
        totalUsers: db.users.length,
        totalRevenue,
        totalDeposits,
        totalUserBalances,
        pendingDepositsCount: pendingDeposits.length,
        pendingBoostingCount: visibleBoostingOrders.filter(
          (b) => b.status === 'pending' || b.status === 'processing' || b.status === 'refilling',
        ).length,
        activeSmsCount: visibleSmsOrders.filter((s) => s.status === 'waiting').length,
        openTickets: openTickets.length,
        unreadAlerts,
      },
      users: allow(['overview', 'users']) ? db.users.map(toPublicUser) : [],
      transactions: allow(['overview', 'revenue', 'live', 'users', 'orders', 'accounting'])
        ? visibleTransactions
        : [],
      smsOrders: allow(['overview', 'revenue', 'live', 'users', 'orders', 'sms_numbers'])
        ? visibleSmsOrders
        : [],
      smsPool: allow(['overview', 'orders', 'catalog', 'sms_numbers']) ? db.smsPool : [],
      smsServices: db.smsServices,
      smsCountries: db.smsCountries,
      boostingOrders: allow(['overview', 'revenue', 'live', 'users', 'orders'])
        ? visibleBoostingOrders
        : [],
      boostingServices: db.boostingServices,
      marketplaceCategories: db.marketplaceCategories,
      marketplaceListings: db.marketplaceListings,
      vaultItems: allow(['overview', 'revenue', 'live', 'users', 'orders']) ? visibleVaultItems : [],
      customSections: db.customSections,
      notifications: allow(['overview', 'notifications']) ? db.notifications : [],
      emailLogs: allow(['overview', 'notifications']) ? db.emailLogs : [],
      tutorials: db.tutorials,
      tickets: allow(['overview', 'live', 'support']) ? db.tickets : [],
      adminAlerts: db.adminAlerts,
      promoCodes: db.promoCodes,
      auditLogs: allow(['overview', 'audit']) ? db.auditLogs : [],
      accountingRecords: allow(['overview', 'revenue', 'accounting'])
        ? db.accountingRecords || []
        : [],
      visitorStats: db.visitorStats || { totalVisits: 0, recentSessions: [] },
    });
  });

  // --- LIVE MONITOR FEED ---
  app.get('/api/admin/live', requireAuth, requireAdminScope('overview', 'live'), (_req, res) => {
    expireTimedOutSmsOrders();
    const db = store.db;
    const nowMs = Date.now();
    const recentSessions = (db.visitorStats?.recentSessions || []).slice(0, 30);
    const activeVisitors5m = recentSessions.filter(
      (s) => nowMs - new Date(s.visitedAt).getTime() <= 5 * 60 * 1000,
    ).length;
    res.json({
      serverTime: new Date(nowMs).toISOString(),
      totalVisits: db.visitorStats?.totalVisits || 0,
      activeVisitors5m,
      recentSessions,
      waitingSms: db.smsOrders.filter((o) => !o.adminCleared && o.status === 'waiting').slice(0, 25),
      activeBoosting: db.boostingOrders
        .filter(
          (o) =>
            !o.adminCleared &&
            (o.status === 'pending' || o.status === 'processing' || o.status === 'refilling'),
        )
        .slice(0, 25),
      pendingDeposits: db.transactions
        .filter((t) => !t.adminCleared && t.type === 'deposit' && t.status === 'pending')
        .slice(0, 25),
      openTickets: db.tickets
        .filter((t) => t.status === 'open' || t.status === 'in_progress')
        .slice(0, 20),
      recentUsers: [...db.users]
        .sort(
          (a, b) =>
            new Date(b.lastLoginAt || b.createdAt).getTime() -
            new Date(a.lastLoginAt || a.createdAt).getTime(),
        )
        .slice(0, 15)
        .map(toPublicUser),
      recentAlerts: db.adminAlerts.slice(0, 25),
    });
  });

  // --- MAIN ADMIN IDENTITY & SINGLE-FEATURE SUB-ADMIN MANAGEMENT ---
  app.post('/api/admin/main-admin/change-email', requireAuth, requireMainAdmin, (req: AuthedRequest, res) => {
    const mainAdmin = req.currentUser!;
    const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || '');
    if (!verifyPassword(currentPassword, mainAdmin.passwordHash)) {
      res.status(400).json({ error: 'Current password verification failed' });
      return;
    }
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }
    const conflict = store.db.users.some(
      (u) => u.id !== mainAdmin.id && u.email.toLowerCase() === newEmail,
    );
    if (conflict) {
      res.status(409).json({ error: 'Another account already uses this email address' });
      return;
    }
    const oldEmail = mainAdmin.email;
    mainAdmin.email = newEmail;
    mainAdmin.isMainAdmin = true;
    mainAdmin.allowedAdminTab = undefined;
    store.db.settings.mainAdminEmail = newEmail;
    store.logAudit(
      newEmail,
      'MAIN_ADMIN_EMAIL_CHANGE',
      oldEmail,
      `Main Admin email updated from ${oldEmail} to ${newEmail}`,
    );
    store.save();
    res.json({ user: toPublicUser(mainAdmin), settings: store.db.settings });
  });

  app.get('/api/admin/sub-admins', requireAuth, requireMainAdmin, (_req, res) => {
    const mainAdmin = store.db.users.find((u) => isMainAdminUser(u));
    const subAdmins = store.db.users
      .filter((u) => u.role === 'admin' && !isMainAdminUser(u))
      .map(toPublicUser);
    res.json({
      mainAdmin: mainAdmin ? toPublicUser(mainAdmin) : null,
      subAdmins,
      delegatableTabs: DELEGATABLE_ADMIN_TABS,
    });
  });

  app.post('/api/admin/sub-admins', requireAuth, requireMainAdmin, (req: AuthedRequest, res) => {
    const allowedAdminTab = String(req.body?.allowedAdminTab || '') as AdminFeatureTab;
    if (!DELEGATABLE_ADMIN_TABS.includes(allowedAdminTab)) {
      res.status(400).json({ error: 'Select one valid single admin feature to delegate' });
      return;
    }
    const userId = String(req.body?.userId || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');

    let target: StoredUser | undefined;
    if (userId) {
      target = store.db.users.find((u) => u.id === userId);
      if (!target) {
        res.status(404).json({ error: 'Selected user not found' });
        return;
      }
    } else if (email) {
      target = store.db.users.find((u) => u.email.toLowerCase() === email);
      if (!target) {
        if (!name || name.length < 2 || password.length < 6) {
          res.status(400).json({ error: 'Name (min 2 chars) and password (min 6 chars) are required for a new sub-admin' });
          return;
        }
        target = {
          id: makeId('usr'),
          name,
          email,
          passwordHash: hashPassword(password),
          role: 'admin',
          isMainAdmin: false,
          allowedAdminTab,
          authProvider: 'email',
          emailVerified: true,
          balance: 0,
          status: 'active',
          referralCode: `SD${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          createdAt: new Date().toISOString(),
        };
        store.db.users.push(target);
      }
    } else {
      res.status(400).json({ error: 'Provide an existing user or email to assign a sub-admin' });
      return;
    }

    if (isMainAdminUser(target)) {
      res.status(400).json({ error: 'Cannot restrict or modify the protected Main Admin account' });
      return;
    }

    target.role = 'admin';
    target.isMainAdmin = false;
    target.status = 'active';
    target.allowedAdminTab = allowedAdminTab;

    store.logAudit(
      req.currentUser!.email,
      'DELEGATE_SUB_ADMIN',
      target.email,
      `Assigned single admin feature: ${allowedAdminTab}`,
    );
    store.save();
    res.json({ user: toPublicUser(target) });
  });

  app.delete('/api/admin/sub-admins/:id', requireAuth, requireMainAdmin, (req: AuthedRequest, res) => {
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Sub-admin not found' });
      return;
    }
    if (isMainAdminUser(target)) {
      res.status(403).json({ error: 'Main Admin is permanently protected and cannot be revoked' });
      return;
    }
    target.role = 'user';
    target.isMainAdmin = false;
    target.allowedAdminTab = undefined;
    store.logAudit(req.currentUser!.email, 'REVOKE_SUB_ADMIN', target.email, 'Reverted sub-admin back to standard user');
    store.save();
    res.json({ ok: true });
  });

  // --- IMMUTABLE ACCOUNTING LEDGER CONTROLS ---
  app.delete('/api/admin/accounting/:id', requireAuth, requireAdminScope('accounting'), (req: AuthedRequest, res) => {
    const before = (store.db.accountingRecords || []).length;
    const target = (store.db.accountingRecords || []).find((r) => r.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Accounting record not found' });
      return;
    }
    store.db.accountingRecords = store.db.accountingRecords.filter((r) => r.id !== req.params.id);
    store.logAudit(
      req.currentUser!.email,
      'DELETE_ACCOUNTING_RECORD',
      target.sourceId,
      `Deleted accounting entry ${target.title} (${before} -> ${store.db.accountingRecords.length})`,
    );
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/accounting/clear', requireAuth, requireAdminScope('accounting'), (req: AuthedRequest, res) => {
    const scope = String(req.body?.scope || 'all');
    const current = store.db.accountingRecords || [];
    let removed = 0;
    if (scope === 'order' || scope === 'transaction') {
      store.db.accountingRecords = current.filter((r) => {
        if (r.kind === scope) {
          removed += 1;
          return false;
        }
        return true;
      });
    } else {
      removed = current.length;
      store.db.accountingRecords = [];
    }
    store.logAudit(
      req.currentUser!.email,
      'CLEAR_ACCOUNTING_ARCHIVE',
      scope,
      `Cleared ${removed} immutable accounting record(s) from Accounting Console`,
    );
    store.save();
    res.json({ ok: true, removed });
  });

  // --- SOFT REFRESH WEBSITE (OPERATIONAL RESET PRESERVING USERS, BALANCES, SETTINGS, CATALOG & ACCOUNTING) ---
  app.post('/api/admin/system/refresh-ops', requireAuth, requireAdminScope('overview', 'settings'), (req: AuthedRequest, res) => {
    const db = store.db;
    const counts = {
      smsOrders: db.smsOrders.length,
      boostingOrders: db.boostingOrders.length,
      vaultItems: db.vaultItems.length,
      transactions: db.transactions.length,
    };
    db.smsOrders = [];
    db.boostingOrders = [];
    db.vaultItems = [];
    db.transactions = [];
    db.pendingSignups = [];
    db.smsPool.forEach((p) => {
      p.used = false;
      p.assignedOrderId = undefined;
    });
    store.logAudit(
      req.currentUser!.email,
      'REFRESH_WEBSITE_OPS',
      'System Reset',
      `Refreshed live queues (cleared ${counts.transactions} tx, ${counts.smsOrders} sms, ${counts.boostingOrders} boost, ${counts.vaultItems} vault); preserved all users, wallet balances, website settings/logo, products & accounting archive`,
    );
    store.save();
    res.json({
      ok: true,
      cleared: counts,
      preserved: {
        users: db.users.length,
        accountingRecords: (db.accountingRecords || []).length,
        marketplaceListings: db.marketplaceListings.length,
      },
    });
  });

  app.post('/api/admin/tools/sweep-expired-sms', requireAuth, requireAdminScope('overview', 'power_suite', 'orders', 'live', 'sms_numbers'), (req: AuthedRequest, res) => {
    const refundedCount = expireTimedOutSmsOrders();
    if (refundedCount > 0) {
      store.logAudit(
        req.currentUser!.email,
        'SWEEP_EXPIRED_SMS',
        `${refundedCount} SMS order(s)`,
        `Swept and auto-refunded ${refundedCount} timed-out SMS order(s)`,
      );
      store.save();
    }
    res.json({ ok: true, refundedCount });
  });

  app.post('/api/admin/tools/bulk-price-adjust', requireAuth, requireAdminScope('power_suite', 'catalog', 'overview'), (req: AuthedRequest, res) => {
    const target = String(req.body?.target || 'marketplace');
    const percent = Number(req.body?.percent || 0);
    if (!['marketplace', 'sms', 'boosting'].includes(target)) {
      res.status(400).json({ error: 'Invalid catalog target' });
      return;
    }
    if (!Number.isFinite(percent) || percent < -50 || percent > 200 || percent === 0) {
      res.status(400).json({ error: 'Percentage must be between -50 and +200 (non-zero)' });
      return;
    }
    const factor = 1 + percent / 100;
    let updatedCount = 0;
    if (target === 'marketplace') {
      store.db.marketplaceListings.forEach((item) => {
        item.price = Math.max(50, Math.round(item.price * factor));
        updatedCount += 1;
      });
    } else if (target === 'sms') {
      store.db.smsServices.forEach((svc) => {
        svc.basePrice = Math.max(50, Math.round(svc.basePrice * factor));
        updatedCount += 1;
      });
    } else if (target === 'boosting') {
      store.db.boostingServices.forEach((svc) => {
        svc.ratePer1k = Math.max(50, Math.round(svc.ratePer1k * factor));
        updatedCount += 1;
      });
    }
    store.logAudit(
      req.currentUser!.email,
      'BULK_PRICE_ADJUST',
      target,
      `Adjusted ${updatedCount} ${target} prices by ${percent > 0 ? `+${percent}` : percent}%`,
    );
    store.save();
    res.json({ ok: true, target, percent, updatedCount });
  });

  app.post('/api/admin/tools/bulk-restock', requireAuth, requireAdminScope('power_suite', 'catalog', 'sms_numbers', 'overview'), (req: AuthedRequest, res) => {
    const target = String(req.body?.target || 'marketplace');
    const mode = req.body?.mode === 'floor' ? 'floor' : 'add';
    const amount = Math.round(Number(req.body?.amount || 0));
    if (!['marketplace', 'sms'].includes(target)) {
      res.status(400).json({ error: 'Invalid restock target' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) {
      res.status(400).json({ error: 'Restock quantity must be between 1 and 100,000' });
      return;
    }
    let updatedCount = 0;
    if (target === 'marketplace') {
      store.db.marketplaceListings.forEach((item) => {
        item.stock = mode === 'floor' ? Math.max(item.stock, amount) : item.stock + amount;
        updatedCount += 1;
      });
    } else {
      store.db.smsServices.forEach((svc) => {
        svc.stock = mode === 'floor' ? Math.max(svc.stock, amount) : svc.stock + amount;
        updatedCount += 1;
      });
    }
    store.logAudit(
      req.currentUser!.email,
      'BULK_RESTOCK',
      target,
      `${mode === 'floor' ? 'Minimum stock floor' : 'Added'} ${amount} across ${updatedCount} items`,
    );
    store.save();
    res.json({ ok: true, target, mode, amount, updatedCount });
  });

  app.post('/api/admin/tools/toggle-popular', requireAuth, requireAdminScope('power_suite', 'catalog', 'overview'), (req: AuthedRequest, res) => {
    const popular =
      typeof req.body?.mode === 'string'
        ? req.body.mode === 'apply'
        : Boolean(req.body?.popular);
    const category = String(req.body?.category || '').trim();
    const customPopularTag = String(req.body?.popularTag || '').trim().slice(0, 48);
    let updatedCount = 0;
    store.db.marketplaceListings.forEach((item) => {
      if (!category || category === 'All' || item.category === category) {
        if (popular) {
          item.popularTag = customPopularTag || item.popularTag?.trim() || item.category || 'Popular';
        } else {
          item.popularTag = '';
        }
        updatedCount += 1;
      }
    });
    store.logAudit(
      req.currentUser!.email,
      'TOGGLE_POPULAR_TAGS',
      category || 'All Categories',
      `${popular ? `Enabled "${customPopularTag || 'Popular'}"` : 'Cleared'} Popular tag on ${updatedCount} products`,
    );
    store.save();
    res.json({ ok: true, popular, popularTag: customPopularTag, updatedCount });
  });

  app.post('/api/admin/tools/verify-pending-users', requireAuth, requireAdminScope('power_suite', 'users', 'overview'), (req: AuthedRequest, res) => {
    let verifiedUsers = 0;
    store.db.users.forEach((u) => {
      if (u.emailVerified === false) {
        u.emailVerified = true;
        verifiedUsers += 1;
      }
    });
    const clearedPending = (store.db.pendingSignups || []).length;
    store.db.pendingSignups = [];
    store.logAudit(
      req.currentUser!.email,
      'VERIFY_ALL_USERS',
      `${verifiedUsers} users`,
      `Verified ${verifiedUsers} accounts and cleared ${clearedPending} stale signup OTPs`,
    );
    store.save();
    res.json({ ok: true, verifiedUsers, verifiedCount: verifiedUsers, clearedPending });
  });

  app.post('/api/admin/tools/bulk-credit-users', requireAuth, requireAdminScope('power_suite', 'users', 'overview'), (req: AuthedRequest, res) => {
    const segment = String(req.body?.segment || 'all');
    const mode = req.body?.mode === 'debit' ? 'debit' : 'credit';
    const amount = Math.round(Number(req.body?.amount || 0));
    const note = String(req.body?.note || '').trim().slice(0, 140) || `Bulk ${mode} by Overwatch`;
    if (!['all', 'verified', 'zero_balance', 'active_only'].includes(segment)) {
      res.status(400).json({ error: 'Invalid user segment selected' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) {
      res.status(400).json({ error: 'Amount must be between 1 and 10,000,000' });
      return;
    }

    const targets = store.db.users.filter((u) => {
      if (u.role === 'admin' || isMainAdminUser(u)) return false;
      if (segment === 'verified') return u.emailVerified !== false;
      if (segment === 'zero_balance') return u.balance <= 0;
      if (segment === 'active_only') return u.status === 'active';
      return true;
    });

    const now = new Date().toISOString();
    let affectedCount = 0;
    let totalAmount = 0;
    for (const u of targets) {
      const delta = mode === 'credit' ? amount : Math.min(u.balance, amount);
      if (mode === 'debit' && delta <= 0) continue;
      u.balance = mode === 'credit' ? u.balance + delta : Math.max(0, u.balance - delta);
      affectedCount += 1;
      totalAmount += delta;
      const txId = makeId('tx');
      const txType = mode === 'credit' ? 'admin_credit' : 'admin_debit';
      store.db.transactions.unshift({
        id: txId,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        type: txType,
        amount: delta,
        status: 'completed',
        description: note,
        adminNote: note,
        createdAt: now,
      });
      store.recordAccountingEntry({
        kind: 'transaction',
        sourceId: txId,
        category: txType,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        title: mode === 'credit' ? 'BULK ADMIN CREDIT' : 'BULK ADMIN DEBIT',
        detail: `${note} [${segment}]`,
        amount: delta,
        status: 'completed',
        createdAt: now,
      });
      store.db.notifications.unshift({
        id: makeId('ntf'),
        title: mode === 'credit' ? 'Wallet Credited' : 'Wallet Adjusted',
        message: `${mode === 'credit' ? 'Added' : 'Deducted'} ${store.db.settings.currencySymbol}${delta.toLocaleString()} — ${note}`,
        type: mode === 'credit' ? 'success' : 'info',
        targetUserId: u.id,
        readBy: [],
        createdAt: now,
      });
    }

    store.logAudit(
      req.currentUser!.email,
      'BULK_WALLET_ADJUST',
      `${affectedCount} users (${segment})`,
      `${mode === 'credit' ? 'Credited' : 'Debited'} ${store.db.settings.currencySymbol}${amount.toLocaleString()} across ${affectedCount} accounts (Total ${store.db.settings.currencySymbol}${totalAmount.toLocaleString()})`,
    );
    store.save();
    res.json({ ok: true, segment, mode, amount, affectedCount, totalAmount });
  });

  app.post('/api/admin/tools/bulk-process-orders', requireAuth, requireAdminScope('power_suite', 'orders', 'overview'), (req: AuthedRequest, res) => {
    const action = String(req.body?.action || '');
    if (action !== 'complete_boosting' && action !== 'cancel_refund_boosting') {
      res.status(400).json({ error: 'Invalid bulk order action' });
      return;
    }

    const now = new Date().toISOString();
    let updatedCount = 0;
    let refundedAmount = 0;

    for (const order of store.db.boostingOrders) {
      if (order.status !== 'pending' && order.status !== 'processing' && order.status !== 'refilling') {
        continue;
      }
      if (action === 'complete_boosting') {
        order.status = 'completed';
        order.remains = 0;
        order.updatedAt = now;
        store.syncAccountingStatus(order.id, 'completed');
        updatedCount += 1;
      } else {
        order.status = 'cancelled';
        order.updatedAt = now;
        store.syncAccountingStatus(order.id, 'cancelled');
        const user = store.db.users.find((u) => u.id === order.userId);
        if (user && order.amount > 0) {
          user.balance += order.amount;
          refundedAmount += order.amount;
          const refTxId = makeId('tx');
          store.db.transactions.unshift({
            id: refTxId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            type: 'refund',
            amount: order.amount,
            status: 'completed',
            description: `Bulk refund for cancelled boost order ${order.id}`,
            createdAt: now,
          });
          store.recordAccountingEntry({
            kind: 'transaction',
            sourceId: refTxId,
            category: 'refund',
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            title: 'BULK BOOST REFUND',
            detail: `Bulk refund for cancelled boost order ${order.id}`,
            amount: order.amount,
            status: 'completed',
            createdAt: now,
          });
        }
        updatedCount += 1;
      }
    }

    store.logAudit(
      req.currentUser!.email,
      'BULK_PROCESS_ORDERS',
      `${updatedCount} boosting orders`,
      action === 'complete_boosting'
        ? `Marked ${updatedCount} active boosting orders completed`
        : `Cancelled & refunded ${updatedCount} boosting orders (${store.db.settings.currencySymbol}${refundedAmount.toLocaleString()})`,
    );
    store.save();
    res.json({ ok: true, action, updatedCount, refundedAmount });
  });

  app.post('/api/admin/tools/force-logout-all', requireAuth, requireAdminScope('power_suite', 'users', 'overview', 'settings'), (req: AuthedRequest, res) => {
    const nextEpoch = Math.max(1, Math.floor(Number(store.db.settings.authSessionEpoch ?? 1))) + 1;
    store.db.settings.authSessionEpoch = nextEpoch;
    store.logAudit(
      req.currentUser!.email,
      'FORCE_LOGOUT_ALL',
      `Epoch v${nextEpoch}`,
      `Invalidated all non-main-admin active sessions (epoch ${nextEpoch})`,
    );
    store.save();
    res.json({ ok: true, authSessionEpoch: nextEpoch });
  });

  app.post('/api/admin/tools/targeted-broadcast', requireAuth, requireAdminScope('power_suite', 'notifications', 'overview'), async (req: AuthedRequest, res) => {
    const segment = String(req.body?.segment || 'all');
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 1500);
    const type =
      req.body?.type === 'success' || req.body?.type === 'warning' ? req.body.type : 'info';
    const sendEmail = Boolean(req.body?.sendEmail);

    if (!['all', 'verified', 'unfunded', 'spenders'].includes(segment)) {
      res.status(400).json({ error: 'Invalid broadcast segment' });
      return;
    }
    if (!title || !message) {
      res.status(400).json({ error: 'Campaign title and message are required' });
      return;
    }

    const spenderIds = new Set(
      store.db.transactions.filter((t) => t.type === 'purchase').map((t) => t.userId),
    );

    const targets = store.db.users.filter((u) => {
      if (u.role === 'admin' || isMainAdminUser(u) || u.status !== 'active') return false;
      if (segment === 'verified') return u.emailVerified !== false;
      if (segment === 'unfunded') return u.balance <= 0;
      if (segment === 'spenders') return spenderIds.has(u.id);
      return true;
    });

    const now = new Date().toISOString();
    let sentEmails = 0;
    const safeTitleHtml = escapeHtml(title);
    const safeMessageHtml = escapeHtml(message);

    for (const u of targets) {
      store.db.notifications.unshift({
        id: makeId('ntf'),
        title,
        message,
        type,
        targetUserId: u.id,
        readBy: [],
        createdAt: now,
      });

      if (sendEmail && u.email) {
        store.db.emailLogs.unshift({
          id: makeId('eml'),
          to: u.email,
          subject: title,
          body: message,
          sentBy: req.currentUser!.email,
          createdAt: now,
        });
        const mailRes = await sendTransactionalEmail({
          to: u.email,
          subject: title,
          text: message,
          html: `<div style="font-family:sans-serif;padding:24px;color:#0F172A;"><h2 style="margin:0 0 12px;">${safeTitleHtml}</h2><p style="white-space:pre-line;line-height:1.6;">${safeMessageHtml}</p></div>`,
          settings: store.db.settings,
        });
        if (mailRes.delivered) sentEmails += 1;
      }
    }

    store.logAudit(
      req.currentUser!.email,
      'TARGETED_BROADCAST',
      `${targets.length} users (${segment})`,
      `Sent "${title}" to ${targets.length} accounts (${sentEmails} emails delivered)`,
    );
    store.save();
    res.json({ ok: true, segment, recipientCount: targets.length, sentEmails });
  });

  app.post('/api/admin/tools/import-backup', requireAuth, requireMainAdmin, (req: AuthedRequest, res) => {
    const rawBackup = req.body?.backup;
    if (!rawBackup || typeof rawBackup !== 'object' || Array.isArray(rawBackup)) {
      res.status(400).json({ error: 'Invalid backup JSON object' });
      return;
    }
    const backup = rawBackup as Record<string, unknown>;
    const restoredParts: string[] = [];

    if (backup.settings && typeof backup.settings === 'object' && !Array.isArray(backup.settings)) {
      const preservedMainEmail = store.db.settings.mainAdminEmail;
      const preservedEpoch = store.db.settings.authSessionEpoch ?? 1;
      const incomingSettings = backup.settings as Record<string, unknown>;
      const merged = { ...store.db.settings };
      for (const [k, v] of Object.entries(incomingSettings)) {
        if (k === 'mainAdminEmail' || k === 'authSessionEpoch') continue;
        if (v !== undefined) {
          (merged as Record<string, unknown>)[k] = v;
        }
      }
      merged.mainAdminEmail = preservedMainEmail;
      merged.authSessionEpoch = preservedEpoch;
      store.db.settings = merged;
      restoredParts.push('settings');
    }

    if (Array.isArray(backup.marketplaceCategories)) {
      store.db.marketplaceCategories = backup.marketplaceCategories as typeof store.db.marketplaceCategories;
      restoredParts.push('marketplaceCategories');
    }
    if (Array.isArray(backup.marketplaceListings)) {
      store.db.marketplaceListings = backup.marketplaceListings as typeof store.db.marketplaceListings;
      restoredParts.push('marketplaceListings');
    }
    if (Array.isArray(backup.smsCountries)) {
      store.db.smsCountries = backup.smsCountries as typeof store.db.smsCountries;
      restoredParts.push('smsCountries');
    }
    if (Array.isArray(backup.smsServices)) {
      store.db.smsServices = backup.smsServices as typeof store.db.smsServices;
      restoredParts.push('smsServices');
    }
    if (Array.isArray(backup.boostingServices)) {
      store.db.boostingServices = backup.boostingServices as typeof store.db.boostingServices;
      restoredParts.push('boostingServices');
    }
    if (Array.isArray(backup.customSections)) {
      store.db.customSections = backup.customSections as typeof store.db.customSections;
      restoredParts.push('customSections');
    }
    if (Array.isArray(backup.promoCodes)) {
      store.db.promoCodes = backup.promoCodes as typeof store.db.promoCodes;
      restoredParts.push('promoCodes');
    }
    if (Array.isArray(backup.tutorials)) {
      store.db.tutorials = backup.tutorials as typeof store.db.tutorials;
      restoredParts.push('tutorials');
    }

    if (restoredParts.length === 0) {
      res.status(400).json({ error: 'Backup contained no recognized store sections to restore' });
      return;
    }

    store.logAudit(
      req.currentUser!.email,
      'IMPORT_BACKUP',
      `${restoredParts.length} section(s)`,
      `Restored store configuration & catalog (${restoredParts.join(', ')}) while preserving user accounts & balances`,
    );
    store.save();
    res.json({ ok: true, restoredParts });
  });

  app.post('/api/admin/alerts/read-all', requireAuth, requireAdmin, (_req, res) => {
    store.db.adminAlerts.forEach((a) => {
      a.read = true;
    });
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/alerts', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const count = store.db.adminAlerts.length;
    store.db.adminAlerts = [];
    store.logAudit(req.currentUser!.email, 'CLEAR_ALERTS', 'adminAlerts', `Cleared ${count} alerts`);
    store.save();
    res.json({ ok: true, cleared: count });
  });

  // --- ADMIN DIRECT LANDING VIDEO FILE UPLOAD ---
  app.post('/api/admin/upload-video', requireAuth, requireAdminScope('cms', 'settings'), (req: AuthedRequest, res) => {
    const dataUrl = String(req.body?.videoDataUrl || '');
    const fileName = String(req.body?.fileName || 'video.mp4');
    const match = dataUrl.match(/^data:(video\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Invalid video file format. Please upload MP4, WebM, or MOV.' });
      return;
    }

    const mime = match[1];
    const ext = mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : 'mp4';
    const safeName = `landing_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const targetPath = path.join(UPLOADS_DIR, safeName);
    const buffer = Buffer.from(match[2], 'base64');
    fs.writeFileSync(targetPath, buffer);

    const publicUrl = `/uploads/${safeName}`;
    store.db.settings.landingVideoUrl = publicUrl;
    store.logAudit(req.currentUser!.email, 'VIDEO_UPLOAD', fileName, `Uploaded landing video ${publicUrl}`);
    store.save();
    res.json({ url: publicUrl, settings: store.db.settings });
  });

  // --- ADMIN USERS & BALANCES ---
  app.post('/api/admin/users', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || 'SureDeal123!');
    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    if (role === 'admin' && !isMainAdminUser(req.currentUser!)) {
      res.status(403).json({ error: 'Only Main Admin can create administrator accounts' });
      return;
    }
    const balance = Math.max(0, Number(req.body?.balance || 0));

    if (!name || !email.includes('@')) {
      res.status(400).json({ error: 'Valid name and email are required' });
      return;
    }
    if (store.db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const newUser: StoredUser = {
      id: makeId('usr'),
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      isMainAdmin: false,
      allowedAdminTab: role === 'admin' ? 'overview' : undefined,
      emailVerified: true,
      balance,
      status: 'active',
      referralCode: `SD${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    store.db.users.push(newUser);
    store.logAudit(req.currentUser!.email, 'CREATE_USER', newUser.email, `Role: ${role}, Initial Bal: ${balance}`);
    store.save();
    res.status(201).json({ user: toPublicUser(newUser) });
  });

  app.post('/api/admin/users/:id/balance', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (isMainAdminUser(target) && !isMainAdminUser(req.currentUser!)) {
      res.status(403).json({ error: 'Main Admin account is permanently protected and cannot be modified' });
      return;
    }
    const mode = String(req.body?.mode || 'credit');
    const amount = Number(req.body?.amount || 0);
    const note = String(req.body?.note || 'Team balance adjustment').trim();

    if (!Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ error: 'Amount must be a non-negative number' });
      return;
    }

    let delta = 0;
    let txType: 'admin_credit' | 'admin_debit' = 'admin_credit';
    if (mode === 'set') {
      delta = amount - target.balance;
      txType = delta >= 0 ? 'admin_credit' : 'admin_debit';
      target.balance = amount;
    } else if (mode === 'debit') {
      delta = Math.min(target.balance, amount);
      target.balance = Math.max(0, target.balance - amount);
      txType = 'admin_debit';
    } else {
      delta = amount;
      target.balance += amount;
      txType = 'admin_credit';
    }

    const balNow = new Date().toISOString();
    const balTxId = makeId('tx');
    store.db.transactions.unshift({
      id: balTxId,
      userId: target.id,
      userName: target.name,
      userEmail: target.email,
      type: txType,
      amount: Math.abs(delta),
      status: 'completed',
      description: note,
      createdAt: balNow,
    });
    store.recordAccountingEntry({
      kind: 'transaction',
      sourceId: balTxId,
      category: txType,
      userId: target.id,
      userName: target.name,
      userEmail: target.email,
      title: txType === 'admin_debit' ? 'ADMIN DEBIT' : 'ADMIN CREDIT',
      detail: note,
      amount: Math.abs(delta),
      status: 'completed',
      createdAt: balNow,
    });
    store.logAudit(req.currentUser!.email, `BALANCE_${mode.toUpperCase()}`, target.email, `${note} (${amount})`);
    store.save();
    res.json({ user: toPublicUser(target) });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const targetIsMain = isMainAdminUser(target);
    const callerIsMain = isMainAdminUser(req.currentUser!);
    if (targetIsMain && !callerIsMain) {
      res.status(403).json({ error: 'Main Admin account is permanently protected and cannot be modified' });
      return;
    }
    if (!callerIsMain && (target.role === 'admin' || req.body?.role === 'admin')) {
      res.status(403).json({ error: 'Only Main Admin can modify administrator roles' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      target.name = req.body.name.trim();
    }
    if (typeof req.body?.email === 'string' && req.body.email.includes('@') && !targetIsMain) {
      target.email = req.body.email.trim().toLowerCase();
    }
    const isTargetAdmin = target.role === 'admin' || targetIsMain;
    if (targetIsMain && req.body?.role === 'user') {
      res.status(400).json({ error: 'Cannot remove admin role from the Main Admin account' });
      return;
    }
    if (isTargetAdmin && req.body?.status === 'suspended') {
      res.status(400).json({ error: 'Admin accounts cannot be suspended' });
      return;
    }
    if (req.body?.role === 'admin' || req.body?.role === 'user') {
      target.role = req.body.role;
      if (target.role === 'admin') {
        target.status = 'active';
      } else {
        target.allowedAdminTab = undefined;
      }
    }
    if (req.body?.status === 'active' || req.body?.status === 'suspended') {
      target.status = req.body.status;
      store.logAudit(
        req.currentUser!.email,
        req.body.status === 'suspended' ? 'SUSPEND_USER' : 'RESTORE_USER',
        target.email,
        `Account set to ${req.body.status}`,
      );
    }
    if (typeof req.body?.referralCode === 'string' && req.body.referralCode.trim()) {
      const cleanCode = req.body.referralCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (cleanCode.length >= 3) {
        const conflict = store.db.users.some(
          (u) => u.id !== target.id && u.referralCode.toUpperCase() === cleanCode,
        );
        if (conflict) {
          res.status(409).json({ error: 'Referral code already belongs to another user' });
          return;
        }
        target.referralCode = cleanCode;
      }
    }
    if (typeof req.body?.avatarUrl === 'string') {
      const av = req.body.avatarUrl.trim();
      if (!av) {
        target.avatarUrl = undefined;
      } else if (
        (av.startsWith('data:image/') || av.startsWith('https://') || av.startsWith('http://')) &&
        av.length <= 2_500_000
      ) {
        target.avatarUrl = av;
      }
    }
    if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
      target.passwordHash = hashPassword(req.body.newPassword);
      store.logAudit(req.currentUser!.email, 'RESET_PASSWORD', target.email, 'Password updated by Admin');
    }
    store.save();
    res.json({ user: toPublicUser(target) });
  });

  app.delete('/api/admin/users/:id', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.id === req.currentUser!.id || isMainAdminUser(target)) {
      res.status(403).json({ error: 'Cannot permanently delete the Main Admin account' });
      return;
    }
    if (target.role === 'admin' && !isMainAdminUser(req.currentUser!)) {
      res.status(403).json({ error: 'Only Main Admin can delete administrator accounts' });
      return;
    }
    const targetEmail = target.email.toLowerCase();
    store.db.users = store.db.users.filter(
      (u) => u.id !== target.id && u.email.toLowerCase() !== targetEmail,
    );
    store.db.users.forEach((u) => {
      if (u.referredBy === target.id) {
        u.referredBy = undefined;
      }
    });
    store.db.vaultItems = store.db.vaultItems.filter((v) => v.userId !== target.id);
    store.db.smsOrders = store.db.smsOrders.filter((s) => s.userId !== target.id);
    store.db.boostingOrders = store.db.boostingOrders.filter((b) => b.userId !== target.id);
    store.db.transactions = store.db.transactions.filter((t) => t.userId !== target.id);
    store.db.tickets = store.db.tickets.filter((t) => t.userId !== target.id);
    store.db.notifications = store.db.notifications.filter((n) => n.targetUserId !== target.id);
    store.logAudit(req.currentUser!.email, 'DELETE_USER_PERMANENT', target.email, 'Permanently deleted user & all records');
    store.save();
    res.json({ ok: true });
  });

  // --- FULL USER ACCOUNT 360 ACTIVITY, LIVE IMPERSONATION & BULK ACTIONS ---
  app.get('/api/admin/users/:id/full-activity', requireAuth, requireAdminScope('users', 'overview', 'live', 'accounting'), (req, res) => {
    expireTimedOutSmsOrders();
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const db = store.db;
    const transactions = db.transactions.filter((t) => t.userId === target.id);
    const smsOrders = db.smsOrders.filter((s) => s.userId === target.id);
    const boostingOrders = db.boostingOrders.filter((b) => b.userId === target.id);
    const vaultItems = db.vaultItems.filter((v) => v.userId === target.id);
    const tickets = db.tickets.filter((t) => t.userId === target.id);
    const notifications = db.notifications.filter(
      (n) => n.targetUserId === target.id || n.targetUserId === 'all',
    );
    const referrals = db.users.filter((u) => u.referredBy === target.id).map(toPublicUser);
    const accountingRecords = (db.accountingRecords || []).filter((r) => r.userId === target.id);
    const targetEmailLower = target.email.toLowerCase();
    const auditLogs = db.auditLogs.filter(
      (a) =>
        a.target.toLowerCase() === targetEmailLower ||
        a.actorEmail.toLowerCase() === targetEmailLower ||
        a.detail.toLowerCase().includes(targetEmailLower),
    );

    const totalDeposits = transactions
      .filter((t) => t.type === 'deposit' && t.status === 'verified')
      .reduce((s, t) => s + t.amount, 0);
    const totalPurchases = transactions
      .filter((t) => t.type === 'purchase' && t.status === 'completed')
      .reduce((s, t) => s + t.amount, 0);
    const totalRefunds = transactions
      .filter((t) => t.type === 'refund')
      .reduce((s, t) => s + t.amount, 0);
    const totalAdminCredits = transactions
      .filter((t) => t.type === 'admin_credit' || t.type === 'welcome_bonus' || t.type === 'referral_bonus')
      .reduce((s, t) => s + t.amount, 0);
    const clearedRecordsCount =
      transactions.filter((t) => t.adminCleared).length +
      smsOrders.filter((s) => s.adminCleared).length +
      boostingOrders.filter((b) => b.adminCleared).length +
      vaultItems.filter((v) => v.adminCleared).length;

    res.json({
      user: toPublicUser(target),
      stats: {
        totalDeposits,
        totalPurchases,
        totalRefunds,
        totalAdminCredits,
        smsCount: smsOrders.length,
        boostingCount: boostingOrders.length,
        vaultCount: vaultItems.length,
        ticketsCount: tickets.length,
        referralsCount: referrals.length,
        clearedRecordsCount,
      },
      transactions,
      smsOrders,
      boostingOrders,
      vaultItems,
      tickets,
      notifications,
      referrals,
      accountingRecords,
      auditLogs,
    });
  });

  app.post('/api/admin/users/:id/impersonate', requireAuth, requireAdminScope('users', 'overview'), (req: AuthedRequest, res) => {
    const target = store.db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const callerIsMain = isMainAdminUser(req.currentUser!);
    if (isMainAdminUser(target) && !callerIsMain) {
      res.status(403).json({ error: 'Main Admin account is permanently protected and cannot be impersonated' });
      return;
    }
    if (!callerIsMain && target.role === 'admin' && target.id !== req.currentUser!.id) {
      res.status(403).json({ error: 'Only Main Admin can open another administrator account' });
      return;
    }
    store.logAudit(
      req.currentUser!.email,
      'IMPERSONATE_USER',
      target.email,
      `Opened live user account session from Overwatch (${target.id})`,
    );
    store.save();
    res.json({
      token: signToken(target.id),
      user: toPublicUser(target),
    });
  });

  app.post('/api/admin/users/bulk-action', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const userIds = Array.isArray(req.body?.userIds)
      ? Array.from(new Set(req.body.userIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)))
      : [];
    const action = String(req.body?.action || '');
    if (userIds.length === 0) {
      res.status(400).json({ error: 'Select at least one user account' });
      return;
    }
    if (!['credit', 'debit', 'suspend', 'activate', 'notify'].includes(action)) {
      res.status(400).json({ error: 'Invalid bulk user action' });
      return;
    }
    const amount = Number(req.body?.amount || 0);
    if ((action === 'credit' || action === 'debit') && (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000)) {
      res.status(400).json({ error: 'Enter a valid amount between 1 and 10,000,000' });
      return;
    }
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const note = String(req.body?.note || '').trim();
    if (action === 'notify' && !title && !message) {
      res.status(400).json({ error: 'Notification title or message is required' });
      return;
    }

    const callerIsMain = isMainAdminUser(req.currentUser!);
    const now = new Date().toISOString();
    let affectedCount = 0;
    let skippedCount = 0;

    for (const id of userIds) {
      const target = store.db.users.find((u) => u.id === id);
      if (!target) {
        skippedCount += 1;
        continue;
      }
      const targetIsMain = isMainAdminUser(target);
      if (targetIsMain && !callerIsMain) {
        skippedCount += 1;
        continue;
      }
      if (!callerIsMain && target.role === 'admin' && action !== 'notify') {
        skippedCount += 1;
        continue;
      }
      if (action === 'suspend' && (targetIsMain || target.role === 'admin')) {
        skippedCount += 1;
        continue;
      }

      if (action === 'credit' || action === 'debit') {
        const delta = action === 'debit' ? Math.min(target.balance, amount) : amount;
        target.balance =
          action === 'debit' ? Math.max(0, target.balance - amount) : target.balance + amount;
        const txType = action === 'debit' ? 'admin_debit' : 'admin_credit';
        const txDesc = note || (action === 'debit' ? 'Overwatch Bulk Debit' : 'Overwatch Bulk Credit');
        const txId = makeId('tx');
        store.db.transactions.unshift({
          id: txId,
          userId: target.id,
          userName: target.name,
          userEmail: target.email,
          type: txType,
          amount: delta,
          status: 'completed',
          description: txDesc,
          createdAt: now,
        });
        store.recordAccountingEntry({
          kind: 'transaction',
          sourceId: txId,
          category: txType,
          userId: target.id,
          userName: target.name,
          userEmail: target.email,
          title: action === 'debit' ? 'BULK DEBIT' : 'BULK CREDIT',
          detail: txDesc,
          amount: delta,
          status: 'completed',
          createdAt: now,
        });
      } else if (action === 'suspend') {
        target.status = 'suspended';
      } else if (action === 'activate') {
        target.status = 'active';
      } else if (action === 'notify') {
        store.db.notifications.unshift({
          id: makeId('ntf'),
          title: title || 'Important Account Notice',
          message: message || title,
          type: 'info',
          targetUserId: target.id,
          readBy: [],
          createdAt: now,
        });
      }
      affectedCount += 1;
    }

    store.logAudit(
      req.currentUser!.email,
      `BULK_USER_${action.toUpperCase()}`,
      `${affectedCount} user(s)`,
      `Bulk ${action}${amount > 0 ? ` (${store.db.settings.currencySymbol}${amount.toLocaleString()})` : ''}; skipped ${skippedCount}`,
    );
    store.save();
    res.json({ ok: true, affectedCount, skippedCount });
  });

  // --- ADMIN RECEIPT & ORDER DECISIONS ---
  app.post('/api/admin/transactions/:id/decision', requireAuth, requireAdminScope('orders', 'live', 'overview'), (req: AuthedRequest, res) => {
    const tx = store.db.transactions.find((t) => t.id === req.params.id);
    if (!tx || tx.type !== 'deposit') {
      res.status(404).json({ error: 'Deposit transaction not found' });
      return;
    }
    const decision = String(req.body?.decision || '');
    const adminNote = String(req.body?.adminNote || '').trim();
    const user = store.db.users.find((u) => u.id === tx.userId);

    const now = new Date().toISOString();
    if (decision === 'approve') {
      if (tx.status !== 'verified' && user) {
        user.balance += tx.amount;
        const bonusPct = Math.max(0, Math.min(100, Number(store.db.settings.depositBonusPercent ?? 0)));
        if (bonusPct > 0) {
          const bonusAmt = Math.round((tx.amount * bonusPct) / 100);
          if (bonusAmt > 0) {
            user.balance += bonusAmt;
            const bTxId = makeId('tx');
            store.db.transactions.unshift({
              id: bTxId,
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              type: 'admin_credit',
              amount: bonusAmt,
              status: 'completed',
              description: `${bonusPct}% Deposit Promo Bonus`,
              createdAt: now,
            });
            store.recordAccountingEntry({
              kind: 'transaction',
              sourceId: bTxId,
              category: 'admin_credit',
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              title: 'DEPOSIT PROMO BONUS',
              detail: `${bonusPct}% bonus on verified deposit`,
              amount: bonusAmt,
              status: 'completed',
              createdAt: now,
            });
          }
        }
        creditReferrerOnFirstVerifiedDeposit(user, now);
      }
      tx.status = 'verified';
      tx.adminNote = adminNote || 'Verified by Our Team';
      if (user) {
        store.db.notifications.unshift({
          id: makeId('ntf'),
          title: 'Deposit Approved',
          message: `Your ${store.db.settings.bankName} transfer of ${store.db.settings.currencySymbol}${tx.amount.toLocaleString()} has been verified and credited.`,
          type: 'success',
          targetUserId: user.id,
          readBy: [],
          createdAt: now,
        });
      }
    } else if (decision === 'reject' || decision === 'reverse') {
      if (tx.status === 'verified' && user) {
        user.balance = Math.max(0, user.balance - tx.amount);
      }
      tx.status = 'rejected';
      tx.adminNote = adminNote || 'Declined by Our Team';
      if (user) {
        store.db.notifications.unshift({
          id: makeId('ntf'),
          title: 'Deposit Declined',
          message: `Your transfer of ${store.db.settings.currencySymbol}${tx.amount.toLocaleString()} was declined. Reason: ${tx.adminNote}`,
          type: 'warning',
          targetUserId: user.id,
          readBy: [],
          createdAt: now,
        });
      }
    } else {
      res.status(400).json({ error: 'Invalid decision' });
      return;
    }

    store.syncAccountingStatus(tx.id, tx.status);
    store.logAudit(req.currentUser!.email, `DEPOSIT_${decision.toUpperCase()}`, tx.userEmail, `Amount: ${tx.amount}`);
    store.save();
    res.json({ transaction: tx });
  });

  app.post('/api/admin/transactions/bulk-approve-matched', requireAuth, requireAdminScope('orders', 'live', 'overview', 'power_suite'), (req: AuthedRequest, res) => {
    const matched = store.db.transactions.filter(
      (t) =>
        !t.adminCleared &&
        t.type === 'deposit' &&
        t.status === 'pending' &&
        t.aiAudit?.verdict === 'match' &&
        t.aiAudit?.checks?.uniqueReference !== false,
    );
    let totalCredited = 0;
    const now = new Date().toISOString();
    const bonusPct = Math.max(0, Math.min(100, Number(store.db.settings.depositBonusPercent ?? 0)));
    for (const tx of matched) {
      const targetUser = store.db.users.find((u) => u.id === tx.userId);
      if (targetUser) {
        targetUser.balance += tx.amount;
        if (bonusPct > 0) {
          const bonusAmt = Math.round((tx.amount * bonusPct) / 100);
          if (bonusAmt > 0) {
            targetUser.balance += bonusAmt;
          }
        }
        creditReferrerOnFirstVerifiedDeposit(targetUser, now);
        store.db.notifications.unshift({
          id: makeId('ntf'),
          title: 'Deposit Approved',
          message: `Your ${store.db.settings.bankName} transfer of ${store.db.settings.currencySymbol}${tx.amount.toLocaleString()} has been verified and credited.`,
          type: 'success',
          targetUserId: targetUser.id,
          readBy: [],
          createdAt: now,
        });
      }
      tx.status = 'verified';
      tx.adminNote = 'Verified by Our Team';
      store.syncAccountingStatus(tx.id, 'verified');
      totalCredited += tx.amount;
    }
    if (matched.length > 0) {
      store.logAudit(
        req.currentUser!.email,
        'BULK_APPROVE_MATCHED_DEPOSITS',
        `${matched.length} receipts`,
        `Total credited: ${totalCredited}`,
      );
      store.save();
    }
    res.json({ approvedCount: matched.length, totalCredited });
  });

  app.post('/api/admin/boosting-orders/bulk-status', requireAuth, requireAdminScope('orders', 'live', 'overview'), (req: AuthedRequest, res) => {
    const fromStatus = String(req.body?.fromStatus || '');
    const toStatus = String(req.body?.toStatus || '');
    if (
      !['pending', 'processing', 'refilling'].includes(fromStatus) ||
      !['processing', 'completed'].includes(toStatus)
    ) {
      res.status(400).json({ error: 'Invalid bulk status transition' });
      return;
    }
    const now = new Date().toISOString();
    let updatedCount = 0;
    for (const order of store.db.boostingOrders) {
      if (!order.adminCleared && order.status === fromStatus) {
        order.status = toStatus as 'processing' | 'completed';
        if (toStatus === 'completed') {
          order.remains = 0;
        }
        order.updatedAt = now;
        updatedCount += 1;
      }
    }
    if (updatedCount > 0) {
      store.logAudit(
        req.currentUser!.email,
        'BULK_BOOSTING_STATUS',
        `${fromStatus} -> ${toStatus}`,
        `Updated ${updatedCount} boosting orders`,
      );
      store.save();
    }
    res.json({ updatedCount });
  });

  app.patch('/api/admin/boosting-orders/:id', requireAuth, requireAdminScope('orders', 'live', 'overview'), (req, res) => {
    const order = store.db.boostingOrders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Boosting order not found' });
      return;
    }
    const nextStatus = req.body?.status;
    if (
      nextStatus === 'pending' ||
      nextStatus === 'processing' ||
      nextStatus === 'completed' ||
      nextStatus === 'cancelled' ||
      nextStatus === 'refilling'
    ) {
      if (nextStatus === 'cancelled' && order.status !== 'cancelled') {
        const user = store.db.users.find((u) => u.id === order.userId);
        if (user) {
          user.balance += order.amount;
          const refBoostNow = new Date().toISOString();
          const refBoostTxId = makeId('tx');
          store.db.transactions.unshift({
            id: refBoostTxId,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            type: 'refund',
            amount: order.amount,
            status: 'completed',
            description: `Refund for cancelled boost order ${order.id}`,
            createdAt: refBoostNow,
          });
          store.recordAccountingEntry({
            kind: 'transaction',
            sourceId: refBoostTxId,
            category: 'refund',
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            title: 'BOOST CANCEL REFUND',
            detail: `Refund for cancelled boost order ${order.id}`,
            amount: order.amount,
            status: 'completed',
            createdAt: refBoostNow,
          });
        }
      }
      order.status = nextStatus;
      store.syncAccountingStatus(order.id, nextStatus);
      if (nextStatus === 'completed') {
        order.remains = 0;
      }
    }
    if (typeof req.body?.remains === 'number') {
      order.remains = Math.max(0, req.body.remains);
    }
    order.updatedAt = new Date().toISOString();
    store.save();
    res.json({ order });
  });

  app.post('/api/admin/sms-orders/:id/assign-number', requireAuth, requireAdminScope('orders', 'live', 'overview', 'sms_numbers'), (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const order = store.db.smsOrders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    if (order.status === 'cancelled' || order.status === 'expired') {
      res.status(400).json({ error: `Cannot assign a number to a ${order.status} order` });
      return;
    }
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    order.phoneNumber = phoneNumber;
    if (order.status === 'waiting') {
      order.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    store.db.notifications.unshift({
      id: makeId('ntf'),
      title: `Number Assigned (${order.serviceName})`,
      message: `Your number ${phoneNumber} is now ready in your SMS Inbox. 15-minute OTP timer active.`,
      type: 'info',
      targetUserId: order.userId,
      readBy: [],
      createdAt: new Date().toISOString(),
    });
    store.logAudit(
      req.currentUser!.email,
      'ASSIGN_SMS_NUMBER',
      order.id,
      `Assigned ${phoneNumber} to ${order.userEmail} (${order.serviceName})`,
    );
    store.save();
    res.json({ order });
  });

  app.post('/api/admin/sms-orders/:id/deliver', requireAuth, requireAdminScope('orders', 'live', 'overview', 'sms_numbers'), (req: AuthedRequest, res) => {
    expireTimedOutSmsOrders();
    const order = store.db.smsOrders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    if (order.status === 'cancelled' || order.status === 'expired') {
      res.status(400).json({ error: `Cannot deliver an OTP to a ${order.status} order` });
      return;
    }
    const phoneNumberInput = String(req.body?.phoneNumber || '').trim();
    if (phoneNumberInput) {
      order.phoneNumber = phoneNumberInput;
    }
    const otpCode = String(req.body?.otpCode || '').trim();
    if (!otpCode) {
      res.status(400).json({ error: 'OTP code is required' });
      return;
    }
    const svc = store.db.smsServices.find((s) => s.id === order.serviceId);
    order.status = 'received';
    order.otpCode = otpCode;
    order.smsText =
      String(req.body?.smsText || '').trim() ||
      (svc?.sampleTemplate || 'Your verification code is {{CODE}}').replace('{{CODE}}', otpCode);
    store.db.notifications.unshift({
      id: makeId('ntf'),
      title: `OTP Delivered (${order.serviceName})`,
      message: `Your OTP code ${otpCode} for ${order.phoneNumber} has arrived in your SMS Inbox.`,
      type: 'success',
      targetUserId: order.userId,
      readBy: [],
      createdAt: new Date().toISOString(),
    });
    store.logAudit(
      req.currentUser!.email,
      'DELIVER_SMS_OTP',
      order.id,
      `Delivered OTP ${otpCode} to ${order.userEmail} (${order.phoneNumber})`,
    );
    store.save();
    res.json({ order });
  });

  app.post('/api/admin/sms-pool', requireAuth, requireAdminScope('orders', 'catalog', 'sms_numbers'), (req, res) => {
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    const countryId = String(req.body?.countryId || 'cnt_us');
    const serviceId = String(req.body?.serviceId || '');
    const presetOtp = String(req.body?.presetOtp || '').trim();
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    const item = {
      id: makeId('pool'),
      phoneNumber,
      countryId,
      serviceId,
      presetOtp,
      used: false,
      createdAt: new Date().toISOString(),
    };
    store.db.smsPool.unshift(item);
    store.save();
    res.status(201).json({ item });
  });

  app.post('/api/admin/sms-pool/bulk', requireAuth, requireAdminScope('orders', 'catalog', 'sms_numbers'), (req: AuthedRequest, res) => {
    const linesRaw = String(req.body?.lines || '').trim();
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const countryId = String(req.body?.countryId || 'cnt_us');
    const serviceId = String(req.body?.serviceId || '');
    const parsedItems: { phoneNumber: string; presetOtp: string }[] = [];
    if (linesRaw) {
      for (const rawLine of linesRaw.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const parts = line.split(/[|,;\t]/).map((p) => p.trim());
        const phoneNumber = parts[0] || '';
        const presetOtp = parts[1] || '';
        if (phoneNumber) parsedItems.push({ phoneNumber, presetOtp });
      }
    } else if (entries.length > 0) {
      for (const entry of entries.slice(0, 200)) {
        const phoneNumber = String(entry?.phoneNumber || '').trim();
        const presetOtp = String(entry?.presetOtp || '').trim();
        if (phoneNumber) parsedItems.push({ phoneNumber, presetOtp });
      }
    }
    if (parsedItems.length === 0) {
      res.status(400).json({ error: 'Provide at least one phone number to import' });
      return;
    }
    const created = parsedItems.slice(0, 200).map((entry) => {
      const item = {
        id: makeId('pool'),
        phoneNumber: entry.phoneNumber,
        countryId,
        serviceId,
        presetOtp: entry.presetOtp,
        used: false,
        createdAt: new Date().toISOString(),
      };
      store.db.smsPool.unshift(item);
      return item;
    });
    store.logAudit(
      req.currentUser!.email,
      'BULK_ADD_SMS_POOL',
      countryId,
      `Imported ${created.length} numbers into SMS pool`,
    );
    store.save();
    res.status(201).json({ addedCount: created.length, items: created });
  });

  app.post('/api/admin/sms-pool/clear-ready', requireAuth, requireAdminScope('orders', 'catalog', 'sms_numbers'), (req: AuthedRequest, res) => {
    const scope = String(req.body?.scope || 'ready');
    const before = store.db.smsPool.length;
    if (scope === 'used') {
      store.db.smsPool = store.db.smsPool.filter((p) => !p.used);
    } else if (scope === 'all') {
      store.db.smsPool = [];
    } else {
      store.db.smsPool = store.db.smsPool.filter((p) => p.used);
    }
    const removedCount = before - store.db.smsPool.length;
    store.logAudit(
      req.currentUser!.email,
      'CLEAR_SMS_POOL',
      scope,
      `Cleared ${removedCount} SMS pool numbers (${scope})`,
    );
    store.save();
    res.json({ ok: true, removedCount });
  });

  app.delete('/api/admin/sms-pool/:id', requireAuth, requireAdminScope('orders', 'catalog', 'sms_numbers'), (req, res) => {
    store.db.smsPool = store.db.smsPool.filter((p) => p.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/orders/clear', requireAuth, requireAdminScope('orders'), (req: AuthedRequest, res) => {
    const scope = String(req.body?.scope || 'completed');
    if (scope === 'all') {
      for (const s of store.db.smsOrders) s.adminCleared = true;
      for (const b of store.db.boostingOrders) b.adminCleared = true;
      for (const v of store.db.vaultItems) v.adminCleared = true;
    } else if (scope === 'sms') {
      for (const s of store.db.smsOrders) s.adminCleared = true;
    } else if (scope === 'boosting') {
      for (const b of store.db.boostingOrders) b.adminCleared = true;
    } else if (scope === 'vault') {
      for (const v of store.db.vaultItems) v.adminCleared = true;
    } else {
      for (const s of store.db.smsOrders) {
        if (s.status !== 'waiting') s.adminCleared = true;
      }
      for (const b of store.db.boostingOrders) {
        if (b.status !== 'pending' && b.status !== 'processing' && b.status !== 'refilling') {
          b.adminCleared = true;
        }
      }
    }
    store.logAudit(
      req.currentUser!.email,
      'CLEAR_ORDERS',
      scope,
      `Cleared orders from Overwatch (${scope}); user order history preserved`,
    );
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/sms-orders/:id', requireAuth, requireAdminScope('orders', 'sms_numbers'), (req: AuthedRequest, res) => {
    const target = store.db.smsOrders.find((o) => o.id === req.params.id && !o.adminCleared);
    if (!target) {
      res.status(404).json({ error: 'SMS order not found' });
      return;
    }
    target.adminCleared = true;
    store.logAudit(
      req.currentUser!.email,
      'DELETE_SMS_ORDER',
      req.params.id,
      'Cleared SMS order from Overwatch (user copy preserved)',
    );
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/boosting-orders/:id', requireAuth, requireAdminScope('orders'), (req: AuthedRequest, res) => {
    const target = store.db.boostingOrders.find((o) => o.id === req.params.id && !o.adminCleared);
    if (!target) {
      res.status(404).json({ error: 'Boosting order not found' });
      return;
    }
    target.adminCleared = true;
    store.logAudit(
      req.currentUser!.email,
      'DELETE_BOOSTING_ORDER',
      req.params.id,
      'Cleared boosting order from Overwatch (user copy preserved)',
    );
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/vault-items/:id', requireAuth, requireAdminScope('orders'), (req: AuthedRequest, res) => {
    const target = store.db.vaultItems.find((v) => v.id === req.params.id && !v.adminCleared);
    if (!target) {
      res.status(404).json({ error: 'Vault delivery record not found' });
      return;
    }
    target.adminCleared = true;
    store.logAudit(
      req.currentUser!.email,
      'DELETE_VAULT_ITEM',
      req.params.id,
      'Cleared vault delivery record from Overwatch (buyer copy preserved)',
    );
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/transactions/:id', requireAuth, requireAdminScope('orders'), (req: AuthedRequest, res) => {
    const target = store.db.transactions.find((t) => t.id === req.params.id && !t.adminCleared);
    if (!target) {
      res.status(404).json({ error: 'Transaction record not found' });
      return;
    }
    target.adminCleared = true;
    store.logAudit(
      req.currentUser!.email,
      'DELETE_TRANSACTION',
      target.userEmail,
      `Cleared ${target.type} (${target.id}) from Overwatch (user history preserved)`,
    );
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/transactions/clear', requireAuth, requireAdminScope('orders'), (req: AuthedRequest, res) => {
    const scope = String(req.body?.scope || 'all');
    let removed = 0;
    const matchesScope = (t: (typeof store.db.transactions)[number]) => {
      if (scope === 'all') return true;
      if (scope === 'deposit') return t.type === 'deposit';
      if (scope === 'processed_deposits') {
        return t.type === 'deposit' && (t.status === 'verified' || t.status === 'rejected');
      }
      if (scope === 'purchase') return t.type === 'purchase';
      if (scope === 'refund') return t.type === 'refund';
      if (scope === 'credits') {
        return (
          t.type === 'admin_credit' ||
          t.type === 'admin_debit' ||
          t.type === 'referral_bonus' ||
          t.type === 'welcome_bonus'
        );
      }
      return false;
    };
    for (const t of store.db.transactions) {
      if (!t.adminCleared && matchesScope(t)) {
        t.adminCleared = true;
        removed += 1;
      }
    }
    store.logAudit(
      req.currentUser!.email,
      'CLEAR_TRANSACTIONS',
      scope,
      `Cleared ${removed} transaction record(s) from Overwatch (user history preserved)`,
    );
    store.save();
    res.json({ ok: true, removed });
  });

  // --- ADMIN CATALOG CRUD ---
  app.post('/api/admin/sms-services', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const svc: SmsService = {
      id: makeId('svc'),
      name: String(req.body?.name || 'New Service').trim(),
      category: String(req.body?.category || 'General').trim(),
      basePrice: Math.max(50, Number(req.body?.basePrice || 1000)),
      successRate: Math.min(100, Math.max(50, Number(req.body?.successRate || 98.5))),
      stock: Math.max(0, Number(req.body?.stock || 500)),
      active: req.body?.active !== false,
      sampleTemplate: String(req.body?.sampleTemplate || 'Your verification code is {{CODE}}.'),
    };
    store.db.smsServices.push(svc);
    store.save();
    res.status(201).json({ service: svc });
  });

  app.patch('/api/admin/sms-services/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const svc = store.db.smsServices.find((s) => s.id === req.params.id);
    if (!svc) {
      res.status(404).json({ error: 'SMS service not found' });
      return;
    }
    Object.assign(svc, {
      name: typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : svc.name,
      category: typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim() : svc.category,
      basePrice:
        typeof req.body?.basePrice === 'number' && Number.isFinite(req.body.basePrice)
          ? Math.max(50, req.body.basePrice)
          : svc.basePrice,
      successRate:
        typeof req.body?.successRate === 'number' && Number.isFinite(req.body.successRate)
          ? Math.min(100, Math.max(0, req.body.successRate))
          : svc.successRate,
      stock:
        typeof req.body?.stock === 'number' && Number.isFinite(req.body.stock)
          ? Math.max(0, Math.floor(req.body.stock))
          : svc.stock,
      active: typeof req.body?.active === 'boolean' ? req.body.active : svc.active,
      sampleTemplate: req.body?.sampleTemplate ?? svc.sampleTemplate,
    });
    store.save();
    res.json({ service: svc });
  });

  app.delete('/api/admin/sms-services/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    store.db.smsServices = store.db.smsServices.filter((s) => s.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/sms-countries', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const country: SmsCountry = {
      id: makeId('cnt'),
      name: String(req.body?.name || 'New Country').trim(),
      code: String(req.body?.code || 'XX').trim().toUpperCase(),
      dialCode: String(req.body?.dialCode || '+1').trim(),
      multiplier: Math.max(0.1, Number(req.body?.multiplier || 1)),
      active: req.body?.active !== false,
    };
    store.db.smsCountries.push(country);
    store.save();
    res.status(201).json({ country });
  });

  app.patch('/api/admin/sms-countries/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const country = store.db.smsCountries.find((c) => c.id === req.params.id);
    if (!country) {
      res.status(404).json({ error: 'Country not found' });
      return;
    }
    Object.assign(country, {
      name: typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : country.name,
      code: typeof req.body?.code === 'string' && req.body.code.trim() ? req.body.code.trim().toUpperCase() : country.code,
      dialCode: typeof req.body?.dialCode === 'string' && req.body.dialCode.trim() ? req.body.dialCode.trim() : country.dialCode,
      multiplier:
        typeof req.body?.multiplier === 'number' && Number.isFinite(req.body.multiplier)
          ? Math.max(0.1, req.body.multiplier)
          : country.multiplier,
      active: typeof req.body?.active === 'boolean' ? req.body.active : country.active,
    });
    store.save();
    res.json({ country });
  });

  app.delete('/api/admin/sms-countries/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    store.db.smsCountries = store.db.smsCountries.filter((c) => c.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/boosting-services', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const item: BoostingService = {
      id: makeId('bst'),
      platform: String(req.body?.platform || 'Instagram').trim(),
      category: String(req.body?.category || 'Followers').trim(),
      name: String(req.body?.name || 'New Boosting Package').trim(),
      ratePer1k: Math.max(50, Number(req.body?.ratePer1k || 1000)),
      minQty: Math.max(10, Number(req.body?.minQty || 50)),
      maxQty: Math.max(100, Number(req.body?.maxQty || 100000)),
      speedLabel: String(req.body?.speedLabel || '10K / day').trim(),
      refillPolicy: String(req.body?.refillPolicy || '30-Day Refill').trim(),
      active: req.body?.active !== false,
    };
    store.db.boostingServices.push(item);
    store.save();
    res.status(201).json({ service: item });
  });

  app.patch('/api/admin/boosting-services/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const item = store.db.boostingServices.find((b) => b.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Boosting service not found' });
      return;
    }
    Object.assign(item, {
      platform: typeof req.body?.platform === 'string' && req.body.platform.trim() ? req.body.platform.trim() : item.platform,
      category: typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim() : item.category,
      name: typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : item.name,
      ratePer1k:
        typeof req.body?.ratePer1k === 'number' && Number.isFinite(req.body.ratePer1k)
          ? Math.max(10, req.body.ratePer1k)
          : item.ratePer1k,
      minQty:
        typeof req.body?.minQty === 'number' && Number.isFinite(req.body.minQty)
          ? Math.max(1, Math.floor(req.body.minQty))
          : item.minQty,
      maxQty:
        typeof req.body?.maxQty === 'number' && Number.isFinite(req.body.maxQty)
          ? Math.max(1, Math.floor(req.body.maxQty))
          : item.maxQty,
      speedLabel: req.body?.speedLabel ?? item.speedLabel,
      refillPolicy: req.body?.refillPolicy ?? item.refillPolicy,
      active: typeof req.body?.active === 'boolean' ? req.body.active : item.active,
    });
    store.save();
    res.json({ service: item });
  });

  app.delete('/api/admin/boosting-services/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    store.db.boostingServices = store.db.boostingServices.filter((b) => b.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/marketplace-categories', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    const cat = {
      id: makeId('cat'),
      name,
      description: String(req.body?.description || '').trim(),
    };
    store.db.marketplaceCategories.push(cat);
    store.save();
    res.status(201).json({ category: cat });
  });

  app.patch('/api/admin/marketplace-categories/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    const cat = store.db.marketplaceCategories.find((c) => c.id === req.params.id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const prevName = cat.name;
    const nextName =
      typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : cat.name;
    cat.name = nextName;
    if (typeof req.body?.description === 'string') {
      cat.description = req.body.description.trim();
    }
    if (prevName !== nextName) {
      for (const l of store.db.marketplaceListings) {
        if (l.category === prevName) l.category = nextName;
      }
    }
    store.save();
    res.json({ category: cat });
  });

  app.delete('/api/admin/marketplace-categories/:id', requireAuth, requireAdminScope('catalog'), (req, res) => {
    store.db.marketplaceCategories = store.db.marketplaceCategories.filter(
      (c) => c.id !== req.params.id,
    );
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/catalog/reorder', requireAuth, requireAdminScope('catalog', 'cms'), (req: AuthedRequest, res) => {
    const rawKind = String(req.body?.kind || req.body?.entity || '').trim();
    const orderedIds = Array.isArray(req.body?.orderedIds)
      ? req.body.orderedIds.map(String)
      : [];
    if (orderedIds.length === 0) {
      res.status(400).json({ error: 'orderedIds array is required' });
      return;
    }
    if (rawKind === 'marketplace' || rawKind === 'marketplace_listings') {
      store.db.marketplaceListings = reorderByIds(store.db.marketplaceListings, orderedIds);
    } else if (rawKind === 'categories' || rawKind === 'marketplace_categories') {
      store.db.marketplaceCategories = reorderByIds(store.db.marketplaceCategories, orderedIds);
    } else if (rawKind === 'smsServices' || rawKind === 'sms_services') {
      store.db.smsServices = reorderByIds(store.db.smsServices, orderedIds);
    } else if (rawKind === 'smsCountries' || rawKind === 'sms_countries') {
      store.db.smsCountries = reorderByIds(store.db.smsCountries, orderedIds);
    } else if (rawKind === 'boosting' || rawKind === 'boosting_services') {
      store.db.boostingServices = reorderByIds(store.db.boostingServices, orderedIds);
    } else if (rawKind === 'sections' || rawKind === 'custom_sections') {
      store.db.customSections = reorderByIds(store.db.customSections, orderedIds);
    } else if (rawKind === 'sectionProducts' || rawKind === 'section_products') {
      const sectionId = String(req.body?.sectionId || '').trim();
      const targetSec =
        (sectionId ? store.db.customSections.find((s) => s.id === sectionId) : undefined) ||
        store.db.customSections.find((s) => s.products.some((p) => p.id === orderedIds[0]));
      if (!targetSec) {
        res.status(404).json({ error: 'Custom section not found for product reorder' });
        return;
      }
      targetSec.products = reorderByIds(targetSec.products, orderedIds);
    } else {
      res.status(400).json({ error: `Unsupported reorder kind: ${rawKind || 'empty'}` });
      return;
    }
    store.logAudit(req.currentUser!.email, 'REORDER_CATALOG', rawKind, `Reordered ${orderedIds.length} items`);
    store.save();
    res.json({ ok: true, kind: rawKind });
  });

  app.post('/api/admin/catalog/bulk', requireAuth, requireAdminScope('catalog'), (req: AuthedRequest, res) => {
    const target = String(req.body?.target || '').trim();
    const action = String(req.body?.action || '').trim();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const percentRaw = Number(req.body?.percent || 0);
    const percent = Number.isFinite(percentRaw) ? Math.max(-90, Math.min(500, percentRaw)) : 0;
    if (!ids.length) {
      res.status(400).json({ error: 'Select at least one item' });
      return;
    }
    const idSet = new Set(ids);
    let affected = 0;

    if (target === 'marketplace') {
      if (action === 'delete') {
        const before = store.db.marketplaceListings.length;
        store.db.marketplaceListings = store.db.marketplaceListings.filter((l) => !idSet.has(l.id));
        affected = before - store.db.marketplaceListings.length;
      } else {
        for (const l of store.db.marketplaceListings) {
          if (!idSet.has(l.id)) continue;
          if (action === 'activate') { l.active = true; affected += 1; }
          else if (action === 'pause') { l.active = false; affected += 1; }
          else if (action === 'price_percent') {
            l.price = Math.max(50, Math.round(l.price * (1 + percent / 100)));
            affected += 1;
          }
        }
      }
    } else if (target === 'smsServices') {
      if (action === 'delete') {
        const before = store.db.smsServices.length;
        store.db.smsServices = store.db.smsServices.filter((s) => !idSet.has(s.id));
        affected = before - store.db.smsServices.length;
      } else {
        for (const s of store.db.smsServices) {
          if (!idSet.has(s.id)) continue;
          if (action === 'activate') { s.active = true; affected += 1; }
          else if (action === 'pause') { s.active = false; affected += 1; }
          else if (action === 'price_percent') {
            s.basePrice = Math.max(50, Math.round(s.basePrice * (1 + percent / 100)));
            affected += 1;
          }
        }
      }
    } else if (target === 'boosting') {
      if (action === 'delete') {
        const before = store.db.boostingServices.length;
        store.db.boostingServices = store.db.boostingServices.filter((b) => !idSet.has(b.id));
        affected = before - store.db.boostingServices.length;
      } else {
        for (const b of store.db.boostingServices) {
          if (!idSet.has(b.id)) continue;
          if (action === 'activate') { b.active = true; affected += 1; }
          else if (action === 'pause') { b.active = false; affected += 1; }
          else if (action === 'price_percent') {
            b.ratePer1k = Math.max(10, Math.round(b.ratePer1k * (1 + percent / 100)));
            affected += 1;
          }
        }
      }
    } else {
      res.status(400).json({ error: 'Unsupported bulk target' });
      return;
    }

    store.logAudit(
      req.currentUser!.email,
      `BULK_${action.toUpperCase()}`,
      target,
      `Applied ${action} to ${affected} item(s)`,
    );
    store.save();
    res.json({ ok: true, affected });
  });

  app.post('/api/admin/catalog/duplicate', requireAuth, requireAdminScope('catalog', 'cms'), (req: AuthedRequest, res) => {
    const target = String(req.body?.target || '').trim();
    const id = String(req.body?.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Source id is required' });
      return;
    }
    if (target === 'marketplace') {
      const idx = store.db.marketplaceListings.findIndex((l) => l.id === id);
      if (idx === -1) { res.status(404).json({ error: 'Listing not found' }); return; }
      const src = store.db.marketplaceListings[idx];
      const copy: MarketplaceListing = {
        ...src,
        id: makeId('mkt'),
        title: `${src.title} (Copy)`,
        features: [...src.features],
        stockKeys: [...src.stockKeys],
        soldCount: 0,
      };
      store.db.marketplaceListings.splice(idx + 1, 0, copy);
      store.logAudit(req.currentUser!.email, 'DUPLICATE_LISTING', copy.title, `Cloned from ${src.id}`);
      store.save();
      res.status(201).json({ ok: true, item: copy });
      return;
    }
    if (target === 'smsServices') {
      const idx = store.db.smsServices.findIndex((s) => s.id === id);
      if (idx === -1) { res.status(404).json({ error: 'SMS service not found' }); return; }
      const src = store.db.smsServices[idx];
      const copy: SmsService = { ...src, id: makeId('svc'), name: `${src.name} (Copy)` };
      store.db.smsServices.splice(idx + 1, 0, copy);
      store.logAudit(req.currentUser!.email, 'DUPLICATE_SMS_SERVICE', copy.name, `Cloned from ${src.id}`);
      store.save();
      res.status(201).json({ ok: true, item: copy });
      return;
    }
    if (target === 'boosting') {
      const idx = store.db.boostingServices.findIndex((b) => b.id === id);
      if (idx === -1) { res.status(404).json({ error: 'Boosting service not found' }); return; }
      const src = store.db.boostingServices[idx];
      const copy: BoostingService = { ...src, id: makeId('bst'), name: `${src.name} (Copy)` };
      store.db.boostingServices.splice(idx + 1, 0, copy);
      store.logAudit(req.currentUser!.email, 'DUPLICATE_BOOST_SERVICE', copy.name, `Cloned from ${src.id}`);
      store.save();
      res.status(201).json({ ok: true, item: copy });
      return;
    }
    if (target === 'sectionProduct') {
      const sectionId = String(req.body?.sectionId || '').trim();
      const sec =
        (sectionId ? store.db.customSections.find((s) => s.id === sectionId) : undefined) ||
        store.db.customSections.find((s) => s.products.some((p) => p.id === id));
      if (!sec) { res.status(404).json({ error: 'Custom section not found' }); return; }
      const idx = sec.products.findIndex((p) => p.id === id);
      if (idx === -1) { res.status(404).json({ error: 'Section product not found' }); return; }
      const src = sec.products[idx];
      const copy = { ...src, id: makeId('secp'), title: `${src.title} (Copy)` };
      sec.products.splice(idx + 1, 0, copy);
      store.logAudit(req.currentUser!.email, 'DUPLICATE_SECTION_PRODUCT', copy.title, `Cloned in ${sec.name}`);
      store.save();
      res.status(201).json({ ok: true, item: copy });
      return;
    }
    res.status(400).json({ error: 'Unsupported duplicate target' });
  });

  app.post('/api/admin/marketplace-listings', requireAuth, requireAdminScope('catalog'), (req: AuthedRequest, res) => {
    const featuresRaw = req.body?.features;
    const features = Array.isArray(featuresRaw)
      ? featuresRaw.map(String)
      : String(featuresRaw || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
    const stockKeysRaw = req.body?.stockKeys;
    const stockKeys = Array.isArray(stockKeysRaw)
      ? stockKeysRaw.map(String)
      : String(stockKeysRaw || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    const computedStock =
      stockKeys.length > 0 ? stockKeys.length : Math.max(0, Number(req.body?.stock ?? 0));

    const rawCat = String(req.body?.category ?? '').trim();
    const defaultCat = store.db.marketplaceCategories[0]?.name || 'General';
    let resolvedCategory = rawCat || defaultCat;
    const existingCat = store.db.marketplaceCategories.find(
      (c) => c.name.trim().toLowerCase() === resolvedCategory.toLowerCase(),
    );
    if (existingCat) {
      resolvedCategory = existingCat.name;
    } else if (resolvedCategory) {
      store.db.marketplaceCategories.push({
        id: makeId('cat'),
        name: resolvedCategory,
        description: `${resolvedCategory} digital products`,
      });
    }

    const listing: MarketplaceListing = {
      id: makeId('mkt'),
      title: String(req.body?.title || 'New Digital Asset').trim(),
      category: resolvedCategory,
      popularTag: String(req.body?.popularTag || resolvedCategory).trim(),
      shortSpec: String(req.body?.shortSpec || 'Instant digital delivery').trim(),
      description: String(req.body?.description || '').trim(),
      buyWarning: String(req.body?.buyWarning || store.db.settings.defaultBuyWarning).trim(),
      buyWarningLevel: req.body?.buyWarningLevel === 'info' ? 'info' : 'serious',
      features: features.length ? features : ['Instant Vault Key Delivery', 'Verified Quality'],
      price: Math.max(100, Number(req.body?.price || 2500)),
      stock: computedStock,
      deliveryType: String(req.body?.deliveryType || 'Login, Password & 2FA').trim(),
      imageUrl:
        String(req.body?.imageUrl || '').trim() ||
        '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
      logoUrl: String(req.body?.logoUrl || '').trim(),
      bounceLogo: Boolean(req.body?.bounceLogo),
      credentialTemplate: String(req.body?.credentialTemplate || 'LICENSE-{{KEY4}}-{{KEY4}}-{{RAND4}}'),
      stockKeys,
      soldCount: 0,
      active: req.body?.active !== false,
    };
    store.db.marketplaceListings.unshift(listing);
    store.logAudit(
      req.currentUser!.email,
      'CREATE_LISTING',
      listing.title,
      `Category: ${listing.category}, Price: ${listing.price}, Accounts: ${stockKeys.length}`,
    );
    store.save();
    res.status(201).json({ listing });
  });

  app.patch('/api/admin/marketplace-listings/:id', requireAuth, requireAdminScope('catalog'), (req: AuthedRequest, res) => {
    const item = store.db.marketplaceListings.find((l) => l.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    if (req.body?.features !== undefined) {
      item.features = Array.isArray(req.body.features)
        ? req.body.features.map(String)
        : String(req.body.features)
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (req.body?.stockKeys !== undefined) {
      item.stockKeys = Array.isArray(req.body.stockKeys)
        ? req.body.stockKeys.map(String)
        : String(req.body.stockKeys)
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    const nextStock =
      req.body?.stockKeys !== undefined && item.stockKeys.length > 0
        ? item.stockKeys.length
        : typeof req.body?.stock === 'number' && Number.isFinite(req.body.stock)
          ? Math.max(0, Math.floor(req.body.stock))
          : item.stock;
    let nextCategory = item.category;
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      const trimmed = req.body.category.trim();
      const matched = store.db.marketplaceCategories.find(
        (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (matched) {
        nextCategory = matched.name;
      } else {
        nextCategory = trimmed;
        store.db.marketplaceCategories.push({
          id: makeId('cat'),
          name: trimmed,
          description: `${trimmed} digital products`,
        });
      }
    }
    Object.assign(item, {
      title: req.body?.title ?? item.title,
      category: nextCategory,
      popularTag: req.body?.popularTag ?? item.popularTag,
      shortSpec: req.body?.shortSpec ?? item.shortSpec,
      description: req.body?.description ?? item.description,
      buyWarning: req.body?.buyWarning ?? item.buyWarning,
      buyWarningLevel:
        req.body?.buyWarningLevel === 'info' || req.body?.buyWarningLevel === 'serious'
          ? req.body.buyWarningLevel
          : item.buyWarningLevel,
      deliveryType: req.body?.deliveryType ?? item.deliveryType,
      price:
        typeof req.body?.price === 'number' && Number.isFinite(req.body.price)
          ? Math.max(0, req.body.price)
          : item.price,
      stock: nextStock,
      imageUrl: req.body?.imageUrl ?? item.imageUrl,
      logoUrl: req.body?.logoUrl ?? item.logoUrl,
      bounceLogo: typeof req.body?.bounceLogo === 'boolean' ? req.body.bounceLogo : item.bounceLogo,
      credentialTemplate: req.body?.credentialTemplate ?? item.credentialTemplate,
      active: typeof req.body?.active === 'boolean' ? req.body.active : item.active,
    });
    store.logAudit(req.currentUser!.email, 'UPDATE_LISTING', item.title, `Category: ${item.category}, Price: ${item.price}, Stock: ${item.stock}`);
    store.save();
    res.json({ listing: item });
  });

  app.delete('/api/admin/marketplace-listings/:id', requireAuth, requireAdminScope('catalog'), (req: AuthedRequest, res) => {
    const target = store.db.marketplaceListings.find((l) => l.id === req.params.id);
    store.db.marketplaceListings = store.db.marketplaceListings.filter(
      (l) => l.id !== req.params.id,
    );
    if (target) {
      store.logAudit(req.currentUser!.email, 'DELETE_LISTING', target.title, 'Removed from marketplace');
    }
    store.save();
    res.json({ ok: true });
  });

  // --- ADMIN CUSTOM SECTIONS & PRODUCTS ---
  app.post('/api/admin/sections/ai-setup', requireAuth, requireAdminScope('cms', 'catalog'), async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Section name is required for AI setup' });
      return;
    }
    const setup = await generateCustomSectionSetupWithAi({
      name,
      description: String(req.body?.description || ''),
      goal: String(req.body?.goal || ''),
      currencySymbol: store.db.settings.currencySymbol,
    });
    res.json({ setup });
  });

  app.post('/api/admin/sections', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    const starterProductsRaw = Array.isArray(req.body?.products) ? req.body.products : [];
    const secId = makeId('sec');
    const section: CustomSection = {
      id: secId,
      name: String(req.body?.name || 'Special Deals').trim(),
      icon: String(req.body?.icon || 'layers').trim(),
      description: String(req.body?.description || '').trim(),
      badgeTag: typeof req.body?.badgeTag === 'string' ? req.body.badgeTag.trim().slice(0, 12) : undefined,
      accentColor: typeof req.body?.accentColor === 'string' ? req.body.accentColor.trim() : undefined,
      defaultBuyWarning:
        typeof req.body?.defaultBuyWarning === 'string' ? req.body.defaultBuyWarning.trim() : undefined,
      defaultBuyWarningLevel:
        req.body?.defaultBuyWarningLevel === 'info' ? 'info' : req.body?.defaultBuyWarningLevel === 'serious' ? 'serious' : undefined,
      aiNotes: typeof req.body?.aiNotes === 'string' ? req.body.aiNotes.trim() : undefined,
      active: req.body?.active !== false,
      products: starterProductsRaw.map((p: Partial<CustomSectionProduct>) => ({
        id: makeId('sprod'),
        sectionId: secId,
        title: String(p.title || 'Section Product').trim(),
        shortSpec: String(p.shortSpec || 'Instant access').trim(),
        description: String(p.description || '').trim(),
        buyWarning: String(p.buyWarning || store.db.settings.defaultBuyWarning).trim(),
        buyWarningLevel: p.buyWarningLevel === 'info' ? 'info' : 'serious',
        price: Math.max(50, Number(p.price || 1500)),
        stock: Math.max(0, Number(p.stock || 20)),
        imageUrl:
          String(p.imageUrl || '').trim() ||
          '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
        logoUrl: String(p.logoUrl || '').trim(),
        bounceLogo: Boolean(p.bounceLogo),
        credentialTemplate: String(p.credentialTemplate || 'ACCESS-{{KEY4}}-{{RAND4}}'),
        active: p.active !== false,
      })),
    };
    store.db.customSections.push(section);
    store.save();
    res.status(201).json({ section });
  });

  app.patch('/api/admin/sections/:id', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    const section = store.db.customSections.find((s) => s.id === req.params.id);
    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim()) section.name = req.body.name.trim();
    if (typeof req.body?.icon === 'string' && req.body.icon.trim()) section.icon = req.body.icon.trim();
    if (typeof req.body?.description === 'string') section.description = req.body.description.trim();
    if (typeof req.body?.badgeTag === 'string') section.badgeTag = req.body.badgeTag.trim().slice(0, 12);
    if (typeof req.body?.accentColor === 'string') section.accentColor = req.body.accentColor.trim();
    if (typeof req.body?.defaultBuyWarning === 'string') {
      section.defaultBuyWarning = req.body.defaultBuyWarning.trim();
    }
    if (
      req.body?.defaultBuyWarningLevel === 'info' ||
      req.body?.defaultBuyWarningLevel === 'serious'
    ) {
      section.defaultBuyWarningLevel = req.body.defaultBuyWarningLevel;
    }
    if (typeof req.body?.aiNotes === 'string') section.aiNotes = req.body.aiNotes.trim();
    if (typeof req.body?.active === 'boolean') section.active = req.body.active;
    store.save();
    res.json({ section });
  });

  app.delete('/api/admin/sections/:id', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    store.db.customSections = store.db.customSections.filter((s) => s.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/section-products', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    const sectionId = String(req.body?.sectionId || '');
    const section = store.db.customSections.find((s) => s.id === sectionId);
    if (!section) {
      res.status(404).json({ error: 'Target section not found' });
      return;
    }
    const product: CustomSectionProduct = {
      id: makeId('sprod'),
      sectionId,
      title: String(req.body?.title || 'Section Product').trim(),
      shortSpec: String(req.body?.shortSpec || 'Instant access').trim(),
      description: String(req.body?.description || '').trim(),
      buyWarning: String(
        req.body?.buyWarning || section.defaultBuyWarning || store.db.settings.defaultBuyWarning,
      ).trim(),
      buyWarningLevel:
        req.body?.buyWarningLevel === 'info' || req.body?.buyWarningLevel === 'serious'
          ? req.body.buyWarningLevel
          : section.defaultBuyWarningLevel || 'serious',
      price: Math.max(50, Number(req.body?.price || 1500)),
      stock: Math.max(0, Number(req.body?.stock || 25)),
      imageUrl:
        String(req.body?.imageUrl || '').trim() ||
        '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
      logoUrl: String(req.body?.logoUrl || '').trim(),
      bounceLogo: Boolean(req.body?.bounceLogo),
      credentialTemplate: String(
        req.body?.credentialTemplate || 'KEY-{{KEY4}}-{{KEY4}}-{{RAND4}}',
      ),
      active: req.body?.active !== false,
    };
    section.products.push(product);
    store.save();
    res.status(201).json({ product });
  });

  app.patch('/api/admin/section-products/:id', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    let targetProduct: CustomSectionProduct | undefined;
    for (const s of store.db.customSections) {
      const found = s.products.find((p) => p.id === req.params.id);
      if (found) {
        targetProduct = found;
        break;
      }
    }
    if (!targetProduct) {
      res.status(404).json({ error: 'Section product not found' });
      return;
    }
    Object.assign(targetProduct, {
      title:
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim()
          : targetProduct.title,
      shortSpec:
        typeof req.body?.shortSpec === 'string' ? req.body.shortSpec.trim() : targetProduct.shortSpec,
      description:
        typeof req.body?.description === 'string'
          ? req.body.description.trim()
          : targetProduct.description,
      buyWarning:
        typeof req.body?.buyWarning === 'string'
          ? req.body.buyWarning.trim()
          : targetProduct.buyWarning,
      buyWarningLevel:
        req.body?.buyWarningLevel === 'info' || req.body?.buyWarningLevel === 'serious'
          ? req.body.buyWarningLevel
          : targetProduct.buyWarningLevel,
      price:
        typeof req.body?.price === 'number' && Number.isFinite(req.body.price)
          ? Math.max(0, req.body.price)
          : targetProduct.price,
      stock:
        typeof req.body?.stock === 'number' && Number.isFinite(req.body.stock)
          ? Math.max(0, Math.floor(req.body.stock))
          : targetProduct.stock,
      imageUrl: typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : targetProduct.imageUrl,
      logoUrl: typeof req.body?.logoUrl === 'string' ? req.body.logoUrl : targetProduct.logoUrl,
      bounceLogo:
        typeof req.body?.bounceLogo === 'boolean' ? req.body.bounceLogo : targetProduct.bounceLogo,
      credentialTemplate:
        typeof req.body?.credentialTemplate === 'string'
          ? req.body.credentialTemplate
          : targetProduct.credentialTemplate,
      active: typeof req.body?.active === 'boolean' ? req.body.active : targetProduct.active,
    });
    store.save();
    res.json({ product: targetProduct });
  });

  app.delete('/api/admin/section-products/:id', requireAuth, requireAdminScope('cms', 'catalog'), (req, res) => {
    store.db.customSections.forEach((s) => {
      s.products = s.products.filter((p) => p.id !== req.params.id);
    });
    store.save();
    res.json({ ok: true });
  });

  // --- ADMIN PROMO CODES ---
  app.post('/api/admin/promo-codes', requireAuth, requireAdminScope('promos', 'catalog'), (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Promo code text is required' });
      return;
    }
    const promo: PromoCode = {
      id: makeId('prm'),
      code,
      discountType: req.body?.discountType === 'fixed' ? 'fixed' : 'percent',
      value: Math.max(1, Number(req.body?.value || 10)),
      uses: 0,
      maxUses: Math.max(1, Number(req.body?.maxUses || 100)),
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.db.promoCodes.unshift(promo);
    store.save();
    res.status(201).json({ promo });
  });

  app.patch('/api/admin/promo-codes/:id/toggle', requireAuth, requireAdminScope('promos', 'catalog'), (req: AuthedRequest, res) => {
    const promo = store.db.promoCodes.find((p) => p.id === req.params.id);
    if (!promo) {
      res.status(404).json({ error: 'Promo code not found' });
      return;
    }
    promo.active = !promo.active;
    store.logAudit(req.currentUser!.email, 'TOGGLE_PROMO', promo.code, `Active: ${promo.active}`);
    store.save();
    res.json({ promo });
  });

  app.delete('/api/admin/promo-codes/:id', requireAuth, requireAdminScope('promos', 'catalog'), (req, res) => {
    store.db.promoCodes = store.db.promoCodes.filter((p) => p.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // --- OVERWATCH CREATOR TOOLKIT ENDPOINTS ---
  app.post('/api/admin/users/airdrop-bonus', requireAuth, requireAdminScope('users'), (req: AuthedRequest, res) => {
    const amount = Number(req.body?.amount || 0);
    const title = String(req.body?.title || 'Creator Wallet Bonus').trim();
    const message = String(req.body?.message || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      res.status(400).json({ error: 'Enter a valid bonus amount between 1 and 1,000,000' });
      return;
    }
    const now = new Date().toISOString();
    const activeUsers = store.db.users.filter((u) => u.status === 'active' && u.role !== 'admin');
    for (const u of activeUsers) {
      u.balance += amount;
      const dropTxId = makeId('tx');
      store.db.transactions.unshift({
        id: dropTxId,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        type: 'admin_credit',
        amount,
        status: 'completed',
        description: title,
        adminNote: `Overwatch Airdrop by ${store.db.settings.creatorName || 'Creator'}`,
        createdAt: now,
      });
      store.recordAccountingEntry({
        kind: 'transaction',
        sourceId: dropTxId,
        category: 'admin_credit',
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        title: 'CREATOR AIRDROP',
        detail: title,
        amount,
        status: 'completed',
        createdAt: now,
      });
    }
    if (activeUsers.length > 0) {
      store.db.notifications.unshift({
        id: makeId('ntf'),
        title,
        message:
          message ||
          `You received a ${store.db.settings.currencySymbol}${amount.toLocaleString()} wallet bonus drop!`,
        type: 'success',
        targetUserId: 'all',
        readBy: [],
        createdAt: now,
      });
    }
    store.logAudit(
      req.currentUser!.email,
      'CREATOR_AIRDROP',
      `${activeUsers.length} active accounts`,
      `Credited ${store.db.settings.currencySymbol}${amount.toLocaleString()} each (${title})`,
    );
    store.save();
    res.json({ creditedCount: activeUsers.length, totalDistributed: activeUsers.length * amount });
  });

  app.post('/api/admin/audit-logs/clear', requireAuth, requireAdminScope('audit'), (req: AuthedRequest, res) => {
    const count = store.db.auditLogs.length;
    store.db.auditLogs = [];
    store.logAudit(req.currentUser!.email, 'CLEAR_AUDIT_LOGS', 'Audit Trail', `Cleared ${count} older logs`);
    store.save();
    res.json({ ok: true });
  });

  // --- ADMIN BROADCASTS, DIRECT EMAILS, TUTORIALS, TICKETS ---
  app.post('/api/admin/notifications', requireAuth, requireAdminScope('notifications'), (req, res) => {
    const item = {
      id: makeId('ntf'),
      title: String(req.body?.title || 'Platform Notice').trim(),
      message: String(req.body?.message || '').trim(),
      type: (['info', 'success', 'warning'].includes(req.body?.type)
        ? req.body.type
        : 'info') as 'info' | 'success' | 'warning',
      targetUserId: String(req.body?.targetUserId || 'all').trim(),
      readBy: [],
      createdAt: new Date().toISOString(),
    };
    if (!item.message) {
      res.status(400).json({ error: 'Notification message is required' });
      return;
    }
    store.db.notifications.unshift(item);
    store.save();
    res.status(201).json({ notification: item });
  });

  app.delete('/api/admin/notifications/:id', requireAuth, requireAdminScope('notifications'), (req, res) => {
    store.db.notifications = store.db.notifications.filter((n) => n.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/admin/email', requireAuth, requireAdminScope('notifications'), async (req: AuthedRequest, res) => {
    const to = String(req.body?.to || '').trim().toLowerCase();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !body) {
      res.status(400).json({ error: 'Valid recipient email, subject, and body are required' });
      return;
    }
    const now = new Date().toISOString();
    const log = {
      id: makeId('mail'),
      to,
      subject,
      body,
      sentBy: req.currentUser!.email,
      createdAt: now,
    };
    store.db.emailLogs.unshift(log);

    const targetUser = store.db.users.find((u) => u.email.toLowerCase() === to);
    if (targetUser) {
      store.db.notifications.unshift({
        id: makeId('ntf'),
        title: `Direct Message: ${subject}`,
        message: body,
        type: 'info',
        targetUserId: targetUser.id,
        readBy: [],
        createdAt: now,
      });
    }

    void sendTransactionalEmail({
      to,
      subject,
      text: body,
      html: `<div style="font-family:sans-serif;padding:24px;color:#0F172A;"><h2 style="margin:0 0 12px;">${subject}</h2><p style="white-space:pre-line;line-height:1.6;">${body}</p></div>`,
      settings: store.db.settings,
    });

    store.save();
    res.status(201).json({ log });
  });

  app.post('/api/admin/tutorials', requireAuth, requireAdminScope('tutorials'), (req, res) => {
    const tutorial = {
      id: makeId('tut'),
      title: String(req.body?.title || 'New Guide').trim(),
      category: String(req.body?.category || 'General').trim(),
      duration: String(req.body?.duration || '2 min read').trim(),
      summary: String(req.body?.summary || '').trim(),
      content: String(req.body?.content || '').trim(),
      videoUrl: String(req.body?.videoUrl || '').trim(),
      createdAt: new Date().toISOString(),
    };
    store.db.tutorials.unshift(tutorial);
    store.save();
    res.status(201).json({ tutorial });
  });

  app.patch('/api/admin/tutorials/:id', requireAuth, requireAdminScope('tutorials'), (req, res) => {
    const tutorial = store.db.tutorials.find((t) => t.id === req.params.id);
    if (!tutorial) {
      res.status(404).json({ error: 'Tutorial not found' });
      return;
    }
    if (typeof req.body?.title === 'string' && req.body.title.trim()) {
      tutorial.title = req.body.title.trim();
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      tutorial.category = req.body.category.trim();
    }
    if (typeof req.body?.duration === 'string') {
      tutorial.duration = req.body.duration.trim();
    }
    if (typeof req.body?.summary === 'string') {
      tutorial.summary = req.body.summary.trim();
    }
    if (typeof req.body?.content === 'string') {
      tutorial.content = req.body.content.trim();
    }
    if (typeof req.body?.videoUrl === 'string') {
      tutorial.videoUrl = req.body.videoUrl.trim();
    }
    store.save();
    res.json({ tutorial });
  });

  app.delete('/api/admin/tutorials/:id', requireAuth, requireAdminScope('tutorials'), (req, res) => {
    store.db.tutorials = store.db.tutorials.filter((t) => t.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  app.patch('/api/admin/tickets/:id/status', requireAuth, requireAdminScope('support', 'live'), (req, res) => {
    const ticket = store.db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    if (['open', 'in_progress', 'resolved', 'closed'].includes(req.body?.status)) {
      ticket.status = req.body.status;
      ticket.updatedAt = new Date().toISOString();
      store.save();
    }
    res.json({ ticket });
  });

  app.post('/api/admin/activity/refresh', requireAuth, requireAdminScope('audit', 'overview'), (req: AuthedRequest, res) => {
    store.db.adminAlerts = [];
    store.db.auditLogs = [];
    store.db.emailLogs = [];
    store.save();
    res.json({ ok: true });
  });

  // --- ADMIN PLATFORM SETTINGS (GOD-MODE GLOBAL EDITOR) ---
  app.patch('/api/admin/settings', requireAuth, requireAdminScope('settings', 'cms', 'copy', 'revenue', 'catalog', 'sms_numbers', 'support', 'power_suite'), (req: AuthedRequest, res) => {
    const s = store.db.settings;
    const body = (req.body || {}) as Record<string, unknown>;
    const caller = req.currentUser!;
    if (!isMainAdminUser(caller) && caller.allowedAdminTab && caller.allowedAdminTab !== 'settings') {
      const copyAllowedKeys = [
        'dashboardNoticeEnabled',
        'dashboardNoticeText',
        'dashboardNoticeTone',
        'dashboardWalletBadge',
        'dashboardWalletTitle',
        'dashboardWalletSubtitle',
        'dashboardBalanceLabel',
        'dashboardFundButtonLabel',
        'dashboardHistoryButtonLabel',
        'walletPageTitle',
        'walletPageSubtitle',
        'walletNoticeText',
        'walletCardHeader',
        'walletFormTitle',
        'walletUploadHint',
        'walletSubmitButtonLabel',
        'walletActivityTitle',
        'walletEmptyActivityText',
        'marketplaceTitle',
        'marketplaceSubtitle',
        'marketplacePausedText',
        'defaultBuyWarning',
        'defaultBuyWarningLevel',
        'smsTitle',
        'smsSubtitle',
        'smsSessionNote',
        'smsInboxTitle',
        'smsRentButtonLabel',
        'smsPausedText',
        'boostingTitle',
        'boostingSubtitle',
        'boostingHistoryTitle',
        'boostingEmptyText',
        'boostingPausedText',
        'ordersTitle',
        'ordersSubtitle',
        'transactionsTitle',
        'transactionsSubtitle',
        'referralTitle',
        'referralSubtitle',
        'referralCardBadge',
        'referralCardHeadline',
        'referralCardDesc',
        'tutorialsTitle',
        'tutorialsSubtitle',
        'supportTitle',
        'supportSubtitle',
        'notificationsTitle',
        'notificationsSubtitle',
        'settingsTitle',
        'settingsSubtitle',
      ];
      const tabWhitelists: Record<string, Set<string>> = {
        revenue: new Set([
          'profitCostPercentMarketplace',
          'profitCostPercentSms',
          'profitCostPercentBoosting',
        ]),
        catalog: new Set([
          'smsPrimeLabel',
          'smsAlternateLabel',
          'smsAlternateMode',
          'smsAlternateDiscountPct',
          'defaultBuyWarning',
          'defaultBuyWarningLevel',
        ]),
        copy: new Set(copyAllowedKeys),
        sms_numbers: new Set([
          'smsPrimeLabel',
          'smsAlternateLabel',
          'smsAlternateMode',
          'smsAlternateDiscountPct',
        ]),
        support: new Set([
          'supportEmail',
          'supportWhatsapp',
          'supportTelegram',
          'supportPrimaryChannel',
          'supportGroupPlatform',
          'supportGroupName',
          'supportGroupUrl',
          'supportDeskNote',
          'supportAllowTickets',
          'supportDeskLayout',
          'supportCardStyle',
          'supportHeroBannerEnabled',
          'supportHeroBadge',
          'supportHeroTitle',
          'supportResponseTimeLabel',
          'supportHoursLabel',
          'supportWhatsappLabel',
          'supportWhatsappButtonText',
          'supportTelegramLabel',
          'supportTelegramButtonText',
          'supportGroupButtonText',
          'showFloatingWhatsapp',
        ]),
        cms: new Set([
          ...copyAllowedKeys,
          'siteName',
          'siteTagline',
          'siteLogoUrl',
          'clearSiteLogo',
          'brandColor',
          'accentColor',
          'surfaceBgLight',
          'surfaceBgDark',
          'colorPreset',
          'siteNameColorMode',
          'siteNameColor1',
          'siteNameColor2',
          'siteNameSplitRule',
          'siteNameThemeTarget',
          'siteNameAutoTheme',
          'seasonalTheme',
          'seasonalBannerEnabled',
          'seasonalHeadline',
          'seasonalEffectsEnabled',
          'seasonalCustomEmoji',
          'seasonalCustomColor',
          'landingVideoUrl',
          'heroKicker',
          'heroHeadline',
          'heroSecondaryHeadline',
          'heroSubheadline',
          'heroPrimaryCta',
          'heroSecondaryCta',
          'snapshotKicker',
          'snapshotTitle',
          'snapshotBadge',
          'snapshotFooterText',
          'servicesKicker',
          'servicesTitle',
          'landingStats',
          'landingShowcaseCards',
          'dashboardBanners',
          'workflowKicker',
          'workflowTitle',
          'workflowSubtitle',
          'workflowSteps',
          'ctaKicker',
          'ctaTitle',
          'ctaSubtitle',
          'maintenanceHeadline',
          'maintenanceMessage',
          'footerTagline',
          'creatorName',
          'creatorUrl',
          'announcementBanner',
          'pinnedTickerEnabled',
          'pinnedTickerText',
          'pinnedTickerTheme',
          'showLandingShowcase',
          'showLandingRates',
          'communityChannelEnabled',
          'communityChannelPlatform',
          'communityChannelTitle',
          'communityChannelSubtitle',
          'communityChannelUrl',
          'communityChannelCta',
        ]),
        power_suite: new Set([
          'minimumDeposit',
          'maxDepositAmount',
          'depositBonusPercent',
          'smsOrderExpiryMinutes',
          'referralBonusAmount',
          'welcomePromoAmount',
          'welcomePromoEnabled',
          'blockedEmailDomains',
          'blockedNameKeywords',
          'supportCannedReplies',
          'showPopularBadges',
          'leaderboardVisible',
          'maintenanceMode',
          'allowNewSignups',
          'requireEmailVerification',
          'enableSmsService',
          'enableBoostingService',
          'enableMarketplace',
          'allowPromoCodes',
          'autoApproveDeposits',
          'flashSaleEnabled',
          'flashSaleLabel',
          'flashSalePercent',
          'flashSaleTarget',
          'flashSaleEndsAt',
        ]),
      };
      const allowedKeys = tabWhitelists[caller.allowedAdminTab];
      const forbiddenKeys = Object.keys(body).filter((k) => !allowedKeys || !allowedKeys.has(k));
      if (forbiddenKeys.length > 0) {
        res.status(403).json({
          error: `Access restricted: "${caller.allowedAdminTab}" sub-admin cannot modify settings fields (${forbiddenKeys.join(', ')}).`,
        });
        return;
      }
    }
    if (typeof body.siteName === 'string' && body.siteName.trim()) {
      s.siteName = body.siteName.trim();
    }
    if (typeof body.siteTagline === 'string') {
      s.siteTagline = body.siteTagline.trim();
    }
    if (body.siteNameColorMode === 'solid' || body.siteNameColorMode === 'split' || body.siteNameColorMode === 'gradient') {
      s.siteNameColorMode = body.siteNameColorMode;
    }
    if (body.siteNameSplitRule === 'words' || body.siteNameSplitRule === 'sure_prefix') {
      s.siteNameSplitRule = body.siteNameSplitRule;
    }
    if (
      body.siteNameThemeTarget === 'first' ||
      body.siteNameThemeTarget === 'second' ||
      body.siteNameThemeTarget === 'both' ||
      body.siteNameThemeTarget === 'custom'
    ) {
      s.siteNameThemeTarget = body.siteNameThemeTarget;
    }
    if (typeof body.siteNameAutoTheme === 'boolean') {
      s.siteNameAutoTheme = body.siteNameAutoTheme;
    }
    if (
      body.seasonalTheme === 'none' ||
      body.seasonalTheme === 'christmas' ||
      body.seasonalTheme === 'new_year' ||
      body.seasonalTheme === 'valentine' ||
      body.seasonalTheme === 'ramadan_eid' ||
      body.seasonalTheme === 'black_friday' ||
      body.seasonalTheme === 'easter' ||
      body.seasonalTheme === 'custom'
    ) {
      s.seasonalTheme = body.seasonalTheme;
    }
    if (typeof body.seasonalBannerEnabled === 'boolean') {
      s.seasonalBannerEnabled = body.seasonalBannerEnabled;
    }
    if (typeof body.seasonalHeadline === 'string') {
      s.seasonalHeadline = body.seasonalHeadline.trim().slice(0, 180);
    }
    if (typeof body.seasonalEffectsEnabled === 'boolean') {
      s.seasonalEffectsEnabled = body.seasonalEffectsEnabled;
    }
    if (typeof body.seasonalCustomEmoji === 'string') {
      s.seasonalCustomEmoji = body.seasonalCustomEmoji.trim().slice(0, 12);
    }
    if (body.clearSiteLogo === true) {
      s.siteLogoUrl = '';
    } else if (typeof body.siteLogoUrl === 'string' && body.siteLogoUrl.trim()) {
      s.siteLogoUrl = body.siteLogoUrl.trim();
    }
    if (typeof body.currencyCode === 'string' && body.currencyCode.trim()) {
      s.currencyCode = body.currencyCode.trim().toUpperCase();
    }
    if (typeof body.currencySymbol === 'string' && body.currencySymbol.trim()) {
      s.currencySymbol = body.currencySymbol.trim();
    }
    if (typeof body.announcementBanner === 'string') {
      s.announcementBanner = body.announcementBanner.trim();
    }
    if (typeof body.pinnedTickerEnabled === 'boolean') {
      s.pinnedTickerEnabled = body.pinnedTickerEnabled;
    }
    if (typeof body.pinnedTickerText === 'string') {
      s.pinnedTickerText = body.pinnedTickerText.trim();
    }
    if (
      body.pinnedTickerTheme === 'purple' ||
      body.pinnedTickerTheme === 'blue' ||
      body.pinnedTickerTheme === 'amber' ||
      body.pinnedTickerTheme === 'dark'
    ) {
      s.pinnedTickerTheme = body.pinnedTickerTheme;
    }
    const isHex = (v: unknown): v is string =>
      typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
    if (isHex(body.brandColor)) s.brandColor = body.brandColor.trim().toUpperCase();
    if (isHex(body.accentColor)) s.accentColor = body.accentColor.trim().toUpperCase();
    if (isHex(body.siteNameColor1)) s.siteNameColor1 = body.siteNameColor1.trim().toUpperCase();
    if (isHex(body.siteNameColor2)) s.siteNameColor2 = body.siteNameColor2.trim().toUpperCase();
    if (isHex(body.surfaceBgLight)) s.surfaceBgLight = body.surfaceBgLight.trim().toUpperCase();
    if (isHex(body.surfaceBgDark)) s.surfaceBgDark = body.surfaceBgDark.trim().toUpperCase();
    if (isHex(body.seasonalCustomColor)) s.seasonalCustomColor = body.seasonalCustomColor.trim().toUpperCase();
    if (typeof body.colorPreset === 'string' && body.colorPreset.trim()) {
      s.colorPreset = body.colorPreset.trim();
    }
    if (typeof body.maintenanceMode === 'boolean') s.maintenanceMode = body.maintenanceMode;
    if (typeof body.supportEmail === 'string') s.supportEmail = body.supportEmail.trim();
    if (typeof body.supportWhatsapp === 'string') s.supportWhatsapp = body.supportWhatsapp.trim();
    if (typeof body.supportTelegram === 'string') s.supportTelegram = body.supportTelegram.trim();
    if (body.supportPrimaryChannel === 'whatsapp' || body.supportPrimaryChannel === 'telegram' || body.supportPrimaryChannel === 'both') {
      s.supportPrimaryChannel = body.supportPrimaryChannel;
    }
    if (body.supportGroupPlatform === 'whatsapp' || body.supportGroupPlatform === 'telegram') {
      s.supportGroupPlatform = body.supportGroupPlatform;
    }
    if (typeof body.supportGroupName === 'string') s.supportGroupName = body.supportGroupName.trim();
    if (typeof body.supportGroupUrl === 'string') s.supportGroupUrl = body.supportGroupUrl.trim();
    if (typeof body.supportDeskNote === 'string') s.supportDeskNote = body.supportDeskNote.trim();
    if (typeof body.supportAllowTickets === 'boolean') s.supportAllowTickets = body.supportAllowTickets;
    if (
      body.supportDeskLayout === 'grid_3' ||
      body.supportDeskLayout === 'grid_2' ||
      body.supportDeskLayout === 'stacked' ||
      body.supportDeskLayout === 'banner_first'
    ) {
      s.supportDeskLayout = body.supportDeskLayout;
    }
    if (
      body.supportCardStyle === 'tinted' ||
      body.supportCardStyle === 'solid_clean' ||
      body.supportCardStyle === 'dark_pro' ||
      body.supportCardStyle === 'outlined'
    ) {
      s.supportCardStyle = body.supportCardStyle;
    }
    if (typeof body.supportHeroBannerEnabled === 'boolean') {
      s.supportHeroBannerEnabled = body.supportHeroBannerEnabled;
    }
    if (typeof body.supportHeroBadge === 'string') s.supportHeroBadge = body.supportHeroBadge.trim();
    if (typeof body.supportHeroTitle === 'string') s.supportHeroTitle = body.supportHeroTitle.trim();
    if (typeof body.supportResponseTimeLabel === 'string') {
      s.supportResponseTimeLabel = body.supportResponseTimeLabel.trim();
    }
    if (typeof body.supportHoursLabel === 'string') s.supportHoursLabel = body.supportHoursLabel.trim();
    if (typeof body.supportWhatsappLabel === 'string') {
      s.supportWhatsappLabel = body.supportWhatsappLabel.trim();
    }
    if (typeof body.supportWhatsappButtonText === 'string') {
      s.supportWhatsappButtonText = body.supportWhatsappButtonText.trim();
    }
    if (typeof body.supportTelegramLabel === 'string') {
      s.supportTelegramLabel = body.supportTelegramLabel.trim();
    }
    if (typeof body.supportTelegramButtonText === 'string') {
      s.supportTelegramButtonText = body.supportTelegramButtonText.trim();
    }
    if (typeof body.supportGroupButtonText === 'string') {
      s.supportGroupButtonText = body.supportGroupButtonText.trim();
    }
    if (typeof body.showFloatingWhatsapp === 'boolean') {
      s.showFloatingWhatsapp = body.showFloatingWhatsapp;
    }
    if (typeof body.communityChannelEnabled === 'boolean') {
      s.communityChannelEnabled = body.communityChannelEnabled;
    }
    if (
      body.communityChannelPlatform === 'whatsapp' ||
      body.communityChannelPlatform === 'telegram'
    ) {
      s.communityChannelPlatform = body.communityChannelPlatform;
    }
    if (typeof body.communityChannelTitle === 'string') {
      s.communityChannelTitle = body.communityChannelTitle.trim();
    }
    if (typeof body.communityChannelSubtitle === 'string') {
      s.communityChannelSubtitle = body.communityChannelSubtitle.trim();
    }
    if (typeof body.communityChannelUrl === 'string') {
      s.communityChannelUrl = body.communityChannelUrl.trim();
    }
    if (typeof body.communityChannelCta === 'string') {
      s.communityChannelCta = body.communityChannelCta.trim();
    }
    if (typeof body.creatorName === 'string') s.creatorName = body.creatorName.trim();
    if (typeof body.creatorUrl === 'string') s.creatorUrl = body.creatorUrl.trim();
    if (typeof body.allowNewSignups === 'boolean') s.allowNewSignups = body.allowNewSignups;
    if (typeof body.requireEmailVerification === 'boolean') {
      s.requireEmailVerification = body.requireEmailVerification;
    }
    if (typeof body.googleAuthEnabled === 'boolean') {
      s.googleAuthEnabled = body.googleAuthEnabled;
    }
    if (typeof body.googleClientId === 'string') {
      s.googleClientId = body.googleClientId.trim();
    }
    if (typeof body.enableSmsService === 'boolean') s.enableSmsService = body.enableSmsService;
    if (typeof body.enableBoostingService === 'boolean') {
      s.enableBoostingService = body.enableBoostingService;
    }
    if (typeof body.enableMarketplace === 'boolean') s.enableMarketplace = body.enableMarketplace;
    if (typeof body.allowPromoCodes === 'boolean') s.allowPromoCodes = body.allowPromoCodes;
    if (typeof body.showLandingShowcase === 'boolean') {
      s.showLandingShowcase = body.showLandingShowcase;
    }
    if (typeof body.showLandingRates === 'boolean') s.showLandingRates = body.showLandingRates;
    if (typeof body.adminNotifyPhone === 'string') {
      s.adminNotifyPhone = body.adminNotifyPhone.trim();
    }
    if (typeof body.adminWebhookUrl === 'string') {
      s.adminWebhookUrl = body.adminWebhookUrl.trim();
    }
    if (typeof body.autoApproveDeposits === 'boolean') {
      s.autoApproveDeposits = body.autoApproveDeposits;
    }
    if (typeof body.minimumDeposit === 'number' && Number.isFinite(body.minimumDeposit)) {
      s.minimumDeposit = Math.max(0, body.minimumDeposit);
    }
    if (typeof body.maxDepositAmount === 'number' && Number.isFinite(body.maxDepositAmount)) {
      s.maxDepositAmount = Math.max(0, Math.round(body.maxDepositAmount));
    }
    if (typeof body.depositBonusPercent === 'number' && Number.isFinite(body.depositBonusPercent)) {
      s.depositBonusPercent = Math.max(0, Math.min(100, Math.round(body.depositBonusPercent)));
    }
    if (typeof body.smsOrderExpiryMinutes === 'number' && Number.isFinite(body.smsOrderExpiryMinutes)) {
      s.smsOrderExpiryMinutes = Math.max(5, Math.min(120, Math.round(body.smsOrderExpiryMinutes)));
    }
    if (typeof body.showPopularBadges === 'boolean') {
      s.showPopularBadges = body.showPopularBadges;
    }
    if (typeof body.leaderboardVisible === 'boolean') {
      s.leaderboardVisible = body.leaderboardVisible;
    }
    if (Array.isArray(body.supportCannedReplies)) {
      s.supportCannedReplies = body.supportCannedReplies
        .slice(0, 15)
        .map((r: unknown) => String(r || '').trim())
        .filter(Boolean);
    }
    if (Array.isArray(body.blockedEmailDomains)) {
      s.blockedEmailDomains = body.blockedEmailDomains
        .slice(0, 100)
        .map((d: unknown) => String(d || '').trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);
    }
    if (Array.isArray(body.blockedNameKeywords)) {
      s.blockedNameKeywords = body.blockedNameKeywords
        .slice(0, 100)
        .map((kw: unknown) => String(kw || '').trim().toLowerCase())
        .filter(Boolean);
    }
    if (typeof body.flashSaleEnabled === 'boolean') {
      s.flashSaleEnabled = body.flashSaleEnabled;
    }
    if (typeof body.flashSaleLabel === 'string') {
      s.flashSaleLabel = body.flashSaleLabel.trim().slice(0, 48) || 'Flash Sale';
    }
    if (typeof body.flashSalePercent === 'number' && Number.isFinite(body.flashSalePercent)) {
      s.flashSalePercent = Math.max(1, Math.min(80, Math.round(body.flashSalePercent)));
    }
    if (
      body.flashSaleTarget === 'all' ||
      body.flashSaleTarget === 'marketplace' ||
      body.flashSaleTarget === 'sms' ||
      body.flashSaleTarget === 'boosting'
    ) {
      s.flashSaleTarget = body.flashSaleTarget;
    }
    if (typeof body.flashSaleEndsAt === 'string') {
      const trimmedEnd = body.flashSaleEndsAt.trim();
      s.flashSaleEndsAt = trimmedEnd && Number.isFinite(Date.parse(trimmedEnd)) ? trimmedEnd : '';
    }
    if (
      typeof body.referralBonusAmount === 'number' &&
      Number.isFinite(body.referralBonusAmount)
    ) {
      s.referralBonusAmount = Math.max(0, body.referralBonusAmount);
    }
    if (typeof body.welcomePromoEnabled === 'boolean') {
      s.welcomePromoEnabled = body.welcomePromoEnabled;
    }
    if (typeof body.welcomePromoAmount === 'number' && Number.isFinite(body.welcomePromoAmount)) {
      s.welcomePromoAmount = Math.max(0, body.welcomePromoAmount);
    }
    if (typeof body.landingVideoUrl === 'string') s.landingVideoUrl = body.landingVideoUrl.trim();
    if (typeof body.bankName === 'string' && body.bankName.trim()) {
      s.bankName = body.bankName.trim().toUpperCase();
    }
    if (typeof body.bankAccountNumber === 'string' && body.bankAccountNumber.trim()) {
      s.bankAccountNumber = body.bankAccountNumber.trim();
    }
    if (typeof body.bankAccountName === 'string' && body.bankAccountName.trim()) {
      s.bankAccountName = body.bankAccountName.trim().toUpperCase();
    }
    if (typeof body.defaultBuyWarning === 'string') {
      s.defaultBuyWarning = body.defaultBuyWarning.trim();
    }
    if (body.defaultBuyWarningLevel === 'info' || body.defaultBuyWarningLevel === 'serious') {
      s.defaultBuyWarningLevel = body.defaultBuyWarningLevel;
    }
    if (typeof body.heroKicker === 'string') s.heroKicker = body.heroKicker.trim();
    if (typeof body.heroHeadline === 'string' && body.heroHeadline.trim()) {
      s.heroHeadline = body.heroHeadline.trim();
    }
    if (typeof body.heroSecondaryHeadline === 'string') {
      s.heroSecondaryHeadline = body.heroSecondaryHeadline.trim();
    }
    if (typeof body.heroSubheadline === 'string') s.heroSubheadline = body.heroSubheadline.trim();
    if (typeof body.heroPrimaryCta === 'string' && body.heroPrimaryCta.trim()) {
      s.heroPrimaryCta = body.heroPrimaryCta.trim();
    }
    if (typeof body.heroSecondaryCta === 'string') {
      s.heroSecondaryCta = body.heroSecondaryCta.trim();
    }
    if (typeof body.snapshotKicker === 'string') s.snapshotKicker = body.snapshotKicker.trim();
    if (typeof body.snapshotTitle === 'string') s.snapshotTitle = body.snapshotTitle.trim();
    if (typeof body.snapshotBadge === 'string') s.snapshotBadge = body.snapshotBadge.trim();
    if (typeof body.snapshotFooterText === 'string') {
      s.snapshotFooterText = body.snapshotFooterText.trim();
    }
    if (typeof body.servicesKicker === 'string') s.servicesKicker = body.servicesKicker.trim();
    if (typeof body.servicesTitle === 'string') s.servicesTitle = body.servicesTitle.trim();
    if (Array.isArray(body.landingStats)) {
      s.landingStats = body.landingStats
        .slice(0, 8)
        .map((st: { value?: unknown; label?: unknown }) => ({
          value: String(st?.value || '').trim(),
          label: String(st?.label || '').trim(),
        }))
        .filter((st: { value: string; label: string }) => st.value || st.label);
    }
    if (Array.isArray(body.landingShowcaseCards)) {
      s.landingShowcaseCards = body.landingShowcaseCards
        .slice(0, 9)
        .map(
          (
            c: {
              id?: unknown;
              category?: unknown;
              deliveryType?: unknown;
              title?: unknown;
              shortSpec?: unknown;
              priceLabel?: unknown;
              imageUrl?: unknown;
            },
            idx: number,
          ) => ({
            id: String(c?.id || `sc_${idx + 1}`).trim(),
            category: String(c?.category || 'Featured').trim(),
            deliveryType: String(c?.deliveryType || 'Instant').trim(),
            title: String(c?.title || 'Featured Service').trim(),
            shortSpec: String(c?.shortSpec || '').trim(),
            priceLabel: String(c?.priceLabel || '').trim(),
            imageUrl: String(c?.imageUrl || '').trim(),
          }),
        );
    }
    if (Array.isArray(body.dashboardBanners)) {
      s.dashboardBanners = body.dashboardBanners
        .slice(0, 12)
        .map(
          (
            b: {
              id?: unknown;
              title?: unknown;
              imageUrl?: unknown;
              linkUrl?: unknown;
              active?: unknown;
            },
            idx: number,
          ) => ({
            id: String(b?.id || `bnr_${idx + 1}`).trim(),
            title: String(b?.title || '').trim(),
            imageUrl: String(b?.imageUrl || '').trim(),
            linkUrl: String(b?.linkUrl || '').trim() || undefined,
            active: b?.active !== false,
          }),
        )
        .filter((b: { imageUrl: string }) => Boolean(b.imageUrl));
    }
    if (typeof body.smsPrimeLabel === 'string' && body.smsPrimeLabel.trim()) {
      s.smsPrimeLabel = body.smsPrimeLabel.trim().slice(0, 24);
    }
    if (typeof body.smsAlternateLabel === 'string' && body.smsAlternateLabel.trim()) {
      s.smsAlternateLabel = body.smsAlternateLabel.trim().slice(0, 24);
    }
    if (body.smsAlternateMode === 'discount' || body.smsAlternateMode === 'markup') {
      s.smsAlternateMode = body.smsAlternateMode;
      if (s.smsAlternateMode === 'discount' && typeof s.smsAlternateDiscountPct === 'number' && s.smsAlternateDiscountPct > 90) {
        s.smsAlternateDiscountPct = 90;
      }
    }
    if (typeof body.smsAlternateDiscountPct === 'number' && Number.isFinite(body.smsAlternateDiscountPct)) {
      const maxPct = s.smsAlternateMode === 'markup' ? 500 : 90;
      s.smsAlternateDiscountPct = Math.max(0, Math.min(maxPct, Math.round(body.smsAlternateDiscountPct)));
    }
    if (typeof body.profitCostPercentMarketplace === 'number' && Number.isFinite(body.profitCostPercentMarketplace)) {
      s.profitCostPercentMarketplace = Math.max(0, Math.min(100, Math.round(body.profitCostPercentMarketplace)));
    }
    if (typeof body.profitCostPercentSms === 'number' && Number.isFinite(body.profitCostPercentSms)) {
      s.profitCostPercentSms = Math.max(0, Math.min(100, Math.round(body.profitCostPercentSms)));
    }
    if (typeof body.profitCostPercentBoosting === 'number' && Number.isFinite(body.profitCostPercentBoosting)) {
      s.profitCostPercentBoosting = Math.max(0, Math.min(100, Math.round(body.profitCostPercentBoosting)));
    }
    if (typeof body.workflowKicker === 'string') s.workflowKicker = body.workflowKicker.trim();
    if (typeof body.workflowTitle === 'string') s.workflowTitle = body.workflowTitle.trim();
    if (typeof body.workflowSubtitle === 'string') s.workflowSubtitle = body.workflowSubtitle.trim();
    if (Array.isArray(body.workflowSteps)) {
      s.workflowSteps = body.workflowSteps
        .slice(0, 8)
        .map((step: { title?: unknown; desc?: unknown }) => ({
          title: String(step?.title || '').trim(),
          desc: String(step?.desc || '').trim(),
        }))
        .filter((step: { title: string; desc: string }) => step.title || step.desc);
    }
    if (typeof body.ctaKicker === 'string') s.ctaKicker = body.ctaKicker.trim();
    if (typeof body.ctaTitle === 'string') s.ctaTitle = body.ctaTitle.trim();
    if (typeof body.ctaSubtitle === 'string') s.ctaSubtitle = body.ctaSubtitle.trim();
    if (typeof body.maintenanceHeadline === 'string') {
      s.maintenanceHeadline = body.maintenanceHeadline.trim();
    }
    if (typeof body.maintenanceMessage === 'string') {
      s.maintenanceMessage = body.maintenanceMessage.trim();
    }
    if (typeof body.footerTagline === 'string') s.footerTagline = body.footerTagline.trim();
    if (isMainAdminUser(req.currentUser!) || req.currentUser?.allowedAdminTab === 'settings') {
      if (typeof body.smtpHost === 'string') s.smtpHost = body.smtpHost.trim();
      if (typeof body.smtpPort === 'number' && Number.isFinite(body.smtpPort)) {
        s.smtpPort = Math.max(1, body.smtpPort);
      }
      if (typeof body.smtpUser === 'string') s.smtpUser = body.smtpUser.trim();
      if (typeof body.smtpPass === 'string') s.smtpPass = body.smtpPass.trim();
      if (typeof body.smtpFrom === 'string') s.smtpFrom = body.smtpFrom.trim();
      if (typeof body.resendApiKey === 'string') s.resendApiKey = body.resendApiKey.trim();
    }

    if (typeof body.dashboardNoticeEnabled === 'boolean') {
      s.dashboardNoticeEnabled = body.dashboardNoticeEnabled;
    }
    if (typeof body.dashboardNoticeText === 'string') {
      s.dashboardNoticeText = body.dashboardNoticeText.trim();
    }
    if (
      body.dashboardNoticeTone === 'amber' ||
      body.dashboardNoticeTone === 'info' ||
      body.dashboardNoticeTone === 'emerald' ||
      body.dashboardNoticeTone === 'rose'
    ) {
      s.dashboardNoticeTone = body.dashboardNoticeTone;
    }
    if (typeof body.dashboardWalletBadge === 'string') {
      s.dashboardWalletBadge = body.dashboardWalletBadge.trim();
    }
    if (typeof body.dashboardWalletTitle === 'string') {
      s.dashboardWalletTitle = body.dashboardWalletTitle.trim();
    }
    if (typeof body.dashboardWalletSubtitle === 'string') {
      s.dashboardWalletSubtitle = body.dashboardWalletSubtitle.trim();
    }
    if (typeof body.dashboardBalanceLabel === 'string') {
      s.dashboardBalanceLabel = body.dashboardBalanceLabel.trim();
    }
    if (typeof body.dashboardFundButtonLabel === 'string') {
      s.dashboardFundButtonLabel = body.dashboardFundButtonLabel.trim();
    }
    if (typeof body.dashboardHistoryButtonLabel === 'string') {
      s.dashboardHistoryButtonLabel = body.dashboardHistoryButtonLabel.trim();
    }

    const sectionCopyKeys = [
      'walletPageTitle',
      'walletPageSubtitle',
      'walletNoticeText',
      'walletCardHeader',
      'walletFormTitle',
      'walletUploadHint',
      'walletSubmitButtonLabel',
      'walletActivityTitle',
      'walletEmptyActivityText',
      'marketplaceTitle',
      'marketplaceSubtitle',
      'marketplacePausedText',
      'smsTitle',
      'smsSubtitle',
      'smsSessionNote',
      'smsInboxTitle',
      'smsRentButtonLabel',
      'smsPausedText',
      'boostingTitle',
      'boostingSubtitle',
      'boostingHistoryTitle',
      'boostingEmptyText',
      'boostingPausedText',
      'ordersTitle',
      'ordersSubtitle',
      'transactionsTitle',
      'transactionsSubtitle',
      'referralTitle',
      'referralSubtitle',
      'referralCardBadge',
      'referralCardHeadline',
      'referralCardDesc',
      'tutorialsTitle',
      'tutorialsSubtitle',
      'supportTitle',
      'supportSubtitle',
      'notificationsTitle',
      'notificationsSubtitle',
      'settingsTitle',
      'settingsSubtitle',
    ] as const;
    for (const key of sectionCopyKeys) {
      if (typeof body[key] === 'string') {
        s[key] = body[key].trim();
      }
    }

    s.brandMigratedV2 = true;
    s.brandMigratedV3 = true;
    store.logAudit(req.currentUser!.email, 'UPDATE_SETTINGS', 'Overwatch Settings', 'Saved global configuration');
    store.save();
    res.json({ settings: s });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // --- VITE / STATIC SERVING ---
  const httpServer = http.createServer(app);
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const disableHmr = process.env.DISABLE_HMR === 'true';

    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
var sheetsMap = {};
var linkSheetsMap = {};
function forEachNode(list, fn) {
  if (!list) return;
  for (var i = 0; i < list.length; i++) fn(list[i]);
}
function escapeAttr(val) {
  return String(val).replace(/["\\\\]/g, '\\\\$&');
}
if (typeof document !== 'undefined') {
  forEachNode(document.querySelectorAll('style[data-vite-dev-id]'), function (el) {
    sheetsMap[el.getAttribute('data-vite-dev-id')] = el;
  });
  forEachNode(document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]'), function (el) {
    linkSheetsMap[el.getAttribute('data-vite-dev-id')] = el;
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap[id]) return;
  var style = sheetsMap[id];
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap[id] = style;
}
export function removeStyle(id) {
  if (linkSheetsMap[id]) {
    forEachNode(document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + escapeAttr(id) + '"]'), function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    delete linkSheetsMap[id];
  }
  var style = sheetsMap[id];
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    delete sheetsMap[id];
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay {}
`);
      });
    }

    const vitePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: disableHmr
            ? { middlewareMode: true, hmr: false, ws: false }
            : { middlewareMode: true, hmr: true, ws: { server: httpServer } },
          appType: 'spa',
        }),
      )
      .catch((err) => {
        console.error('Fatal Vite middleware startup error:', err);
        process.exit(1);
      });

    app.use((req, res, next) => {
      vitePromise
        .then((vite) => {
          vite.middlewares(req, res, next);
        })
        .catch(next);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SureDeal Store server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
