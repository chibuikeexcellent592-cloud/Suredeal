import type { DatabaseState, StoredUser } from '../shared/dbTypes.ts';
import {
  createInitialDatabaseState,
  HEAD_ADMIN_DEFAULT_PASSWORD,
  HEAD_ADMIN_EMAIL,
  HEAD_ADMIN_NAME,
  HEAD_ADMIN_REFERRAL_CODE,
  mergeParsedDatabaseState,
} from '../shared/initialData.ts';
import type {
  AdminAlert,
  BoostingService,
  CustomSection,
  CustomSectionProduct,
  MarketplaceListing,
  PlatformSettings,
  PromoCode,
  PublicUser,
  SmsCountry,
  SmsService,
} from '../src/types.ts';
import { verifyMoniepointReceiptWithAiWeb } from './ai.ts';
import {
  base64ToBytes,
  buildCredentialFromTemplateWeb,
  hashPasswordWeb,
  makeId,
  randomHex,
  signTokenWeb,
  verifyPasswordWeb,
  verifyTokenWeb,
} from './crypto.ts';
import { sendTransactionalEmailWeb } from './mailer.ts';

export interface SqlStorageCursor {
  toArray(): Array<Record<string, unknown>>;
}

export interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): SqlStorageCursor;
}

export interface DurableObjectStorageLike {
  sql: SqlStorage;
  setAlarm(scheduledTime: number | Date): Promise<void> | void;
  getAlarm(): Promise<number | null>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  waitUntil(promise: Promise<unknown>): void;
}

export interface WorkerEnv {
  ASSETS: {
    fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
  };
  STORE_DO?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: Request | string, init?: RequestInit): Promise<Response> };
  };
  API_ORIGIN?: string;
  SESSION_SECRET?: string;
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
  CORS_ORIGIN?: string;
}

const STATE_KEYS: Array<keyof DatabaseState> = [
  'settings',
  'users',
  'pendingSignups',
  'smsCountries',
  'smsServices',
  'smsPool',
  'smsOrders',
  'boostingServices',
  'boostingOrders',
  'marketplaceCategories',
  'marketplaceListings',
  'vaultItems',
  'customSections',
  'transactions',
  'notifications',
  'emailLogs',
  'tutorials',
  'tickets',
  'adminAlerts',
  'adminPhoneAlerts',
  'promoCodes',
  'auditLogs',
];

const CHUNK_CHAR_LIMIT = 450_000;
const UPLOAD_CHUNK_BYTES = 512 * 1024;

function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

function getCorsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const allowedOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const reqOrigin = request.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
    'access-control-max-age': '86400',
  };
  if (allowedOrigins.length === 0) {
    headers['access-control-allow-origin'] = '*';
  } else if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
    headers['access-control-allow-origin'] = reqOrigin;
    headers.vary = 'Origin';
  }
  return headers;
}

function jsonResponse(
  data: unknown,
  status: number,
  request: Request,
  env: WorkerEnv,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...getCorsHeaders(request, env),
    },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('INVALID_JSON_BODY');
  }
}

export class SureDealStoreDO {
  private ctx: DurableObjectStateLike;
  private env: WorkerEnv;
  private state: DatabaseState | null = null;
  private sessionSecret: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(ctx: DurableObjectStateLike, env: WorkerEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  private ensureSchema(): void {
    const sql = this.ctx.storage.sql;
    sql.exec(
      'CREATE TABLE IF NOT EXISTS kv_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS kv_chunks (key TEXT NOT NULL, idx INTEGER NOT NULL, chunk TEXT NOT NULL, PRIMARY KEY (key, idx))',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS uploads_meta (name TEXT PRIMARY KEY, mime TEXT NOT NULL, chunks INTEGER NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS uploads_chunks (name TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (name, idx))',
    );
  }

  private readKvRaw(key: string): string | null {
    const sql = this.ctx.storage.sql;
    const rows = sql.exec('SELECT value FROM kv_state WHERE key = ?', key).toArray();
    if (rows.length === 0) return null;
    const val = String(rows[0].value ?? '');
    if (val === '__CHUNKED__') {
      const chunkRows = sql
        .exec('SELECT chunk FROM kv_chunks WHERE key = ? ORDER BY idx ASC', key)
        .toArray();
      return chunkRows.map((r) => String(r.chunk ?? '')).join('');
    }
    return val;
  }

  private writeKvRaw(key: string, serialized: string): void {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM kv_chunks WHERE key = ?', key);
    if (serialized.length <= CHUNK_CHAR_LIMIT) {
      sql.exec(
        'INSERT OR REPLACE INTO kv_state (key, value) VALUES (?, ?)',
        key,
        serialized,
      );
      return;
    }
    sql.exec('INSERT OR REPLACE INTO kv_state (key, value) VALUES (?, ?)', key, '__CHUNKED__');
    let idx = 0;
    for (let offset = 0; offset < serialized.length; offset += CHUNK_CHAR_LIMIT) {
      const slice = serialized.slice(offset, offset + CHUNK_CHAR_LIMIT);
      sql.exec(
        'INSERT INTO kv_chunks (key, idx, chunk) VALUES (?, ?, ?)',
        key,
        idx,
        slice,
      );
      idx += 1;
    }
  }

  private saveUploadBytes(name: string, mime: string, bytes: Uint8Array): void {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM uploads_chunks WHERE name = ?', name);
    const chunks = Math.max(1, Math.ceil(bytes.byteLength / UPLOAD_CHUNK_BYTES));
    sql.exec(
      'INSERT OR REPLACE INTO uploads_meta (name, mime, chunks) VALUES (?, ?, ?)',
      name,
      mime,
      chunks,
    );
    for (let i = 0; i < chunks; i += 1) {
      const start = i * UPLOAD_CHUNK_BYTES;
      const end = Math.min(bytes.byteLength, start + UPLOAD_CHUNK_BYTES);
      const part = bytes.slice(start, end);
      sql.exec(
        'INSERT INTO uploads_chunks (name, idx, data) VALUES (?, ?, ?)',
        name,
        i,
        part,
      );
    }
  }

  private readUploadBytes(name: string): { mime: string; bytes: Uint8Array } | null {
    const sql = this.ctx.storage.sql;
    const metaRows = sql
      .exec('SELECT mime, chunks FROM uploads_meta WHERE name = ?', name)
      .toArray();
    if (metaRows.length === 0) return null;
    const mime = String(metaRows[0].mime || 'application/octet-stream');
    const chunkRows = sql
      .exec('SELECT data FROM uploads_chunks WHERE name = ? ORDER BY idx ASC', name)
      .toArray();
    const parts: Uint8Array[] = [];
    let totalLen = 0;
    for (const row of chunkRows) {
      const raw = row.data;
      let u8: Uint8Array;
      if (raw instanceof Uint8Array) {
        u8 = raw;
      } else if (raw instanceof ArrayBuffer) {
        u8 = new Uint8Array(raw);
      } else if (ArrayBuffer.isView(raw)) {
        u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      } else {
        u8 = new Uint8Array(0);
      }
      parts.push(u8);
      totalLen += u8.byteLength;
    }
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }
    return { mime, bytes: combined };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.state && this.sessionSecret) return;
    if (!this.initPromise) {
      this.initPromise = this.loadState().finally(() => {
        this.initPromise = null;
      });
    }
    await this.initPromise;
  }

  private async loadState(): Promise<void> {
    this.ensureSchema();

    const envSecret = (this.env.SESSION_SECRET || '').trim();
    if (envSecret) {
      this.sessionSecret = envSecret;
    } else {
      const storedSecret = this.readKvRaw('__session_secret__');
      if (storedSecret && storedSecret.length >= 16) {
        this.sessionSecret = storedSecret;
      } else {
        this.sessionSecret = randomHex(32);
        this.writeKvRaw('__session_secret__', this.sessionSecret);
      }
    }

    const parsed: Partial<DatabaseState> = {};
    let hasAnyKey = false;
    for (const key of STATE_KEYS) {
      const raw = this.readKvRaw(key);
      if (raw !== null) {
        hasAnyKey = true;
        try {
          (parsed as Record<string, unknown>)[key] = JSON.parse(raw);
        } catch (err) {
          console.error(`Corrupt SQLite state key "${key}":`, err);
        }
      }
    }

    const adminHash = await hashPasswordWeb(HEAD_ADMIN_DEFAULT_PASSWORD);
    const db = hasAnyKey
      ? mergeParsedDatabaseState(parsed, adminHash)
      : createInitialDatabaseState(adminHash);

    const existingHeadAdmin = db.users.find(
      (u) => u.email.toLowerCase() === HEAD_ADMIN_EMAIL.toLowerCase(),
    );
    let dirty = !hasAnyKey;

    if (!existingHeadAdmin) {
      db.users.unshift({
        id: 'usr_head_admin',
        name: HEAD_ADMIN_NAME,
        email: HEAD_ADMIN_EMAIL,
        passwordHash: adminHash,
        role: 'admin',
        balance: 250000,
        status: 'active',
        referralCode: HEAD_ADMIN_REFERRAL_CODE,
        createdAt: new Date().toISOString(),
      });
      dirty = true;
    } else {
      if (existingHeadAdmin.role !== 'admin' || existingHeadAdmin.status !== 'active') {
        existingHeadAdmin.role = 'admin';
        existingHeadAdmin.status = 'active';
        dirty = true;
      }
      if (!existingHeadAdmin.passwordHash.startsWith('pbkdf2_sha256$')) {
        existingHeadAdmin.passwordHash = adminHash;
        dirty = true;
      }
    }

    this.state = db;
    if (dirty) {
      this.persistAll();
    }
  }

  private get db(): DatabaseState {
    if (!this.state) {
      throw new Error('Store state not initialized');
    }
    return this.state;
  }

  private persistAll(): void {
    const db = this.db;
    for (const key of STATE_KEYS) {
      this.writeKvRaw(key, JSON.stringify(db[key]));
    }
  }

  private persistKeys(...keys: Array<keyof DatabaseState>): void {
    const db = this.db;
    for (const key of keys) {
      this.writeKvRaw(key, JSON.stringify(db[key]));
    }
  }

  private addAdminAlert(
    title: string,
    detail: string,
    category: AdminAlert['category'],
  ): void {
    const db = this.db;
    db.adminAlerts.unshift({
      id: makeId('alrt'),
      title,
      detail,
      category,
      read: false,
      createdAt: new Date().toISOString(),
    });
    if (db.adminAlerts.length > 100) {
      db.adminAlerts = db.adminAlerts.slice(0, 100);
    }
  }

  private logAudit(actorEmail: string, action: string, target: string, detail: string): void {
    const db = this.db;
    db.auditLogs.unshift({
      id: makeId('aud'),
      actorEmail,
      action,
      target,
      detail,
      createdAt: new Date().toISOString(),
    });
    if (db.auditLogs.length > 150) {
      db.auditLogs = db.auditLogs.slice(0, 150);
    }
  }

