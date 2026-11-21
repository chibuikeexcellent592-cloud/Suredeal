import type {
  AccountingRecord,
  AdminAlert,
  AdminPhoneAlertDispatch,
  AuditLogEntry,
  BoostingOrder,
  BoostingService,
  CustomSection,
  EmailLog,
  MarketplaceCategory,
  MarketplaceListing,
  NotificationItem,
  PlatformSettings,
  PromoCode,
  PublicUser,
  SmsCountry,
  SmsOrder,
  SmsPoolNumber,
  SmsService,
  SupportTicket,
  TutorialItem,
  VaultItem,
  VisitorStats,
  WalletTransaction,
} from '../src/types.ts';

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface PendingSignupVerification {
  email: string;
  name: string;
  passwordHash: string;
  referralCodeInput?: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

export interface DatabaseState {
  settings: PlatformSettings;
  users: StoredUser[];
  pendingSignups: PendingSignupVerification[];
  smsCountries: SmsCountry[];
  smsServices: SmsService[];
  smsPool: SmsPoolNumber[];
  smsOrders: SmsOrder[];
  boostingServices: BoostingService[];
  boostingOrders: BoostingOrder[];
  marketplaceCategories: MarketplaceCategory[];
  marketplaceListings: MarketplaceListing[];
  vaultItems: VaultItem[];
  customSections: CustomSection[];
  transactions: WalletTransaction[];
  accountingRecords: AccountingRecord[];
  visitorStats: VisitorStats;
  notifications: NotificationItem[];
  emailLogs: EmailLog[];
  tutorials: TutorialItem[];
  tickets: SupportTicket[];
  adminAlerts: AdminAlert[];
  adminPhoneAlerts: AdminPhoneAlertDispatch[];
  promoCodes: PromoCode[];
  auditLogs: AuditLogEntry[];
}
