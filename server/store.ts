import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AccountingRecord, AdminAlert } from '../src/types.ts';
import type { DatabaseState, PendingSignupVerification, StoredUser } from '../shared/dbTypes.ts';
import {
  createInitialDatabaseState,
  HEAD_ADMIN_DEFAULT_PASSWORD,
  HEAD_ADMIN_EMAIL,
  HEAD_ADMIN_NAME,
  HEAD_ADMIN_REFERRAL_CODE,
  mergeParsedDatabaseState,
} from '../shared/initialData.ts';

export type { DatabaseState, PendingSignupVerification, StoredUser };

const DATA_DIR = process.env.SUREDEAL_DATA_DIR
  ? path.resolve(process.env.SUREDEAL_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'suredeal-store.json');
const BACKUP_DB_PATH = path.join(DATA_DIR, 'suredeal-store.backup.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function toPublicUser(user: StoredUser) {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createInitialState(): DatabaseState {
  return createInitialDatabaseState(hashPassword(HEAD_ADMIN_DEFAULT_PASSWORD));
}

class StoreManager {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadFromDisk();
    this.ensureHeadAdmin();
  }

  private mergeParsedState(parsed: Partial<DatabaseState>): DatabaseState {
    return mergeParsedDatabaseState(parsed, hashPassword(HEAD_ADMIN_DEFAULT_PASSWORD));
  }

  private loadFromDisk(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      for (const candidate of [DB_PATH, BACKUP_DB_PATH]) {
        if (fs.existsSync(candidate)) {
          try {
            const raw = fs.readFileSync(candidate, 'utf8');
            const parsed = JSON.parse(raw) as Partial<DatabaseState>;
            const merged = this.mergeParsedState(parsed);
            if (candidate === BACKUP_DB_PATH) {
              this.persist(merged);
            }
            return merged;
          } catch (readErr) {
            console.error(`Failed to parse ${candidate}, checking fallback:`, readErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load DB from disk, initializing fresh state:', err);
    }
    const fresh = createInitialState();
    this.persist(fresh);
    return fresh;
  }

  private ensureHeadAdmin(): void {
    const mainEmail = (this.state.settings.mainAdminEmail || HEAD_ADMIN_EMAIL).toLowerCase();
    const existing = this.state.users.find(
      (u) =>
        u.id === 'usr_head_admin' ||
        Boolean(u.isMainAdmin) ||
        u.email.toLowerCase() === mainEmail,
    );
    if (!existing) {
      const targetEmail = this.state.settings.mainAdminEmail || HEAD_ADMIN_EMAIL;
      this.state.users.unshift({
        id: 'usr_head_admin',
        name: HEAD_ADMIN_NAME,
        email: targetEmail,
        passwordHash: hashPassword(HEAD_ADMIN_DEFAULT_PASSWORD),
        role: 'admin',
        isMainAdmin: true,
        authProvider: 'email',
        emailVerified: true,
        balance: 250000,
        status: 'active',
        referralCode: HEAD_ADMIN_REFERRAL_CODE,
        createdAt: new Date().toISOString(),
      });
      this.save();
    } else {
      let dirty = false;
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        dirty = true;
      }
      if (existing.status !== 'active') {
        existing.status = 'active';
        dirty = true;
      }
      if (!existing.isMainAdmin) {
        existing.isMainAdmin = true;
        dirty = true;
      }
      if (existing.allowedAdminTab !== undefined) {
        existing.allowedAdminTab = undefined;
        dirty = true;
      }
      if (!existing.emailVerified) {
        existing.emailVerified = true;
        dirty = true;
      }
      if (this.state.settings.mainAdminEmail !== existing.email) {
        this.state.settings.mainAdminEmail = existing.email;
        dirty = true;
      }
      if (dirty) {
        this.save();
      }
    }
  }

  private persist(nextState: DatabaseState): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(nextState, null, 2);
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
    const backupTmp = `${BACKUP_DB_PATH}.tmp`;
    fs.writeFileSync(backupTmp, serialized, 'utf8');
    fs.renameSync(backupTmp, BACKUP_DB_PATH);
  }

  public get db(): DatabaseState {
    return this.state;
  }

  public save(): void {
    this.persist(this.state);
  }

  public addAdminAlert(
    title: string,
    detail: string,
    category: AdminAlert['category'],
  ): void {
    this.state.adminAlerts.unshift({
      id: makeId('alrt'),
      title,
      detail,
      category,
      read: false,
      createdAt: new Date().toISOString(),
    });
    if (this.state.adminAlerts.length > 100) {
      this.state.adminAlerts = this.state.adminAlerts.slice(0, 100);
    }
  }

  public recordAccountingEntry(entry: Omit<AccountingRecord, 'id'>): void {
    if (!Array.isArray(this.state.accountingRecords)) {
      this.state.accountingRecords = [];
    }
    this.state.accountingRecords.unshift({
      id: makeId('acc'),
      ...entry,
    });
  }

  public syncAccountingStatus(sourceId: string, status: string, detailOverride?: string): void {
    if (!Array.isArray(this.state.accountingRecords)) return;
    for (const rec of this.state.accountingRecords) {
      if (rec.sourceId === sourceId) {
        rec.status = status;
        if (detailOverride) {
          rec.detail = detailOverride;
        }
      }
    }
  }

  public logAudit(actorEmail: string, action: string, target: string, detail: string): void {
    this.state.auditLogs.unshift({
      id: makeId('aud'),
      actorEmail,
      action,
      target,
      detail,
      createdAt: new Date().toISOString(),
    });
    if (this.state.auditLogs.length > 150) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 150);
    }
  }
}

export const store = new StoreManager();