  private scheduleNextSmsExpiryAlarm(): void {
    try {
      const db = this.db;
      let earliest = Infinity;
      for (const order of db.smsOrders) {
        if (order.status !== 'waiting') continue;
        const ms = new Date(order.expiresAt).getTime();
        if (Number.isFinite(ms) && ms < earliest) {
          earliest = ms;
        }
      }
      if (Number.isFinite(earliest)) {
        void this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, earliest));
      }
    } catch {
      // Ignore alarm scheduling errors in restricted local test mocks
    }
  }

  private expireTimedOutSmsOrders(): boolean {
    const db = this.db;
    const now = Date.now();
    let changed = false;

    for (const order of db.smsOrders) {
      if (order.status !== 'waiting') continue;
      const expMs = new Date(order.expiresAt).getTime();
      if (!Number.isFinite(expMs) || now < expMs) continue;

      order.status = 'expired';
      changed = true;

      const user = db.users.find((u) => u.id === order.userId);
      if (user) {
        user.balance += order.price;
        db.transactions.unshift({
          id: makeId('tx'),
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          type: 'refund',
          amount: order.price,
          status: 'completed',
          description: `Auto-Refund (15m Timer Expired): ${order.serviceName} (${order.phoneNumber})`,
          createdAt: new Date(now).toISOString(),
        });
        db.notifications.unshift({
          id: makeId('ntf'),
          title: `SMS Session Expired (${order.serviceName})`,
          message: `15-minute OTP wait expired for ${order.phoneNumber}. ${db.settings.currencySymbol}${order.price.toLocaleString()} was automatically refunded to your wallet.`,
          type: 'info',
          targetUserId: user.id,
          readBy: [],
          createdAt: new Date(now).toISOString(),
        });
      }

      const poolItem = db.smsPool.find((p) => p.assignedOrderId === order.id);
      if (poolItem) {
        poolItem.used = false;
        poolItem.assignedOrderId = undefined;
      }
    }

    if (changed) {
      this.persistKeys('smsOrders', 'users', 'transactions', 'notifications', 'smsPool');
      this.scheduleNextSmsExpiryAlarm();
    }
    return changed;
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    this.expireTimedOutSmsOrders();
    this.scheduleNextSmsExpiryAlarm();
  }

  private async authenticate(
    request: Request,
  ): Promise<{ user: StoredUser } | { errorResponse: Response }> {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return {
        errorResponse: jsonResponse({ error: 'Authentication required' }, 401, request, this.env),
      };
    }
    const payload = await verifyTokenWeb(token, this.sessionSecret!);
    if (!payload) {
      return {
        errorResponse: jsonResponse(
          { error: 'Session expired or invalid. Please sign in again.' },
          401,
          request,
          this.env,
        ),
      };
    }
    const db = this.db;
    const user = db.users.find((u) => u.id === payload.userId);
    if (!user) {
      return {
        errorResponse: jsonResponse({ error: 'Account not found' }, 401, request, this.env),
      };
    }
    if (
      (user.role === 'admin' || user.email.toLowerCase() === HEAD_ADMIN_EMAIL.toLowerCase()) &&
      user.status !== 'active'
    ) {
      user.status = 'active';
      this.persistKeys('users');
    }
    if (user.status === 'suspended') {
      return {
        errorResponse: jsonResponse(
          { error: 'Your account has been suspended. Contact support.' },
          403,
          request,
          this.env,
        ),
      };
    }
    if (db.settings.maintenanceMode && user.role !== 'admin') {
      return {
        errorResponse: jsonResponse(
          { error: 'Platform is currently in maintenance mode.' },
          503,
          request,
          this.env,
        ),
      };
    }
    return { user };
  }

  private requireAdmin(
    user: StoredUser,
    request: Request,
  ): Response | null {
    if (user.role !== 'admin') {
      return jsonResponse({ error: 'Administrator privileges required' }, 403, request, this.env);
    }
    return null;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, this.env),
      });
    }

    try {
      await this.ensureInitialized();
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method.toUpperCase();

      // --- UPLOADS SERVING ---
      if (method === 'GET' && pathname.startsWith('/uploads/')) {
        const rawName = decodeURIComponent(pathname.slice('/uploads/'.length));
        if (!rawName || rawName.includes('/') || rawName.includes('..')) {
          return new Response('Not found', { status: 404 });
        }
        const uploaded = this.readUploadBytes(rawName);
        if (!uploaded) {
          return new Response('Not found', { status: 404 });
        }
        return new Response(uploaded.bytes as BodyInit, {
          status: 200,
          headers: {
            'content-type': uploaded.mime,
            'cache-control': 'public, max-age=31536000, immutable',
            ...getCorsHeaders(request, this.env),
          },
        });
      }

      const okJson = (data: unknown, status = 200) =>
        jsonResponse(data, status, request, this.env);
      const errJson = (error: string, status = 400) =>
        jsonResponse({ error }, status, request, this.env);

      // --- HEALTH ---
      if (method === 'GET' && pathname === '/api/health') {
        return okJson({
          ok: true,
          service: 'suredeal-store-api',
          runtime: 'cloudflare-workers-do',
          timestamp: new Date().toISOString(),
        });
      }

      // --- PUBLIC CATALOG ---
      if (method === 'GET' && pathname === '/api/public/catalog') {
        const db = this.db;
        const {
          smtpHost: _smtpHost,
          smtpPort: _smtpPort,
          smtpUser: _smtpUser,
          smtpPass: _smtpPass,
          smtpFrom: _smtpFrom,
          resendApiKey: _resendApiKey,
          ...publicSettings
        } = db.settings;
        return okJson({
          settings: publicSettings,
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
      }

      // --- AUTH ---
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(request);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) {
          return errJson('Email and password are required', 400);
        }
        const db = this.db;
        const user = db.users.find((u) => u.email.toLowerCase() === email);
        if (!user || !(await verifyPasswordWeb(password, user.passwordHash))) {
          return errJson('Invalid email address or password', 401);
        }
        if (
          (user.role === 'admin' || user.email.toLowerCase() === HEAD_ADMIN_EMAIL.toLowerCase()) &&
          user.status !== 'active'
        ) {
          user.status = 'active';
          this.persistKeys('users');
        }
        if (user.status === 'suspended') {
          return errJson('This account is suspended. Reach out to support.', 403);
        }
        if (db.settings.maintenanceMode && user.role !== 'admin') {
          return errJson('Maintenance mode is active. Only our team can sign in right now.', 503);
        }
        user.lastLoginAt = new Date().toISOString();
        this.persistKeys('users');
        const token = await signTokenWeb(user.id, this.sessionSecret!);
        return okJson({ token, user: toPublicUser(user) });
      }

      if (method === 'POST' && pathname === '/api/auth/signup') {
        const db = this.db;
        if (db.settings.maintenanceMode) {
          return errJson('Registrations are paused during maintenance.', 503);
        }
        if (db.settings.allowNewSignups === false) {
          return errJson('New account registrations are currently paused.', 403);
        }
        const body = await readJsonBody(request);
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const referralCodeInput = String(body.referralCode || '').trim().toUpperCase();

        if (!name || name.length < 2) {
          return errJson('Please provide your full name', 400);
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return errJson('Please provide a valid email address', 400);
        }
        if (password.length < 6) {
          return errJson('Password must be at least 6 characters', 400);
        }
        if (db.users.some((u) => u.email.toLowerCase() === email)) {
          return errJson('An account with this email already exists', 409);
        }

        const now = new Date().toISOString();
        const newCode = `SD${randomHex(3).toUpperCase()}`;
        const inviter = referralCodeInput
          ? db.users.find((u) => u.referralCode.toUpperCase() === referralCodeInput)
          : undefined;

        const welcomeBonus = db.settings.welcomePromoEnabled
          ? Math.max(0, db.settings.welcomePromoAmount || 0)
          : 0;

        const newUser: StoredUser = {
          id: makeId('usr'),
          name,
          email,
          passwordHash: await hashPasswordWeb(password),
          role: 'user',
          balance: welcomeBonus,
          status: 'active',
          referralCode: newCode,
          referredBy: inviter?.id,
          createdAt: now,
          lastLoginAt: now,
        };

        db.users.push(newUser);

        if (welcomeBonus > 0) {
          db.transactions.unshift({
            id: makeId('tx'),
            userId: newUser.id,
            userName: newUser.name,
            userEmail: newUser.email,
            type: 'welcome_bonus',
            amount: welcomeBonus,
            status: 'completed',
            description: 'Welcome Promo Bonus credited on signup',
            createdAt: now,
          });
        }

        if (inviter && db.settings.referralBonusAmount > 0) {
          const bonus = db.settings.referralBonusAmount;
          inviter.balance += bonus;
          db.transactions.unshift({
            id: makeId('tx'),
            userId: inviter.id,
            userName: inviter.name,
            userEmail: inviter.email,
            type: 'referral_bonus',
            amount: bonus,
            status: 'completed',
            description: `Referral bonus for inviting ${newUser.email}`,
            createdAt: now,
          });
          db.notifications.unshift({
            id: makeId('ntf'),
            title: 'Referral Bonus Credited',
            message: `You earned ${db.settings.currencySymbol}${bonus.toLocaleString()} because ${newUser.name} joined with your referral link.`,
            type: 'success',
            targetUserId: inviter.id,
            readBy: [],
            createdAt: now,
          });
        }

        db.notifications.unshift({
          id: makeId('ntf'),
          title: `Welcome to ${db.settings.siteName}`,
          message: `Your account (${newUser.email}) is active and ready.`,
          type: 'success',
          targetUserId: newUser.id,
          readBy: [],
          createdAt: now,
        });

        this.addAdminAlert(
          'New User Registered',
          `${newUser.name} (${newUser.email}) created an account.`,
          'user',
        );
        this.persistKeys('users', 'transactions', 'notifications', 'adminAlerts');

        const token = await signTokenWeb(newUser.id, this.sessionSecret!);
        return okJson({ token, user: toPublicUser(newUser) }, 201);
      }

      // All routes below require authentication
      const auth = await this.authenticate(request);
      if ('errorResponse' in auth) {
        return auth.errorResponse;
      }
      const currentUser = auth.user;
      const db = this.db;

      if (method === 'GET' && pathname === '/api/auth/me') {
        return okJson({ user: toPublicUser(currentUser) });
      }

      // --- USER DASHBOARD OVERVIEW & UNIFIED ORDERS ---
      if (method === 'GET' && pathname === '/api/dashboard/overview') {
        this.expireTimedOutSmsOrders();
        const smsOrders = db.smsOrders.filter((o) => o.userId === currentUser.id);
        const boostingOrders = db.boostingOrders.filter((o) => o.userId === currentUser.id);
        const vaultItems = db.vaultItems.filter((v) => v.userId === currentUser.id);
        const transactions = db.transactions
          .filter((t) => t.userId === currentUser.id)
          .slice(0, 12);
        const notifications = db.notifications.filter(
          (n) => n.targetUserId === 'all' || n.targetUserId === currentUser.id,
        );
        const unreadNotifications = notifications.filter(
          (n) => !n.readBy.includes(currentUser.id),
        ).length;
        const referralsCount = db.users.filter((u) => u.referredBy === currentUser.id).length;

        return okJson({
          user: toPublicUser(currentUser),
          stats: {
            activeSmsCount: smsOrders.filter((o) => o.status === 'waiting').length,
            totalSmsCount: smsOrders.length,
            activeBoostingCount: boostingOrders.filter(
              (o) =>
                o.status === 'pending' || o.status === 'processing' || o.status === 'refilling',
            ).length,
            vaultCount: vaultItems.length,
            referralsCount,
            unreadNotifications,
          },
          recentTransactions: transactions,
          notifications: notifications.slice(0, 5),
          tutorials: db.tutorials.slice(0, 3),
        });
      }

      if (method === 'GET' && pathname === '/api/orders/all') {
        this.expireTimedOutSmsOrders();
        return okJson({
          vaultItems: db.vaultItems.filter((v) => v.userId === currentUser.id),
          smsOrders: db.smsOrders.filter((s) => s.userId === currentUser.id),
          boostingOrders: db.boostingOrders.filter((b) => b.userId === currentUser.id),
          balance: currentUser.balance,
        });
      }

      // --- SMS VERIFICATION ---
      if (method === 'GET' && pathname === '/api/sms/catalog') {
        return okJson({
          countries: db.smsCountries.filter((c) => c.active),
          services: db.smsServices.filter((s) => s.active),
        });
      }

      if (method === 'GET' && pathname === '/api/sms/orders') {
        this.expireTimedOutSmsOrders();
        const orders = db.smsOrders.filter((o) => o.userId === currentUser.id);
        return okJson({ orders, balance: currentUser.balance });
      }

      if (method === 'POST' && pathname === '/api/sms/rent') {
        if (db.settings.enableSmsService === false) {
          return errJson('Virtual SMS verification is temporarily paused.', 403);
        }
        const body = await readJsonBody(request);
        const serviceId = String(body.serviceId || '');
        const countryId = String(body.countryId || '');

        const service = db.smsServices.find((s) => s.id === serviceId && s.active);
        const country = db.smsCountries.find((c) => c.id === countryId && c.active);
        if (!service || !country) {
          return errJson('Selected SMS service or country is unavailable', 404);
        }

        const price = Math.round(service.basePrice * country.multiplier);
        if (currentUser.balance < price) {
          return errJson(
            `Insufficient wallet balance. You need ${db.settings.currencySymbol}${price.toLocaleString()}.`,
            400,
          );
        }

        const poolMatch = db.smsPool.find(
          (p) =>
            !p.used &&
            p.countryId === country.id &&
            (!p.serviceId || p.serviceId === service.id),
        );

        const now = Date.now();
        const phoneNumber = poolMatch ? poolMatch.phoneNumber : 'Awaiting number';
        const orderId = makeId('sms');

        currentUser.balance -= price;
        if (service.stock > 0) service.stock -= 1;

        const order: DatabaseState['smsOrders'][number] = {
          id: orderId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          serviceId: service.id,
          serviceName: service.name,
          countryId: country.id,
          countryName: country.name,
          phoneNumber,
          price,
          status: 'waiting',
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
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

        db.smsOrders.unshift(order);
        db.transactions.unshift({
          id: makeId('tx'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'purchase',
          amount: price,
          status: 'completed',
          description: `SMS Rental: ${service.name} (${country.name})`,
          createdAt: new Date(now).toISOString(),
        });
        this.addAdminAlert(
          'New SMS Number Rented',
          `${currentUser.email} rented ${service.name} (${country.name}) · ${phoneNumber}`,
          'order',
        );
        this.persistKeys(
          'users',
          'smsServices',
          'smsPool',
          'smsOrders',
          'transactions',
          'adminAlerts',
        );
        this.scheduleNextSmsExpiryAlarm();
        return okJson({ order, balance: currentUser.balance }, 201);
      }

      const smsCheckMatch = pathname.match(/^\/api\/sms\/orders\/([^/]+)\/check-otp$/);
      if (method === 'POST' && smsCheckMatch) {
        this.expireTimedOutSmsOrders();
        const orderId = decodeURIComponent(smsCheckMatch[1]);
        const order = db.smsOrders.find((o) => o.id === orderId && o.userId === currentUser.id);
        if (!order) return errJson('SMS order not found', 404);
        if (order.status === 'cancelled') {
          return errJson('This number was already cancelled and refunded.', 400);
        }
        return okJson({ order, balance: currentUser.balance });
      }

      const smsReqAnotherMatch = pathname.match(/^\/api\/sms\/orders\/([^/]+)\/request-another$/);
      if (method === 'POST' && smsReqAnotherMatch) {
        this.expireTimedOutSmsOrders();
        const orderId = decodeURIComponent(smsReqAnotherMatch[1]);
        const order = db.smsOrders.find((o) => o.id === orderId && o.userId === currentUser.id);
        if (!order) return errJson('SMS order not found', 404);
        if (order.status === 'cancelled' || order.status === 'expired') {
          return errJson('Cannot request another code on a closed or expired number', 400);
        }
        order.status = 'waiting';
        order.otpCode = undefined;
        order.smsText = 'Waiting for another OTP code from our team.';
        order.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        this.addAdminAlert(
          'SMS New OTP Requested',
          `${currentUser.email} requested another OTP for ${order.serviceName} (${order.phoneNumber})`,
          'order',
        );
        this.persistKeys('smsOrders', 'adminAlerts');
        this.scheduleNextSmsExpiryAlarm();
        return okJson({ order });
      }

      const smsCancelMatch = pathname.match(/^\/api\/sms\/orders\/([^/]+)\/cancel$/);
      if (method === 'POST' && smsCancelMatch) {
        this.expireTimedOutSmsOrders();
        const orderId = decodeURIComponent(smsCancelMatch[1]);
        const order = db.smsOrders.find((o) => o.id === orderId && o.userId === currentUser.id);
        if (!order) return errJson('SMS order not found', 404);
        if (order.status === 'expired') {
          return okJson({ order, balance: currentUser.balance });
        }
        if (order.status !== 'waiting') {
          return errJson('Only waiting orders without an OTP can be cancelled for refund', 400);
        }
        order.status = 'cancelled';
        currentUser.balance += order.price;
        const poolItem = db.smsPool.find((p) => p.assignedOrderId === order.id);
        if (poolItem) {
          poolItem.used = false;
          poolItem.assignedOrderId = undefined;
        }
        db.transactions.unshift({
          id: makeId('tx'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'refund',
          amount: order.price,
          status: 'completed',
          description: `Instant SMS Refund: ${order.serviceName} (${order.phoneNumber})`,
          createdAt: new Date().toISOString(),
        });
        this.persistKeys('smsOrders', 'users', 'smsPool', 'transactions');
        return okJson({ order, balance: currentUser.balance });
      }

      // --- SOCIAL BOOSTING ---
      if (method === 'GET' && pathname === '/api/boosting/catalog') {
        return okJson({ services: db.boostingServices.filter((s) => s.active) });
      }

      if (method === 'GET' && pathname === '/api/boosting/orders') {
        return okJson({ orders: db.boostingOrders.filter((o) => o.userId === currentUser.id) });
      }

      if (method === 'POST' && pathname === '/api/boosting/order') {
        if (db.settings.enableBoostingService === false) {
          return errJson('Social boosting orders are temporarily paused.', 403);
        }
        const body = await readJsonBody(request);
        const serviceId = String(body.serviceId || '');
        const targetUrl = String(body.targetUrl || '').trim();
        const quantity = Number(body.quantity || 0);

        const service = db.boostingServices.find((s) => s.id === serviceId && s.active);
        if (!service) return errJson('Boosting service not found', 404);
        if (!targetUrl || targetUrl.length < 4) {
          return errJson('Please enter a valid profile or post link', 400);
        }
        if (!Number.isFinite(quantity) || quantity < service.minQty || quantity > service.maxQty) {
          return errJson(
            `Quantity must be between ${service.minQty.toLocaleString()} and ${service.maxQty.toLocaleString()}`,
            400,
          );
        }

        const amount = Math.max(10, Math.round((service.ratePer1k * quantity) / 1000));
        if (currentUser.balance < amount) {
          return errJson(
            `Insufficient wallet balance. Campaign costs ${db.settings.currencySymbol}${amount.toLocaleString()}.`,
            400,
          );
        }

        const now = new Date().toISOString();
        currentUser.balance -= amount;

        const randArr = new Uint32Array(1);
        crypto.getRandomValues(randArr);
        const order: DatabaseState['boostingOrders'][number] = {
          id: makeId('bsto'),
          userId: currentUser.id,
          userEmail: currentUser.email,
          serviceId: service.id,
          serviceName: service.name,
          platform: service.platform,
          targetUrl,
          quantity,
          amount,
          status: 'pending',
          startCount: 120 + (randArr[0] % 1400),
          remains: quantity,
          createdAt: now,
          updatedAt: now,
        };

        db.boostingOrders.unshift(order);
        db.transactions.unshift({
          id: makeId('tx'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'purchase',
          amount,
          status: 'completed',
          description: `Social Boost: ${service.platform} · ${quantity.toLocaleString()} qty`,
          createdAt: now,
        });
        this.addAdminAlert(
          'New Boosting Order',
          `${currentUser.name} (${currentUser.email}) · ${service.platform} ${service.name} · Qty: ${quantity.toLocaleString()} · Link: ${targetUrl} · ${db.settings.currencySymbol}${amount.toLocaleString()}`,
          'order',
        );
        db.emailLogs.unshift({
          id: makeId('eml'),
          to: db.settings.supportEmail || HEAD_ADMIN_EMAIL,
          subject: `New Boosting Purchase #${order.id} — ${service.platform} ${service.name}`,
          body: `User: ${currentUser.name} (${currentUser.email})\nPlatform: ${service.platform}\nPackage: ${service.name}\nTarget Link: ${targetUrl}\nQuantity: ${quantity.toLocaleString()}\nAmount Paid: ${db.settings.currencySymbol}${amount.toLocaleString()}\nTime: ${now}`,
          sentBy: currentUser.email,
          createdAt: now,
        });
        this.persistKeys('users', 'boostingOrders', 'transactions', 'adminAlerts', 'emailLogs');
        return okJson({ order, balance: currentUser.balance }, 201);
      }

      const boostRefillMatch = pathname.match(/^\/api\/boosting\/orders\/([^/]+)\/refill$/);
      if (method === 'POST' && boostRefillMatch) {
        const orderId = decodeURIComponent(boostRefillMatch[1]);
        const order = db.boostingOrders.find(
          (o) => o.id === orderId && o.userId === currentUser.id,
        );
        if (!order) return errJson('Boosting order not found', 404);
        if (order.status !== 'completed') {
          return errJson('Refill can only be requested on completed orders', 400);
        }
        order.status = 'refilling';
        order.updatedAt = new Date().toISOString();
        this.addAdminAlert(
          'Refill Requested',
          `${currentUser.email} requested refill for ${order.id}`,
          'order',
        );
        this.persistKeys('boostingOrders', 'adminAlerts');
        return okJson({ order });
      }

      // --- MARKETPLACE & VAULT ---
      if (method === 'GET' && pathname === '/api/marketplace/listings') {
        return okJson({
          categories: db.marketplaceCategories,
          listings: db.marketplaceListings.filter((l) => l.active),
          vault: db.vaultItems.filter((v) => v.userId === currentUser.id),
          defaultBuyWarning: db.settings.defaultBuyWarning,
        });
      }

      if (method === 'POST' && pathname === '/api/marketplace/purchase') {
        if (db.settings.enableMarketplace === false) {
          return errJson('Marketplace purchases are temporarily paused.', 403);
        }
        const body = await readJsonBody(request);
        const listingId = String(body.listingId || '');
        const promoCodeStr = String(body.promoCode || '').trim().toUpperCase();
        const listing = db.marketplaceListings.find((l) => l.id === listingId && l.active);
        if (!listing) return errJson('Marketplace listing not found', 404);
        if (listing.stock <= 0) return errJson('This product is currently out of stock', 400);

        let finalPrice = listing.price;
        let appliedPromo: PromoCode | undefined;
        if (promoCodeStr) {
          if (db.settings.allowPromoCodes === false) {
            return errJson('Promo codes are currently disabled.', 403);
          }
          appliedPromo = db.promoCodes.find(
            (p) => p.active && p.code.toUpperCase() === promoCodeStr && p.uses < p.maxUses,
          );
          if (!appliedPromo) return errJson('Promo code is invalid or expired', 400);
          if (appliedPromo.discountType === 'percent') {
            finalPrice = Math.max(0, Math.round(listing.price * (1 - appliedPromo.value / 100)));
          } else {
            finalPrice = Math.max(0, listing.price - appliedPromo.value);
          }
        }

        if (currentUser.balance < finalPrice) {
          return errJson(
            `Insufficient wallet balance. Need ${db.settings.currencySymbol}${finalPrice.toLocaleString()}.`,
            400,
          );
        }

        const now = new Date().toISOString();
        currentUser.balance -= finalPrice;
        const hadStockKeys = Boolean(listing.stockKeys && listing.stockKeys.length > 0);
        let deliveredCredential = '';
        if (hadStockKeys) {
          deliveredCredential = listing.stockKeys.shift()!;
          listing.stock = listing.stockKeys.length;
        } else {
          listing.stock = Math.max(0, listing.stock - 1);
          deliveredCredential = buildCredentialFromTemplateWeb(listing.credentialTemplate);
        }
        listing.soldCount += 1;
        if (appliedPromo) {
          appliedPromo.uses += 1;
        }

        const vaultItem: DatabaseState['vaultItems'][number] = {
          id: makeId('vlt'),
          userId: currentUser.id,
          sourceType: 'marketplace',
          sourceId: listing.id,
          title: listing.title,
          category: listing.category,
          price: finalPrice,
          deliveredCredential,
          deliveryType: listing.deliveryType,
          buyWarningShown: listing.buyWarning || db.settings.defaultBuyWarning,
          createdAt: now,
        };

        db.vaultItems.unshift(vaultItem);
        db.transactions.unshift({
          id: makeId('tx'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'purchase',
          amount: finalPrice,
          status: 'completed',
          description: `Marketplace Order: ${listing.title}${appliedPromo ? ` (${appliedPromo.code})` : ''}`,
          createdAt: now,
        });
        this.addAdminAlert(
          'Marketplace Asset Sold',
          `${currentUser.email} purchased ${listing.title} for ${db.settings.currencySymbol}${finalPrice.toLocaleString()}`,
          'order',
        );
        this.persistKeys(
          'users',
          'marketplaceListings',
          'promoCodes',
          'vaultItems',
          'transactions',
          'adminAlerts',
        );
        return okJson({ vaultItem, listing, balance: currentUser.balance }, 201);
      }

      // --- CUSTOM SECTIONS ---
      const sectionGetMatch = pathname.match(/^\/api\/sections\/([^/]+)$/);
      if (method === 'GET' && sectionGetMatch) {
        const secId = decodeURIComponent(sectionGetMatch[1]);
        const section = db.customSections.find((s) => s.id === secId && s.active);
        if (!section) return errJson('Section not found', 404);
        return okJson({
          section: {
            ...section,
            products: section.products.filter((p) => p.active),
          },
        });
      }

      if (method === 'POST' && pathname === '/api/sections/purchase') {
        if (db.settings.enableMarketplace === false) {
          return errJson('Marketplace purchases are temporarily paused.', 403);
        }
        const body = await readJsonBody(request);
        const sectionId = String(body.sectionId || '');
        const productId = String(body.productId || '');
        const section = db.customSections.find((s) => s.id === sectionId && s.active);
        const product = section?.products.find((p) => p.id === productId && p.active);
        if (!section || !product) return errJson('Product not found in section', 404);
        if (product.stock <= 0) return errJson('Out of stock', 400);
        if (currentUser.balance < product.price) return errJson('Insufficient wallet balance', 400);

        const now = new Date().toISOString();
        currentUser.balance -= product.price;
        product.stock -= 1;

        const vaultItem: DatabaseState['vaultItems'][number] = {
          id: makeId('vlt'),
          userId: currentUser.id,
          sourceType: 'section',
          sourceId: product.id,
          title: product.title,
          category: section.name,
          price: product.price,
          deliveredCredential: buildCredentialFromTemplateWeb(product.credentialTemplate),
          deliveryType: 'Vault Delivery',
          buyWarningShown: product.buyWarning || db.settings.defaultBuyWarning,
          createdAt: now,
        };

        db.vaultItems.unshift(vaultItem);
        db.transactions.unshift({
          id: makeId('tx'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'purchase',
          amount: product.price,
          status: 'completed',
          description: `${section.name}: ${product.title}`,
          createdAt: now,
        });
        this.persistKeys('users', 'customSections', 'vaultItems', 'transactions');
        return okJson({ vaultItem, product, balance: currentUser.balance }, 201);
      }

      // --- WALLET & DEPOSIT ---
      if (method === 'GET' && pathname === '/api/wallet') {
        const transactions = db.transactions.filter((t) => t.userId === currentUser.id);
        return okJson({
          balance: currentUser.balance,
          minimumDeposit: db.settings.minimumDeposit,
          bankDetails: {
            bankName: db.settings.bankName,
            accountNumber: db.settings.bankAccountNumber,
            accountName: db.settings.bankAccountName,
          },
          transactions,
        });
      }

      if (method === 'POST' && pathname === '/api/wallet/deposit') {
        const body = await readJsonBody(request);
        const amount = Number(body.amount || 0);
        const receiptImage = String(body.receiptImage || '');
        const senderNote = String(body.senderNote || '').trim();

        if (!Number.isFinite(amount) || amount < db.settings.minimumDeposit) {
          return errJson(
            `Minimum deposit is ${db.settings.currencySymbol}${db.settings.minimumDeposit.toLocaleString()}`,
            400,
          );
        }
        if (!receiptImage || !receiptImage.startsWith('data:image/')) {
          return errJson('Please upload a valid Moniepoint transfer receipt image', 400);
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

        const { aiAudit, receiptHash, allChecksPassed } = await verifyMoniepointReceiptWithAiWeb({
          receiptDataUrl: receiptImage,
          claimedAmount: amount,
          expectedBank: db.settings.bankName,
          expectedAccountNumber: db.settings.bankAccountNumber,
          expectedAccountName: db.settings.bankAccountName,
          existingDeposits,
          geminiApiKey: this.env.GEMINI_API_KEY,
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
          currentUser.balance += amount;
        }

        // Persist receipt binary cleanly in uploads table so transaction rows remain fast & compact
        let storedReceiptUrl = receiptImage;
        const imgMatch = receiptImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (imgMatch && imgMatch[2].length > 80_000) {
          const mime = imgMatch[1];
          const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
          const fileName = `receipt_${Date.now()}_${randomHex(4)}.${ext}`;
          this.saveUploadBytes(fileName, mime, base64ToBytes(imgMatch[2]));
          storedReceiptUrl = `/uploads/${fileName}`;
        }

        const transaction: DatabaseState['transactions'][number] = {
          id: makeId('dep'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'deposit',
          amount,
          status,
          description: `${db.settings.bankName} Transfer Deposit (${db.settings.bankAccountNumber})`,
          receiptImage: storedReceiptUrl,
          receiptHash,
          senderNote: senderNote || undefined,
          aiAudit,
          createdAt: now,
        };

        db.transactions.unshift(transaction);
        this.addAdminAlert(
          autoVerified
            ? 'Deposit Auto-Verified'
            : autoRejected
              ? 'Deposit Auto-Rejected'
              : 'Moniepoint Receipt Uploaded',
          `${currentUser.email} submitted ${db.settings.currencySymbol}${amount.toLocaleString()} (${aiAudit.verdict} · ${aiAudit.confidence}%)`,
          'deposit',
        );
        this.persistKeys('users', 'transactions', 'adminAlerts');
        return okJson(
          {
            transaction,
            balance: currentUser.balance,
            autoVerified,
            autoRejected,
          },
          201,
        );
      }

      // --- NOTIFICATIONS ---
      if (method === 'GET' && pathname === '/api/notifications') {
        const items = db.notifications.filter(
          (n) => n.targetUserId === 'all' || n.targetUserId === currentUser.id,
        );
        return okJson({ notifications: items });
      }

      const ntfReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
      if (method === 'POST' && ntfReadMatch) {
        const ntfId = decodeURIComponent(ntfReadMatch[1]);
        const item = db.notifications.find((n) => n.id === ntfId);
        if (item && !item.readBy.includes(currentUser.id)) {
          item.readBy.push(currentUser.id);
          this.persistKeys('notifications');
        }
        return okJson({ ok: true });
      }

      // --- TUTORIALS ---
      if (method === 'GET' && pathname === '/api/tutorials') {
        return okJson({ tutorials: db.tutorials });
      }

      // --- SUPPORT TICKETS ---
      if (method === 'GET' && pathname === '/api/tickets') {
        return okJson({ tickets: db.tickets.filter((t) => t.userId === currentUser.id) });
      }

      if (method === 'POST' && pathname === '/api/tickets') {
        const body = await readJsonBody(request);
        const subject = String(body.subject || '').trim();
        const category = String(body.category || 'General').trim();
        const priority = (['normal', 'high', 'urgent'].includes(String(body.priority || ''))
          ? String(body.priority)
          : 'normal') as 'normal' | 'high' | 'urgent';
        const message = String(body.message || '').trim();

        if (!subject || !message) return errJson('Subject and message are required', 400);

        const now = new Date().toISOString();
        const ticket: DatabaseState['tickets'][number] = {
          id: makeId('tkt'),
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          subject,
          category,
          priority,
          status: 'open',
          messages: [
            {
              id: makeId('msg'),
              senderRole: 'user',
              senderName: currentUser.name,
              text: message,
              createdAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        db.tickets.unshift(ticket);
        this.addAdminAlert('New Support Ticket', `${currentUser.email}: ${subject}`, 'ticket');
        this.persistKeys('tickets', 'adminAlerts');
        return okJson({ ticket }, 201);
      }

      const ticketReplyMatch = pathname.match(/^\/api\/tickets\/([^/]+)\/reply$/);
      if (method === 'POST' && ticketReplyMatch) {
        const ticketId = decodeURIComponent(ticketReplyMatch[1]);
        const body = await readJsonBody(request);
        const text = String(body.text || '').trim();
        if (!text) return errJson('Reply message cannot be empty', 400);
        const ticket = db.tickets.find((t) => t.id === ticketId);
        if (!ticket) return errJson('Ticket not found', 404);
        if (currentUser.role !== 'admin' && ticket.userId !== currentUser.id) {
          return errJson('Access denied', 403);
        }
        const now = new Date().toISOString();
        ticket.messages.push({
          id: makeId('msg'),
          senderRole: currentUser.role === 'admin' ? 'admin' : 'user',
          senderName: currentUser.name,
          text,
          createdAt: now,
        });
        ticket.updatedAt = now;
        if (currentUser.role === 'admin' && ticket.status === 'open') {
          ticket.status = 'in_progress';
        }
        this.persistKeys('tickets');
        return okJson({ ticket });
      }

      // --- USER PROFILE & REFERRALS ---
      if (method === 'PATCH' && pathname === '/api/user/profile') {
        const body = await readJsonBody(request);
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        if (name.length >= 2) currentUser.name = name;
        if (email && email.includes('@') && email !== currentUser.email.toLowerCase()) {
          const taken = db.users.some(
            (u) => u.id !== currentUser.id && u.email.toLowerCase() === email,
          );
          if (taken) return errJson('Email already used by another account', 409);
          currentUser.email = email;
        }
        this.persistKeys('users');
        return okJson({ user: toPublicUser(currentUser) });
      }

      if (method === 'POST' && pathname === '/api/user/password') {
        const body = await readJsonBody(request);
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '');
        if (!(await verifyPasswordWeb(currentPassword, currentUser.passwordHash))) {
          return errJson('Current password is incorrect', 400);
        }
        if (newPassword.length < 6) {
          return errJson('New password must be at least 6 characters', 400);
        }
        currentUser.passwordHash = await hashPasswordWeb(newPassword);
        this.persistKeys('users');
        return okJson({ ok: true });
      }

      if (method === 'GET' && pathname === '/api/user/referral') {
        const invited = db.users
          .filter((u) => u.referredBy === currentUser.id)
          .map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }));
        const totalEarned = db.transactions
          .filter((t) => t.userId === currentUser.id && t.type === 'referral_bonus')
          .reduce((sum, t) => sum + t.amount, 0);
        return okJson({
          referralCode: currentUser.referralCode,
          bonusPerReferral: db.settings.referralBonusAmount,
          invited,
          totalEarned,
        });
      }

      // =========================================================================
      // OVERWATCH ADMIN PANEL APIs
      // =========================================================================
      if (pathname.startsWith('/api/admin/')) {
        const adminErr = this.requireAdmin(currentUser, request);
        if (adminErr) return adminErr;

        if (method === 'GET' && pathname === '/api/admin/overview') {
          this.expireTimedOutSmsOrders();
          const visibleTransactions = db.transactions.filter((t) => !t.adminCleared);
          const visibleSmsOrders = db.smsOrders.filter((s) => !s.adminCleared);
          const visibleBoostingOrders = db.boostingOrders.filter((b) => !b.adminCleared);

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
          const openTickets = db.tickets.filter(
            (t) => t.status === 'open' || t.status === 'in_progress',
          );
          const unreadAlerts = db.adminAlerts.filter((a) => !a.read).length;

          return okJson({
            settings: db.settings,
            metrics: {
              totalUsers: db.users.length,
              totalRevenue,
              totalDeposits,
              totalUserBalances,
              pendingDepositsCount: pendingDeposits.length,
              pendingBoostingCount: visibleBoostingOrders.filter(
                (b) =>
                  b.status === 'pending' || b.status === 'processing' || b.status === 'refilling',
              ).length,
              activeSmsCount: visibleSmsOrders.filter((s) => s.status === 'waiting').length,
              openTickets: openTickets.length,
              unreadAlerts,
            },
            users: db.users.map(toPublicUser),
            transactions: visibleTransactions,
            smsOrders: visibleSmsOrders,
            smsPool: db.smsPool,
            smsServices: db.smsServices,
            smsCountries: db.smsCountries,
            boostingOrders: visibleBoostingOrders,
            boostingServices: db.boostingServices,
            marketplaceCategories: db.marketplaceCategories,
            marketplaceListings: db.marketplaceListings,
            customSections: db.customSections,
            notifications: db.notifications,
            emailLogs: db.emailLogs,
            tutorials: db.tutorials,
            tickets: db.tickets,
            adminAlerts: db.adminAlerts,
            promoCodes: db.promoCodes,
            auditLogs: db.auditLogs,
          });
        }

        if (method === 'POST' && pathname === '/api/admin/alerts/read-all') {
          db.adminAlerts.forEach((a) => {
            a.read = true;
          });
          this.persistKeys('adminAlerts');
          return okJson({ ok: true });
        }

        if (method === 'DELETE' && pathname === '/api/admin/alerts') {
          const count = db.adminAlerts.length;
          db.adminAlerts = [];
          this.logAudit(currentUser.email, 'CLEAR_ALERTS', 'adminAlerts', `Cleared ${count} alerts`);
          this.persistKeys('adminAlerts', 'auditLogs');
          return okJson({ ok: true, cleared: count });
        }

        if (method === 'POST' && pathname === '/api/admin/upload-video') {
          const body = await readJsonBody(request);
          const dataUrl = String(body.videoDataUrl || '');
          const fileName = String(body.fileName || 'video.mp4');
          const match = dataUrl.match(/^data:(video\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (!match) {
            return errJson('Invalid video file format. Please upload MP4, WebM, or MOV.', 400);
          }
          const mime = match[1];
          const ext = mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : 'mp4';
          const safeName = `landing_${Date.now()}_${randomHex(4)}.${ext}`;
          this.saveUploadBytes(safeName, mime, base64ToBytes(match[2]));
          const publicUrl = `/uploads/${safeName}`;
          db.settings.landingVideoUrl = publicUrl;
          this.logAudit(
            currentUser.email,
            'VIDEO_UPLOAD',
            fileName,
            `Uploaded landing video ${publicUrl}`,
          );
          this.persistKeys('settings', 'auditLogs');
          return okJson({ url: publicUrl, settings: db.settings });
        }

        if (method === 'POST' && pathname === '/api/admin/users') {
          const body = await readJsonBody(request);
          const name = String(body.name || '').trim();
          const email = String(body.email || '').trim().toLowerCase();
          const password = String(body.password || 'SureDeal123!');
          const role = body.role === 'admin' ? 'admin' : 'user';
          const balance = Math.max(0, Number(body.balance || 0));

          if (!name || !email.includes('@')) {
            return errJson('Valid name and email are required', 400);
          }
          if (db.users.some((u) => u.email.toLowerCase() === email)) {
            return errJson('User with this email already exists', 409);
          }
          const newUser: StoredUser = {
            id: makeId('usr'),
            name,
            email,
            passwordHash: await hashPasswordWeb(password),
            role,
            balance,
            status: 'active',
            referralCode: `SD${randomHex(3).toUpperCase()}`,
            createdAt: new Date().toISOString(),
          };
          db.users.push(newUser);
          this.logAudit(
            currentUser.email,
            'CREATE_USER',
            newUser.email,
            `Role: ${role}, Initial Bal: ${balance}`,
          );
          this.persistKeys('users', 'auditLogs');
          return okJson({ user: toPublicUser(newUser) }, 201);
        }

        const adminUserBalMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/balance$/);
        if (method === 'POST' && adminUserBalMatch) {
          const targetId = decodeURIComponent(adminUserBalMatch[1]);
          const target = db.users.find((u) => u.id === targetId);
          if (!target) return errJson('User not found', 404);
          const body = await readJsonBody(request);
          const mode = String(body.mode || 'credit');
          const amount = Number(body.amount || 0);
          const note = String(body.note || 'Team balance adjustment').trim();
          if (!Number.isFinite(amount) || amount < 0) {
            return errJson('Amount must be a non-negative number', 400);
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
          db.transactions.unshift({
            id: makeId('tx'),
            userId: target.id,
            userName: target.name,
            userEmail: target.email,
            type: txType,
            amount: Math.abs(delta),
            status: 'completed',
            description: note,
            createdAt: new Date().toISOString(),
          });
          this.logAudit(
            currentUser.email,
            `BALANCE_${mode.toUpperCase()}`,
            target.email,
            `${note} (${amount})`,
          );
          this.persistKeys('users', 'transactions', 'auditLogs');
          return okJson({ user: toPublicUser(target) });
        }

        if (method === 'POST' && pathname === '/api/admin/users/airdrop-bonus') {
          const body = await readJsonBody(request);
          const amount = Number(body.amount || 0);
          const title = String(body.title || 'Creator Wallet Bonus').trim();
          const message = String(body.message || '').trim();
          if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
            return errJson('Enter a valid bonus amount between 1 and 1,000,000', 400);
          }
          const now = new Date().toISOString();
          const activeUsers = db.users.filter((u) => u.status === 'active' && u.role !== 'admin');
          for (const u of activeUsers) {
            u.balance += amount;
            db.transactions.unshift({
              id: makeId('tx'),
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
              type: 'admin_credit',
              amount,
              status: 'completed',
              description: title,
              adminNote: `Overwatch Airdrop by ${db.settings.creatorName || 'Creator'}`,
              createdAt: now,
            });
          }
          if (activeUsers.length > 0) {
            db.notifications.unshift({
              id: makeId('ntf'),
              title,
              message:
                message ||
                `You received a ${db.settings.currencySymbol}${amount.toLocaleString()} wallet bonus drop!`,
              type: 'success',
              targetUserId: 'all',
              readBy: [],
              createdAt: now,
            });
          }
          this.logAudit(
            currentUser.email,
            'CREATOR_AIRDROP',
            `${activeUsers.length} active accounts`,
            `Credited ${db.settings.currencySymbol}${amount.toLocaleString()} each (${title})`,
          );
          this.persistKeys('users', 'transactions', 'notifications', 'auditLogs');
          return okJson({
            creditedCount: activeUsers.length,
            totalDistributed: activeUsers.length * amount,
          });
        }

        const adminUserIdMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (adminUserIdMatch && method === 'PATCH') {
          const targetId = decodeURIComponent(adminUserIdMatch[1]);
          const target = db.users.find((u) => u.id === targetId);
          if (!target) return errJson('User not found', 404);
          const body = await readJsonBody(request);
          if (typeof body.name === 'string' && body.name.trim()) {
            target.name = body.name.trim();
          }
          if (typeof body.email === 'string' && body.email.includes('@')) {
            target.email = body.email.trim().toLowerCase();
          }
          const isHeadAdmin = target.email.toLowerCase() === HEAD_ADMIN_EMAIL.toLowerCase();
          const isTargetAdmin = target.role === 'admin' || isHeadAdmin;
          if (isHeadAdmin && body.role === 'user') {
            return errJson('Cannot remove admin role from the Head Admin account', 400);
          }
          if (isTargetAdmin && body.status === 'suspended') {
            return errJson('Admin accounts cannot be suspended', 400);
          }
          if (body.role === 'admin' || body.role === 'user') {
            target.role = body.role;
            if (target.role === 'admin') {
              target.status = 'active';
            }
          }
          if (body.status === 'active' || body.status === 'suspended') {
            target.status = body.status;
            this.logAudit(
              currentUser.email,
              body.status === 'suspended' ? 'SUSPEND_USER' : 'RESTORE_USER',
              target.email,
              `Account set to ${body.status}`,
            );
          }
          if (typeof body.newPassword === 'string' && body.newPassword.length >= 6) {
            target.passwordHash = await hashPasswordWeb(body.newPassword);
            this.logAudit(
              currentUser.email,
              'RESET_PASSWORD',
              target.email,
              'Password updated by Head Admin',
            );
          }
          this.persistKeys('users', 'auditLogs');
          return okJson({ user: toPublicUser(target) });
        }

        if (adminUserIdMatch && method === 'DELETE') {
          const targetId = decodeURIComponent(adminUserIdMatch[1]);
          const target = db.users.find((u) => u.id === targetId);
          if (!target) return errJson('User not found', 404);
          if (
            target.id === currentUser.id ||
            target.email.toLowerCase() === HEAD_ADMIN_EMAIL.toLowerCase()
          ) {
            return errJson('Cannot permanently delete the Head Admin account', 400);
          }
          const targetEmail = target.email.toLowerCase();
          db.users = db.users.filter(
            (u) => u.id !== target.id && u.email.toLowerCase() !== targetEmail,
          );
          db.users.forEach((u) => {
            if (u.referredBy === target.id) {
              u.referredBy = undefined;
            }
          });
          db.vaultItems = db.vaultItems.filter((v) => v.userId !== target.id);
          db.smsOrders = db.smsOrders.filter((s) => s.userId !== target.id);
          db.boostingOrders = db.boostingOrders.filter((b) => b.userId !== target.id);
          db.transactions = db.transactions.filter((t) => t.userId !== target.id);
          db.tickets = db.tickets.filter((t) => t.userId !== target.id);
          db.notifications = db.notifications.filter((n) => n.targetUserId !== target.id);
          this.logAudit(
            currentUser.email,
            'DELETE_USER_PERMANENT',
            target.email,
            'Permanently deleted user & all records',
          );
          this.persistKeys(
            'users',
            'vaultItems',
            'smsOrders',
            'boostingOrders',
            'transactions',
            'tickets',
            'notifications',
            'auditLogs',
          );
          return okJson({ ok: true });
        }

        // --- TRANSACTIONS ADMIN ---
        const txDecisionMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)\/decision$/);
        if (method === 'POST' && txDecisionMatch) {
          const txId = decodeURIComponent(txDecisionMatch[1]);
          const tx = db.transactions.find((t) => t.id === txId);
          if (!tx || tx.type !== 'deposit') {
            return errJson('Deposit transaction not found', 404);
          }
          const body = await readJsonBody(request);
          const decision = String(body.decision || '');
          const adminNote = String(body.adminNote || '').trim();
          const user = db.users.find((u) => u.id === tx.userId);

          if (decision === 'approve') {
            if (tx.status !== 'verified' && user) {
              user.balance += tx.amount;
            }
            tx.status = 'verified';
            tx.adminNote = adminNote || 'Verified by Our Team';
            if (user) {
              db.notifications.unshift({
                id: makeId('ntf'),
                title: 'Deposit Approved',
                message: `Your ${db.settings.bankName} transfer of ${db.settings.currencySymbol}${tx.amount.toLocaleString()} has been verified and credited.`,
                type: 'success',
                targetUserId: user.id,
                readBy: [],
                createdAt: new Date().toISOString(),
              });
            }
          } else if (decision === 'reject' || decision === 'reverse') {
            if (tx.status === 'verified' && user) {
              user.balance = Math.max(0, user.balance - tx.amount);
            }
            tx.status = 'rejected';
            tx.adminNote = adminNote || 'Declined by Our Team';
            if (user) {
              db.notifications.unshift({
                id: makeId('ntf'),
                title: 'Deposit Declined',
                message: `Your transfer of ${db.settings.currencySymbol}${tx.amount.toLocaleString()} was declined. Reason: ${tx.adminNote}`,
                type: 'warning',
                targetUserId: user.id,
                readBy: [],
                createdAt: new Date().toISOString(),
              });
            }
          } else {
            return errJson('Invalid decision', 400);
          }

          this.logAudit(
            currentUser.email,
            `DEPOSIT_${decision.toUpperCase()}`,
            tx.userEmail,
            `Amount: ${tx.amount}`,
          );
          this.persistKeys('transactions', 'users', 'notifications', 'auditLogs');
          return okJson({ transaction: tx });
        }

        if (method === 'POST' && pathname === '/api/admin/transactions/bulk-approve-matched') {
          const matched = db.transactions.filter(
            (t) =>
              !t.adminCleared &&
              t.type === 'deposit' &&
              t.status === 'pending' &&
              t.aiAudit?.verdict === 'match' &&
              t.aiAudit?.checks?.uniqueReference !== false,
          );
          let totalCredited = 0;
          const now = new Date().toISOString();
          for (const tx of matched) {
            const targetUser = db.users.find((u) => u.id === tx.userId);
            if (targetUser) {
              targetUser.balance += tx.amount;
              db.notifications.unshift({
                id: makeId('ntf'),
                title: 'Deposit Approved',
                message: `Your ${db.settings.bankName} transfer of ${db.settings.currencySymbol}${tx.amount.toLocaleString()} has been verified and credited.`,
                type: 'success',
                targetUserId: targetUser.id,
                readBy: [],
                createdAt: now,
              });
            }
            tx.status = 'verified';
            tx.adminNote = 'Verified by Our Team';
            totalCredited += tx.amount;
          }
          if (matched.length > 0) {
            this.logAudit(
              currentUser.email,
              'BULK_APPROVE_MATCHED_DEPOSITS',
              `${matched.length} receipts`,
              `Total credited: ${totalCredited}`,
            );
            this.persistKeys('transactions', 'users', 'notifications', 'auditLogs');
          }
          return okJson({ approvedCount: matched.length, totalCredited });
        }

        if (method === 'POST' && pathname === '/api/admin/transactions/clear') {
          const body = await readJsonBody(request);
          const scope = String(body.scope || 'all');
          let removed = 0;
          const matchesScope = (t: DatabaseState['transactions'][number]) => {
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
          for (const t of db.transactions) {
            if (!t.adminCleared && matchesScope(t)) {
              t.adminCleared = true;
              removed += 1;
            }
          }
          this.logAudit(
            currentUser.email,
            'CLEAR_TRANSACTIONS',
            scope,
            `Cleared ${removed} transaction record(s) from Overwatch (user history preserved)`,
          );
          this.persistKeys('transactions', 'auditLogs');
          return okJson({ ok: true, removed });
        }

        const adminTxDeleteMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)$/);
        if (method === 'DELETE' && adminTxDeleteMatch) {
          const txId = decodeURIComponent(adminTxDeleteMatch[1]);
          const target = db.transactions.find((t) => t.id === txId && !t.adminCleared);
          if (!target) return errJson('Transaction record not found', 404);
          target.adminCleared = true;
          this.logAudit(
            currentUser.email,
            'DELETE_TRANSACTION',
            target.userEmail,
            `Cleared ${target.type} (${target.id}) from Overwatch (user history preserved)`,
          );
          this.persistKeys('transactions', 'auditLogs');
          return okJson({ ok: true });
        }

        // --- BOOSTING ADMIN ---
        if (method === 'POST' && pathname === '/api/admin/boosting-orders/bulk-status') {
          const body = await readJsonBody(request);
          const fromStatus = String(body.fromStatus || '');
          const toStatus = String(body.toStatus || '');
          if (
            !['pending', 'processing', 'refilling'].includes(fromStatus) ||
            !['processing', 'completed'].includes(toStatus)
          ) {
            return errJson('Invalid bulk status transition', 400);
          }
          const now = new Date().toISOString();
          let updatedCount = 0;
          for (const order of db.boostingOrders) {
            if (!order.adminCleared && order.status === fromStatus) {
              order.status = toStatus as 'processing' | 'completed';
              if (toStatus === 'completed') order.remains = 0;
              order.updatedAt = now;
              updatedCount += 1;
            }
          }
          if (updatedCount > 0) {
            this.logAudit(
              currentUser.email,
              'BULK_BOOSTING_STATUS',
              `${fromStatus} -> ${toStatus}`,
              `Updated ${updatedCount} boosting orders`,
            );
            this.persistKeys('boostingOrders', 'auditLogs');
          }
          return okJson({ updatedCount });
        }

        const adminBoostMatch = pathname.match(/^\/api\/admin\/boosting-orders\/([^/]+)$/);
        if (adminBoostMatch && method === 'PATCH') {
          const orderId = decodeURIComponent(adminBoostMatch[1]);
          const order = db.boostingOrders.find((o) => o.id === orderId);
          if (!order) return errJson('Boosting order not found', 404);
          const body = await readJsonBody(request);
          const nextStatus = body.status;
          if (
            nextStatus === 'pending' ||
            nextStatus === 'processing' ||
            nextStatus === 'completed' ||
            nextStatus === 'cancelled' ||
            nextStatus === 'refilling'
          ) {
            if (nextStatus === 'cancelled' && order.status !== 'cancelled') {
              const user = db.users.find((u) => u.id === order.userId);
              if (user) {
                user.balance += order.amount;
                db.transactions.unshift({
                  id: makeId('tx'),
                  userId: user.id,
                  userName: user.name,
                  userEmail: user.email,
                  type: 'refund',
                  amount: order.amount,
                  status: 'completed',
                  description: `Refund for cancelled boost order ${order.id}`,
                  createdAt: new Date().toISOString(),
                });
              }
            }
            order.status = nextStatus;
            if (nextStatus === 'completed') order.remains = 0;
          }
          if (typeof body.remains === 'number') {
            order.remains = Math.max(0, body.remains);
          }
          order.updatedAt = new Date().toISOString();
          this.persistKeys('boostingOrders', 'users', 'transactions');
          return okJson({ order });
        }

        if (adminBoostMatch && method === 'DELETE') {
          const orderId = decodeURIComponent(adminBoostMatch[1]);
          const target = db.boostingOrders.find((o) => o.id === orderId && !o.adminCleared);
          if (!target) return errJson('Boosting order not found', 404);
          target.adminCleared = true;
          this.logAudit(
            currentUser.email,
            'DELETE_BOOSTING_ORDER',
            orderId,
            'Cleared boosting order from Overwatch (user copy preserved)',
          );
          this.persistKeys('boostingOrders', 'auditLogs');
          return okJson({ ok: true });
        }

        // --- SMS ADMIN ---
        const smsAssignMatch = pathname.match(/^\/api\/admin\/sms-orders\/([^/]+)\/assign-number$/);
        if (method === 'POST' && smsAssignMatch) {
          this.expireTimedOutSmsOrders();
          const orderId = decodeURIComponent(smsAssignMatch[1]);
          const order = db.smsOrders.find((o) => o.id === orderId);
          if (!order) return errJson('SMS order not found', 404);
          if (order.status === 'cancelled' || order.status === 'expired') {
            return errJson(`Cannot assign a number to a ${order.status} order`, 400);
          }
          const body = await readJsonBody(request);
          const phoneNumber = String(body.phoneNumber || '').trim();
          if (!phoneNumber) return errJson('Phone number is required', 400);
          order.phoneNumber = phoneNumber;
          if (order.status === 'waiting') {
            order.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          }
          db.notifications.unshift({
            id: makeId('ntf'),
            title: `Number Assigned (${order.serviceName})`,
            message: `Your number ${phoneNumber} is now ready in your SMS Inbox. 15-minute OTP timer active.`,
            type: 'info',
            targetUserId: order.userId,
            readBy: [],
            createdAt: new Date().toISOString(),
          });
          this.logAudit(
            currentUser.email,
            'ASSIGN_SMS_NUMBER',
            order.id,
            `Assigned ${phoneNumber} to ${order.userEmail} (${order.serviceName})`,
          );
          this.persistKeys('smsOrders', 'notifications', 'auditLogs');
          this.scheduleNextSmsExpiryAlarm();
          return okJson({ order });
        }

        const smsDeliverMatch = pathname.match(/^\/api\/admin\/sms-orders\/([^/]+)\/deliver$/);
        if (method === 'POST' && smsDeliverMatch) {
          this.expireTimedOutSmsOrders();
          const orderId = decodeURIComponent(smsDeliverMatch[1]);
          const order = db.smsOrders.find((o) => o.id === orderId);
          if (!order) return errJson('SMS order not found', 404);
          if (order.status === 'cancelled' || order.status === 'expired') {
            return errJson(`Cannot deliver an OTP to a ${order.status} order`, 400);
          }
          const body = await readJsonBody(request);
          const phoneNumberInput = String(body.phoneNumber || '').trim();
          if (phoneNumberInput) order.phoneNumber = phoneNumberInput;
          const otpCode = String(body.otpCode || '').trim();
          if (!otpCode) return errJson('OTP code is required', 400);
          const svc = db.smsServices.find((s) => s.id === order.serviceId);
          order.status = 'received';
          order.otpCode = otpCode;
          order.smsText =
            String(body.smsText || '').trim() ||
            (svc?.sampleTemplate || 'Your verification code is {{CODE}}').replace('{{CODE}}', otpCode);
          db.notifications.unshift({
            id: makeId('ntf'),
            title: `OTP Delivered (${order.serviceName})`,
            message: `Your OTP code ${otpCode} for ${order.phoneNumber} has arrived in your SMS Inbox.`,
            type: 'success',
            targetUserId: order.userId,
            readBy: [],
            createdAt: new Date().toISOString(),
          });
          this.logAudit(
            currentUser.email,
            'DELIVER_SMS_OTP',
            order.id,
            `Delivered OTP ${otpCode} to ${order.userEmail} (${order.phoneNumber})`,
          );
          this.persistKeys('smsOrders', 'notifications', 'auditLogs');
          return okJson({ order });
        }

        const smsDeleteMatch = pathname.match(/^\/api\/admin\/sms-orders\/([^/]+)$/);
        if (method === 'DELETE' && smsDeleteMatch) {
          const orderId = decodeURIComponent(smsDeleteMatch[1]);
          const target = db.smsOrders.find((o) => o.id === orderId && !o.adminCleared);
          if (!target) return errJson('SMS order not found', 404);
          target.adminCleared = true;
          this.logAudit(
            currentUser.email,
            'DELETE_SMS_ORDER',
            orderId,
            'Cleared SMS order from Overwatch (user copy preserved)',
          );
          this.persistKeys('smsOrders', 'auditLogs');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/sms-pool') {
          const body = await readJsonBody(request);
          const phoneNumber = String(body.phoneNumber || '').trim();
          const countryId = String(body.countryId || 'cnt_us');
          const serviceId = String(body.serviceId || '');
          const presetOtp = String(body.presetOtp || '').trim();
          if (!phoneNumber) return errJson('Phone number is required', 400);
          const item = {
            id: makeId('pool'),
            phoneNumber,
            countryId,
            serviceId,
            presetOtp,
            used: false,
            createdAt: new Date().toISOString(),
          };
          db.smsPool.unshift(item);
          this.persistKeys('smsPool');
          return okJson({ item }, 201);
        }

        const smsPoolDelMatch = pathname.match(/^\/api\/admin\/sms-pool\/([^/]+)$/);
        if (method === 'DELETE' && smsPoolDelMatch) {
          const id = decodeURIComponent(smsPoolDelMatch[1]);
          db.smsPool = db.smsPool.filter((p) => p.id !== id);
          this.persistKeys('smsPool');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/orders/clear') {
          const body = await readJsonBody(request);
          const scope = String(body.scope || 'completed');
          if (scope === 'all') {
            for (const s of db.smsOrders) s.adminCleared = true;
            for (const b of db.boostingOrders) b.adminCleared = true;
            for (const v of db.vaultItems) v.adminCleared = true;
          } else if (scope === 'sms') {
            for (const s of db.smsOrders) s.adminCleared = true;
          } else if (scope === 'boosting') {
            for (const b of db.boostingOrders) b.adminCleared = true;
          } else if (scope === 'vault') {
            for (const v of db.vaultItems) v.adminCleared = true;
          } else {
            for (const s of db.smsOrders) {
              if (s.status !== 'waiting') s.adminCleared = true;
            }
            for (const b of db.boostingOrders) {
              if (b.status !== 'pending' && b.status !== 'processing' && b.status !== 'refilling') {
                b.adminCleared = true;
              }
            }
          }
          this.logAudit(
            currentUser.email,
            'CLEAR_ORDERS',
            scope,
            `Cleared orders from Overwatch (${scope}); user order history preserved`,
          );
          this.persistKeys('smsOrders', 'boostingOrders', 'vaultItems', 'auditLogs');
          return okJson({ ok: true });
        }

        // --- ADMIN CATALOG CRUD ---
        if (method === 'POST' && pathname === '/api/admin/sms-services') {
          const body = await readJsonBody(request);
          const svc: SmsService = {
            id: makeId('svc'),
            name: String(body.name || 'New Service').trim(),
            category: String(body.category || 'General').trim(),
            basePrice: Math.max(50, Number(body.basePrice || 1000)),
            successRate: Math.min(100, Math.max(50, Number(body.successRate || 98.5))),
            stock: Math.max(0, Number(body.stock || 500)),
            active: body.active !== false,
            sampleTemplate: String(body.sampleTemplate || 'Your verification code is {{CODE}}.'),
          };
          db.smsServices.push(svc);
          this.persistKeys('smsServices');
          return okJson({ service: svc }, 201);
        }

        const smsSvcMatch = pathname.match(/^\/api\/admin\/sms-services\/([^/]+)$/);
        if (smsSvcMatch && method === 'PATCH') {
          const id = decodeURIComponent(smsSvcMatch[1]);
          const svc = db.smsServices.find((s) => s.id === id);
          if (!svc) return errJson('SMS service not found', 404);
          const body = await readJsonBody(request);
          Object.assign(svc, {
            name: typeof body.name === 'string' ? body.name : svc.name,
            category: typeof body.category === 'string' ? body.category : svc.category,
            basePrice: typeof body.basePrice === 'number' ? body.basePrice : svc.basePrice,
            successRate: typeof body.successRate === 'number' ? body.successRate : svc.successRate,
            stock: typeof body.stock === 'number' ? body.stock : svc.stock,
            active: typeof body.active === 'boolean' ? body.active : svc.active,
            sampleTemplate:
              typeof body.sampleTemplate === 'string' ? body.sampleTemplate : svc.sampleTemplate,
          });
          this.persistKeys('smsServices');
          return okJson({ service: svc });
        }

        if (smsSvcMatch && method === 'DELETE') {
          const id = decodeURIComponent(smsSvcMatch[1]);
          db.smsServices = db.smsServices.filter((s) => s.id !== id);
          this.persistKeys('smsServices');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/sms-countries') {
          const body = await readJsonBody(request);
          const country: SmsCountry = {
            id: makeId('cnt'),
            name: String(body.name || 'New Country').trim(),
            code: String(body.code || 'XX').trim().toUpperCase(),
            dialCode: String(body.dialCode || '+1').trim(),
            multiplier: Math.max(0.1, Number(body.multiplier || 1)),
            active: body.active !== false,
          };
          db.smsCountries.push(country);
          this.persistKeys('smsCountries');
          return okJson({ country }, 201);
        }

        const smsCntMatch = pathname.match(/^\/api\/admin\/sms-countries\/([^/]+)$/);
        if (smsCntMatch && method === 'PATCH') {
          const id = decodeURIComponent(smsCntMatch[1]);
          const country = db.smsCountries.find((c) => c.id === id);
          if (!country) return errJson('Country not found', 404);
          const body = await readJsonBody(request);
          Object.assign(country, {
            name: typeof body.name === 'string' ? body.name : country.name,
            code: typeof body.code === 'string' ? body.code : country.code,
            dialCode: typeof body.dialCode === 'string' ? body.dialCode : country.dialCode,
            multiplier: typeof body.multiplier === 'number' ? body.multiplier : country.multiplier,
            active: typeof body.active === 'boolean' ? body.active : country.active,
          });
          this.persistKeys('smsCountries');
          return okJson({ country });
        }

        if (smsCntMatch && method === 'DELETE') {
          const id = decodeURIComponent(smsCntMatch[1]);
          db.smsCountries = db.smsCountries.filter((c) => c.id !== id);
          this.persistKeys('smsCountries');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/boosting-services') {
          const body = await readJsonBody(request);
          const item: BoostingService = {
            id: makeId('bst'),
            platform: String(body.platform || 'Instagram').trim(),
            category: String(body.category || 'Followers').trim(),
            name: String(body.name || 'New Boosting Package').trim(),
            ratePer1k: Math.max(50, Number(body.ratePer1k || 1000)),
            minQty: Math.max(10, Number(body.minQty || 50)),
            maxQty: Math.max(100, Number(body.maxQty || 100_000)),
            speedLabel: String(body.speedLabel || '10K / day').trim(),
            refillPolicy: String(body.refillPolicy || '30-Day Refill').trim(),
            active: body.active !== false,
          };
          db.boostingServices.push(item);
          this.persistKeys('boostingServices');
          return okJson({ service: item }, 201);
        }

        const boostSvcMatch = pathname.match(/^\/api\/admin\/boosting-services\/([^/]+)$/);
        if (boostSvcMatch && method === 'PATCH') {
          const id = decodeURIComponent(boostSvcMatch[1]);
          const item = db.boostingServices.find((b) => b.id === id);
          if (!item) return errJson('Boosting service not found', 404);
          const body = await readJsonBody(request);
          Object.assign(item, {
            platform: typeof body.platform === 'string' ? body.platform : item.platform,
            category: typeof body.category === 'string' ? body.category : item.category,
            name: typeof body.name === 'string' ? body.name : item.name,
            ratePer1k: typeof body.ratePer1k === 'number' ? body.ratePer1k : item.ratePer1k,
            minQty: typeof body.minQty === 'number' ? body.minQty : item.minQty,
            maxQty: typeof body.maxQty === 'number' ? body.maxQty : item.maxQty,
            speedLabel: typeof body.speedLabel === 'string' ? body.speedLabel : item.speedLabel,
            refillPolicy:
              typeof body.refillPolicy === 'string' ? body.refillPolicy : item.refillPolicy,
            active: typeof body.active === 'boolean' ? body.active : item.active,
          });
          this.persistKeys('boostingServices');
          return okJson({ service: item });
        }

        if (boostSvcMatch && method === 'DELETE') {
          const id = decodeURIComponent(boostSvcMatch[1]);
          db.boostingServices = db.boostingServices.filter((b) => b.id !== id);
          this.persistKeys('boostingServices');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/marketplace-categories') {
          const body = await readJsonBody(request);
          const name = String(body.name || '').trim();
          if (!name) return errJson('Category name is required', 400);
          const cat = {
            id: makeId('cat'),
            name,
            description: String(body.description || '').trim(),
          };
          db.marketplaceCategories.push(cat);
          this.persistKeys('marketplaceCategories');
          return okJson({ category: cat }, 201);
        }

        const mktCatDelMatch = pathname.match(/^\/api\/admin\/marketplace-categories\/([^/]+)$/);
        if (method === 'DELETE' && mktCatDelMatch) {
          const id = decodeURIComponent(mktCatDelMatch[1]);
          db.marketplaceCategories = db.marketplaceCategories.filter((c) => c.id !== id);
          this.persistKeys('marketplaceCategories');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/marketplace-listings') {
          const body = await readJsonBody(request);
          const featuresRaw = body.features;
          const features = Array.isArray(featuresRaw)
            ? featuresRaw.map(String)
            : String(featuresRaw || '')
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
          const stockKeysRaw = body.stockKeys;
          const stockKeys = Array.isArray(stockKeysRaw)
            ? stockKeysRaw.map(String)
            : String(stockKeysRaw || '')
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);

          const computedStock =
            stockKeys.length > 0 ? stockKeys.length : Math.max(0, Number(body.stock ?? 0));

          const listing: MarketplaceListing = {
            id: makeId('mkt'),
            title: String(body.title || 'New Digital Asset').trim(),
            category: String(body.category || 'Proxies').trim(),
            popularTag: String(body.popularTag || 'Proxy').trim(),
            shortSpec: String(body.shortSpec || 'Instant digital delivery').trim(),
            description: String(body.description || '').trim(),
            buyWarning: String(body.buyWarning || db.settings.defaultBuyWarning).trim(),
            features: features.length
              ? features
              : ['Instant Vault Key Delivery', 'Verified Quality'],
            price: Math.max(100, Number(body.price || 2500)),
            stock: computedStock,
            deliveryType: String(body.deliveryType || 'Login, Password & 2FA').trim(),
            imageUrl:
              String(body.imageUrl || '').trim() ||
              '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
            logoUrl: String(body.logoUrl || '').trim(),
            bounceLogo: Boolean(body.bounceLogo),
            credentialTemplate: String(
              body.credentialTemplate || 'LICENSE-{{KEY4}}-{{KEY4}}-{{RAND4}}',
            ),
            stockKeys,
            soldCount: 0,
            active: body.active !== false,
          };
          db.marketplaceListings.unshift(listing);
          this.logAudit(
            currentUser.email,
            'CREATE_LISTING',
            listing.title,
            `Price: ${listing.price}, Accounts: ${stockKeys.length}`,
          );
          this.persistKeys('marketplaceListings', 'auditLogs');
          return okJson({ listing }, 201);
        }

        const mktListMatch = pathname.match(/^\/api\/admin\/marketplace-listings\/([^/]+)$/);
        if (mktListMatch && method === 'PATCH') {
          const id = decodeURIComponent(mktListMatch[1]);
          const item = db.marketplaceListings.find((l) => l.id === id);
          if (!item) return errJson('Listing not found', 404);
          const body = await readJsonBody(request);
          if (body.features !== undefined) {
            item.features = Array.isArray(body.features)
              ? body.features.map(String)
              : String(body.features)
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
          }
          if (body.stockKeys !== undefined) {
            item.stockKeys = Array.isArray(body.stockKeys)
              ? body.stockKeys.map(String)
              : String(body.stockKeys)
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
          }
          const nextStock =
            body.stockKeys !== undefined && item.stockKeys.length > 0
              ? item.stockKeys.length
              : typeof body.stock === 'number'
                ? body.stock
                : item.stock;
          Object.assign(item, {
            title: typeof body.title === 'string' ? body.title : item.title,
            category: typeof body.category === 'string' ? body.category : item.category,
            popularTag: typeof body.popularTag === 'string' ? body.popularTag : item.popularTag,
            shortSpec: typeof body.shortSpec === 'string' ? body.shortSpec : item.shortSpec,
            description: typeof body.description === 'string' ? body.description : item.description,
            buyWarning: typeof body.buyWarning === 'string' ? body.buyWarning : item.buyWarning,
            deliveryType:
              typeof body.deliveryType === 'string' ? body.deliveryType : item.deliveryType,
            price: typeof body.price === 'number' ? body.price : item.price,
            stock: nextStock,
            imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : item.imageUrl,
            logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : item.logoUrl,
            bounceLogo: typeof body.bounceLogo === 'boolean' ? body.bounceLogo : item.bounceLogo,
            credentialTemplate:
              typeof body.credentialTemplate === 'string'
                ? body.credentialTemplate
                : item.credentialTemplate,
            active: typeof body.active === 'boolean' ? body.active : item.active,
          });
          this.logAudit(
            currentUser.email,
            'UPDATE_LISTING',
            item.title,
            `Price: ${item.price}, Stock: ${item.stock}`,
          );
          this.persistKeys('marketplaceListings', 'auditLogs');
          return okJson({ listing: item });
        }

        if (mktListMatch && method === 'DELETE') {
          const id = decodeURIComponent(mktListMatch[1]);
          const target = db.marketplaceListings.find((l) => l.id === id);
          db.marketplaceListings = db.marketplaceListings.filter((l) => l.id !== id);
          if (target) {
            this.logAudit(
              currentUser.email,
              'DELETE_LISTING',
              target.title,
              'Removed from marketplace',
            );
          }
          this.persistKeys('marketplaceListings', 'auditLogs');
          return okJson({ ok: true });
        }

        // --- SECTIONS ---
        if (method === 'POST' && pathname === '/api/admin/sections') {
          const body = await readJsonBody(request);
          const section: CustomSection = {
            id: makeId('sec'),
            name: String(body.name || 'Special Deals').trim(),
            icon: String(body.icon || 'layers').trim(),
            description: String(body.description || '').trim(),
            active: body.active !== false,
            products: [],
          };
          db.customSections.push(section);
          this.persistKeys('customSections');
          return okJson({ section }, 201);
        }

        const adminSecMatch = pathname.match(/^\/api\/admin\/sections\/([^/]+)$/);
        if (adminSecMatch && method === 'PATCH') {
          const id = decodeURIComponent(adminSecMatch[1]);
          const section = db.customSections.find((s) => s.id === id);
          if (!section) return errJson('Section not found', 404);
          const body = await readJsonBody(request);
          if (typeof body.name === 'string') section.name = body.name;
          if (typeof body.icon === 'string') section.icon = body.icon;
          if (typeof body.description === 'string') section.description = body.description;
          if (typeof body.active === 'boolean') section.active = body.active;
          this.persistKeys('customSections');
          return okJson({ section });
        }

        if (adminSecMatch && method === 'DELETE') {
          const id = decodeURIComponent(adminSecMatch[1]);
          db.customSections = db.customSections.filter((s) => s.id !== id);
          this.persistKeys('customSections');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/section-products') {
          const body = await readJsonBody(request);
          const sectionId = String(body.sectionId || '');
          const section = db.customSections.find((s) => s.id === sectionId);
          if (!section) return errJson('Target section not found', 404);
          const product: CustomSectionProduct = {
            id: makeId('sprod'),
            sectionId,
            title: String(body.title || 'Section Product').trim(),
            shortSpec: String(body.shortSpec || 'Instant access').trim(),
            description: String(body.description || '').trim(),
            buyWarning: String(body.buyWarning || db.settings.defaultBuyWarning).trim(),
            price: Math.max(50, Number(body.price || 1500)),
            stock: Math.max(0, Number(body.stock || 25)),
            imageUrl:
              String(body.imageUrl || '').trim() ||
              '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
            logoUrl: String(body.logoUrl || '').trim(),
            bounceLogo: Boolean(body.bounceLogo),
            credentialTemplate: String(
              body.credentialTemplate || 'KEY-{{KEY4}}-{{KEY4}}-{{RAND4}}',
            ),
            active: body.active !== false,
          };
          section.products.push(product);
          this.persistKeys('customSections');
          return okJson({ product }, 201);
        }

        const secProdDelMatch = pathname.match(/^\/api\/admin\/section-products\/([^/]+)$/);
        if (method === 'DELETE' && secProdDelMatch) {
          const id = decodeURIComponent(secProdDelMatch[1]);
          db.customSections.forEach((s) => {
            s.products = s.products.filter((p) => p.id !== id);
          });
          this.persistKeys('customSections');
          return okJson({ ok: true });
        }

        // --- PROMO CODES ---
        if (method === 'POST' && pathname === '/api/admin/promo-codes') {
          const body = await readJsonBody(request);
          const code = String(body.code || '').trim().toUpperCase();
          if (!code) return errJson('Promo code text is required', 400);
          const promo: PromoCode = {
            id: makeId('prm'),
            code,
            discountType: body.discountType === 'fixed' ? 'fixed' : 'percent',
            value: Math.max(1, Number(body.value || 10)),
            uses: 0,
            maxUses: Math.max(1, Number(body.maxUses || 100)),
            active: true,
            createdAt: new Date().toISOString(),
          };
          db.promoCodes.unshift(promo);
          this.persistKeys('promoCodes');
          return okJson({ promo }, 201);
        }

        const promoToggleMatch = pathname.match(/^\/api\/admin\/promo-codes\/([^/]+)\/toggle$/);
        if (method === 'PATCH' && promoToggleMatch) {
          const id = decodeURIComponent(promoToggleMatch[1]);
          const promo = db.promoCodes.find((p) => p.id === id);
          if (!promo) return errJson('Promo code not found', 404);
          promo.active = !promo.active;
          this.logAudit(currentUser.email, 'TOGGLE_PROMO', promo.code, `Active: ${promo.active}`);
          this.persistKeys('promoCodes', 'auditLogs');
          return okJson({ promo });
        }

        const promoDelMatch = pathname.match(/^\/api\/admin\/promo-codes\/([^/]+)$/);
        if (method === 'DELETE' && promoDelMatch) {
          const id = decodeURIComponent(promoDelMatch[1]);
          db.promoCodes = db.promoCodes.filter((p) => p.id !== id);
          this.persistKeys('promoCodes');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/audit-logs/clear') {
          const count = db.auditLogs.length;
          db.auditLogs = [];
          this.logAudit(
            currentUser.email,
            'CLEAR_AUDIT_LOGS',
            'Audit Trail',
            `Cleared ${count} older logs`,
          );
          this.persistKeys('auditLogs');
          return okJson({ ok: true });
        }

        // --- NOTIFICATIONS, EMAIL, TUTORIALS, TICKETS ---
        if (method === 'POST' && pathname === '/api/admin/notifications') {
          const body = await readJsonBody(request);
          const item = {
            id: makeId('ntf'),
            title: String(body.title || 'Platform Notice').trim(),
            message: String(body.message || '').trim(),
            type: (['info', 'success', 'warning'].includes(String(body.type || ''))
              ? String(body.type)
              : 'info') as 'info' | 'success' | 'warning',
            targetUserId: String(body.targetUserId || 'all').trim(),
            readBy: [] as string[],
            createdAt: new Date().toISOString(),
          };
          if (!item.message) return errJson('Notification message is required', 400);
          db.notifications.unshift(item);
          this.persistKeys('notifications');
          return okJson({ notification: item }, 201);
        }

        const ntfDelMatch = pathname.match(/^\/api\/admin\/notifications\/([^/]+)$/);
        if (method === 'DELETE' && ntfDelMatch) {
          const id = decodeURIComponent(ntfDelMatch[1]);
          db.notifications = db.notifications.filter((n) => n.id !== id);
          this.persistKeys('notifications');
          return okJson({ ok: true });
        }

        if (method === 'POST' && pathname === '/api/admin/email') {
          const body = await readJsonBody(request);
          const to = String(body.to || '').trim().toLowerCase();
          const subject = String(body.subject || '').trim();
          const emailBody = String(body.body || '').trim();
          if (!to || !subject || !emailBody) {
            return errJson('Recipient email, subject, and body are required', 400);
          }
          const now = new Date().toISOString();
          const log = {
            id: makeId('mail'),
            to,
            subject,
            body: emailBody,
            sentBy: currentUser.email,
            createdAt: now,
          };
          db.emailLogs.unshift(log);

          const targetUser = db.users.find((u) => u.email.toLowerCase() === to);
          if (targetUser) {
            db.notifications.unshift({
              id: makeId('ntf'),
              title: `Direct Message: ${subject}`,
              message: emailBody,
              type: 'info',
              targetUserId: targetUser.id,
              readBy: [],
              createdAt: now,
            });
          }

          this.persistKeys('emailLogs', 'notifications');
          const safeSubject = subject.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const safeBody = emailBody.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          this.ctx.waitUntil(
            sendTransactionalEmailWeb({
              to,
              subject,
              text: emailBody,
              html: `<div style="font-family:sans-serif;padding:24px;color:#0F172A;"><h2 style="margin:0 0 12px;">${safeSubject}</h2><p style="white-space:pre-line;line-height:1.6;">${safeBody}</p></div>`,
              settings: db.settings,
              envResendApiKey: this.env.RESEND_API_KEY,
            }),
          );
          return okJson({ log }, 201);
        }

        if (method === 'POST' && pathname === '/api/admin/tutorials') {
          const body = await readJsonBody(request);
          const tutorial = {
            id: makeId('tut'),
            title: String(body.title || 'New Guide').trim(),
            category: String(body.category || 'General').trim(),
            duration: String(body.duration || '2 min read').trim(),
            summary: String(body.summary || '').trim(),
            content: String(body.content || '').trim(),
            videoUrl: String(body.videoUrl || '').trim(),
            createdAt: new Date().toISOString(),
          };
          db.tutorials.unshift(tutorial);
          this.persistKeys('tutorials');
          return okJson({ tutorial }, 201);
        }

        const tutDelMatch = pathname.match(/^\/api\/admin\/tutorials\/([^/]+)$/);
        if (method === 'DELETE' && tutDelMatch) {
          const id = decodeURIComponent(tutDelMatch[1]);
          db.tutorials = db.tutorials.filter((t) => t.id !== id);
          this.persistKeys('tutorials');
          return okJson({ ok: true });
        }

        const ticketStatusMatch = pathname.match(/^\/api\/admin\/tickets\/([^/]+)\/status$/);
        if (method === 'PATCH' && ticketStatusMatch) {
          const id = decodeURIComponent(ticketStatusMatch[1]);
          const ticket = db.tickets.find((t) => t.id === id);
          if (!ticket) return errJson('Ticket not found', 404);
          const body = await readJsonBody(request);
          if (['open', 'in_progress', 'resolved', 'closed'].includes(String(body.status || ''))) {
            ticket.status = body.status as 'open' | 'in_progress' | 'resolved' | 'closed';
            ticket.updatedAt = new Date().toISOString();
            this.persistKeys('tickets');
          }
          return okJson({ ticket });
        }

        if (method === 'POST' && pathname === '/api/admin/activity/refresh') {
          db.adminAlerts = [];
          db.auditLogs = [];
          db.emailLogs = [];
          this.persistKeys('adminAlerts', 'auditLogs', 'emailLogs');
          return okJson({ ok: true });
        }

        // --- SETTINGS ---
        if (method === 'PATCH' && pathname === '/api/admin/settings') {
          const s: PlatformSettings = db.settings;
          const body = await readJsonBody(request);

          if (typeof body.siteName === 'string' && body.siteName.trim()) {
            s.siteName = body.siteName.trim();
          }
          if (typeof body.siteLogoUrl === 'string') s.siteLogoUrl = body.siteLogoUrl.trim();
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
          if (isHex(body.surfaceBgLight)) s.surfaceBgLight = body.surfaceBgLight.trim().toUpperCase();
          if (isHex(body.surfaceBgDark)) s.surfaceBgDark = body.surfaceBgDark.trim().toUpperCase();
          if (typeof body.colorPreset === 'string' && body.colorPreset.trim()) {
            s.colorPreset = body.colorPreset.trim();
          }
          if (typeof body.maintenanceMode === 'boolean') s.maintenanceMode = body.maintenanceMode;
          if (typeof body.supportEmail === 'string') s.supportEmail = body.supportEmail.trim();
          if (typeof body.supportWhatsapp === 'string') s.supportWhatsapp = body.supportWhatsapp.trim();
          if (typeof body.showFloatingWhatsapp === 'boolean') {
            s.showFloatingWhatsapp = body.showFloatingWhatsapp;
          }
          if (typeof body.creatorName === 'string') s.creatorName = body.creatorName.trim();
          if (typeof body.creatorUrl === 'string') s.creatorUrl = body.creatorUrl.trim();
          if (typeof body.allowNewSignups === 'boolean') s.allowNewSignups = body.allowNewSignups;
          if (typeof body.enableSmsService === 'boolean') s.enableSmsService = body.enableSmsService;
          if (typeof body.enableBoostingService === 'boolean') {
            s.enableBoostingService = body.enableBoostingService;
          }
          if (typeof body.enableMarketplace === 'boolean') {
            s.enableMarketplace = body.enableMarketplace;
          }
          if (typeof body.allowPromoCodes === 'boolean') s.allowPromoCodes = body.allowPromoCodes;
          if (typeof body.showLandingShowcase === 'boolean') {
            s.showLandingShowcase = body.showLandingShowcase;
          }
          if (typeof body.showLandingRates === 'boolean') {
            s.showLandingRates = body.showLandingRates;
          }
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
          if (
            typeof body.referralBonusAmount === 'number' &&
            Number.isFinite(body.referralBonusAmount)
          ) {
            s.referralBonusAmount = Math.max(0, body.referralBonusAmount);
          }
          if (typeof body.welcomePromoEnabled === 'boolean') {
            s.welcomePromoEnabled = body.welcomePromoEnabled;
          }
          if (
            typeof body.welcomePromoAmount === 'number' &&
            Number.isFinite(body.welcomePromoAmount)
          ) {
            s.welcomePromoAmount = Math.max(0, body.welcomePromoAmount);
          }
          if (typeof body.landingVideoUrl === 'string') {
            s.landingVideoUrl = body.landingVideoUrl.trim();
          }
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
          if (typeof body.heroKicker === 'string') s.heroKicker = body.heroKicker.trim();
          if (typeof body.heroHeadline === 'string' && body.heroHeadline.trim()) {
            s.heroHeadline = body.heroHeadline.trim();
          }
          if (typeof body.heroSecondaryHeadline === 'string') {
            s.heroSecondaryHeadline = body.heroSecondaryHeadline.trim();
          }
          if (typeof body.heroSubheadline === 'string') {
            s.heroSubheadline = body.heroSubheadline.trim();
          }
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
            s.landingShowcaseCards = body.landingShowcaseCards.slice(0, 9).map(
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
          if (typeof body.workflowKicker === 'string') s.workflowKicker = body.workflowKicker.trim();
          if (typeof body.workflowTitle === 'string') s.workflowTitle = body.workflowTitle.trim();
          if (typeof body.workflowSubtitle === 'string') {
            s.workflowSubtitle = body.workflowSubtitle.trim();
          }
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
          if (typeof body.smtpHost === 'string') s.smtpHost = body.smtpHost.trim();
          if (typeof body.smtpPort === 'number' && Number.isFinite(body.smtpPort)) {
            s.smtpPort = Math.max(1, body.smtpPort);
          }
          if (typeof body.smtpUser === 'string') s.smtpUser = body.smtpUser.trim();
          if (typeof body.smtpPass === 'string') s.smtpPass = body.smtpPass.trim();
          if (typeof body.smtpFrom === 'string') s.smtpFrom = body.smtpFrom.trim();
          if (typeof body.resendApiKey === 'string') s.resendApiKey = body.resendApiKey.trim();

          this.logAudit(
            currentUser.email,
            'UPDATE_SETTINGS',
            'Overwatch Settings',
            'Saved global configuration',
          );
          this.persistKeys('settings', 'auditLogs');
          return okJson({ settings: s });
        }
      }

      if (pathname.startsWith('/api/')) {
        return errJson('API endpoint not found', 404);
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_JSON_BODY') {
        return jsonResponse({ error: 'Invalid JSON request payload' }, 400, request, this.env);
      }
      console.error('Worker API internal error:', err);
      return jsonResponse(
        { error: 'Internal server error processing request.' },
        500,
        request,
        this.env,
      );
    }
  }
}
