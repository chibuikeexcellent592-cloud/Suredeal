export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface LandingShowcaseCard {
  id: string;
  category: string;
  deliveryType: string;
  title: string;
  shortSpec: string;
  priceLabel: string;
  imageUrl: string;
}

export interface LandingStatItem {
  value: string;
  label: string;
}

export interface LandingWorkflowStep {
  title: string;
  desc: string;
}

export interface PlatformSettings {
  siteName: string;
  siteLogoUrl: string;
  currencyCode: string;
  currencySymbol: string;
  announcementBanner: string;
  pinnedTickerEnabled: boolean;
  pinnedTickerText: string;
  pinnedTickerTheme: 'purple' | 'blue' | 'amber' | 'dark';
  brandColor?: string;
  accentColor?: string;
  surfaceBgLight?: string;
  surfaceBgDark?: string;
  colorPreset?: string;
  maintenanceMode: boolean;
  supportEmail: string;
  supportWhatsapp?: string;
  showFloatingWhatsapp?: boolean;
  creatorName?: string;
  creatorUrl?: string;
  allowNewSignups?: boolean;
  enableSmsService?: boolean;
  enableBoostingService?: boolean;
  enableMarketplace?: boolean;
  allowPromoCodes?: boolean;
  showLandingShowcase?: boolean;
  showLandingRates?: boolean;
  adminNotifyPhone: string;
  adminWebhookUrl: string;
  autoApproveDeposits: boolean;
  minimumDeposit: number;
  referralBonusAmount: number;
  welcomePromoEnabled: boolean;
  welcomePromoAmount: number;
  landingVideoUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  defaultBuyWarning: string;
  heroKicker: string;
  heroHeadline: string;
  heroSecondaryHeadline?: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta?: string;
  snapshotKicker?: string;
  snapshotTitle?: string;
  snapshotBadge?: string;
  snapshotFooterText?: string;
  servicesKicker?: string;
  servicesTitle?: string;
  landingStats?: LandingStatItem[];
  landingShowcaseCards?: LandingShowcaseCard[];
  workflowKicker?: string;
  workflowTitle?: string;
  workflowSubtitle?: string;
  workflowSteps?: LandingWorkflowStep[];
  ctaKicker?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  maintenanceHeadline?: string;
  maintenanceMessage?: string;
  footerTagline: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  resendApiKey?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  balance: number;
  status: UserStatus;
  referralCode: string;
  referredBy?: string;
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SmsCountry {
  id: string;
  name: string;
  code: string;
  dialCode: string;
  multiplier: number;
  active: boolean;
}

export interface SmsService {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  successRate: number;
  stock: number;
  active: boolean;
  sampleTemplate: string;
}

export interface SmsPoolNumber {
  id: string;
  phoneNumber: string;
  countryId: string;
  serviceId: string;
  presetOtp: string;
  used: boolean;
  assignedOrderId?: string;
  createdAt: string;
}

export interface SmsOrder {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  countryId: string;
  countryName: string;
  phoneNumber: string;
  price: number;
  status: 'waiting' | 'received' | 'cancelled' | 'expired';
  otpCode?: string;
  smsText?: string;
  createdAt: string;
  expiresAt: string;
  adminCleared?: boolean;
}

export interface BoostingService {
  id: string;
  platform: string;
  category: string;
  name: string;
  ratePer1k: number;
  minQty: number;
  maxQty: number;
  speedLabel: string;
  refillPolicy: string;
  active: boolean;
}

export interface BoostingOrder {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  platform: string;
  targetUrl: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refilling';
  startCount: number;
  remains: number;
  createdAt: string;
  updatedAt: string;
  adminCleared?: boolean;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  category: string;
  popularTag: string;
  shortSpec: string;
  description: string;
  buyWarning: string;
  features: string[];
  price: number;
  stock: number;
  deliveryType: string;
  imageUrl: string;
  logoUrl: string;
  bounceLogo: boolean;
  credentialTemplate: string;
  stockKeys: string[];
  soldCount: number;
  active: boolean;
}

export interface VaultItem {
  id: string;
  userId: string;
  sourceType: 'marketplace' | 'section';
  sourceId: string;
  title: string;
  category: string;
  price: number;
  deliveredCredential: string;
  deliveryType: string;
  buyWarningShown?: string;
  createdAt: string;
  adminCleared?: boolean;
}

export interface CustomSectionProduct {
  id: string;
  sectionId: string;
  title: string;
  shortSpec: string;
  description: string;
  buyWarning: string;
  price: number;
  stock: number;
  imageUrl: string;
  logoUrl: string;
  bounceLogo: boolean;
  credentialTemplate: string;
  active: boolean;
}

export interface CustomSection {
  id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  products: CustomSectionProduct[];
}

export interface ReceiptAuditChecks {
  amountMatch: boolean;
  bankMatch: boolean;
  accountNumberMatch: boolean;
  accountNameMatch: boolean;
  statusSuccess: boolean;
  dateTimeRecent: boolean;
  noTampering: boolean;
  uniqueReference: boolean;
}

export interface ReceiptAiAudit {
  verdict: 'match' | 'uncertain' | 'mismatch' | 'unavailable';
  confidence: number;
  extractedAmount?: number;
  extractedBank?: string;
  extractedAccount?: string;
  extractedAccountName?: string;
  extractedSenderName?: string;
  extractedSenderBank?: string;
  extractedDateTime?: string;
  extractedDateTimeIso?: string;
  extractedReference?: string;
  extractedStatus?: string;
  ageMinutes?: number;
  checks?: ReceiptAuditChecks;
  inspectedAt?: string;
  summary: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type:
    | 'deposit'
    | 'purchase'
    | 'refund'
    | 'admin_credit'
    | 'admin_debit'
    | 'referral_bonus'
    | 'welcome_bonus';
  amount: number;
  status: 'pending' | 'verified' | 'rejected' | 'completed';
  description: string;
  receiptImage?: string;
  receiptHash?: string;
  senderNote?: string;
  aiAudit?: ReceiptAiAudit;
  adminNote?: string;
  createdAt: string;
  adminCleared?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  targetUserId: string;
  readBy: string[];
  createdAt: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentBy: string;
  createdAt: string;
}

export interface TutorialItem {
  id: string;
  title: string;
  category: string;
  duration: string;
  summary: string;
  content: string;
  videoUrl: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  senderRole: 'user' | 'admin';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAlert {
  id: string;
  title: string;
  detail: string;
  category: 'deposit' | 'order' | 'ticket' | 'user' | 'system';
  read: boolean;
  createdAt: string;
}

export interface AdminPhoneAlertDispatch {
  id: string;
  eventType: 'new_user' | 'wallet_funding' | 'new_order';
  targetPhone: string;
  message: string;
  whatsappUrl: string;
  deliveryStatus: 'queued' | 'webhook_dispatched';
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  value: number;
  uses: number;
  maxUses: number;
  active: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
}

export interface PublicCatalogResponse {
  settings: PlatformSettings;
  smsCountriesCount: number;
  smsServices: SmsService[];
  boostingServices: BoostingService[];
  marketplaceListings: MarketplaceListing[];
  marketplaceCategories: MarketplaceCategory[];
  customSections: CustomSection[];
}
