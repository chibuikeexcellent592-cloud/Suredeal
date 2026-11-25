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

export type AdminFeatureTab =
  | 'overview'
  | 'power_suite'
  | 'revenue'
  | 'live'
  | 'users'
  | 'orders'
  | 'sms_numbers'
  | 'accounting'
  | 'catalog'
  | 'cms'
  | 'copy'
  | 'promos'
  | 'notifications'
  | 'tutorials'
  | 'support'
  | 'audit'
  | 'settings'
  | 'team';

export interface DashboardBannerItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
}

export interface PlatformSettings {
  siteName: string;
  siteTagline?: string;
  siteLogoUrl: string;
  siteNameColorMode?: 'solid' | 'split' | 'gradient';
  siteNameColor1?: string;
  siteNameColor2?: string;
  siteNameSplitRule?: 'words' | 'sure_prefix';
  siteNameThemeTarget?: 'first' | 'second' | 'both' | 'custom';
  siteNameAutoTheme?: boolean;
  seasonalTheme?:
    | 'none'
    | 'christmas'
    | 'new_year'
    | 'valentine'
    | 'ramadan_eid'
    | 'black_friday'
    | 'easter'
    | 'custom';
  seasonalBannerEnabled?: boolean;
  seasonalHeadline?: string;
  seasonalEffectsEnabled?: boolean;
  seasonalCustomEmoji?: string;
  seasonalCustomColor?: string;
  mainAdminEmail?: string;
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
  supportTelegram?: string;
  supportPrimaryChannel?: 'whatsapp' | 'telegram' | 'both';
  supportGroupPlatform?: 'whatsapp' | 'telegram';
  supportGroupName?: string;
  supportGroupUrl?: string;
  supportDeskNote?: string;
  supportAllowTickets?: boolean;
  supportDeskLayout?: 'grid_3' | 'grid_2' | 'stacked' | 'banner_first';
  supportCardStyle?: 'tinted' | 'solid_clean' | 'dark_pro' | 'outlined';
  supportHeroBannerEnabled?: boolean;
  supportHeroBadge?: string;
  supportHeroTitle?: string;
  supportResponseTimeLabel?: string;
  supportHoursLabel?: string;
  supportWhatsappLabel?: string;
  supportWhatsappButtonText?: string;
  supportTelegramLabel?: string;
  supportTelegramButtonText?: string;
  supportGroupButtonText?: string;
  showFloatingWhatsapp?: boolean;
  communityChannelEnabled?: boolean;
  communityChannelPlatform?: 'whatsapp' | 'telegram';
  communityChannelTitle?: string;
  communityChannelSubtitle?: string;
  communityChannelUrl?: string;
  communityChannelCta?: string;
  creatorName?: string;
  creatorUrl?: string;
  allowNewSignups?: boolean;
  requireEmailVerification?: boolean;
  googleAuthEnabled?: boolean;
  googleClientId?: string;
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
  maxDepositAmount?: number;
  depositBonusPercent?: number;
  smsOrderExpiryMinutes?: number;
  showPopularBadges?: boolean;
  leaderboardVisible?: boolean;
  supportCannedReplies?: string[];
  blockedEmailDomains?: string[];
  referralBonusAmount: number;
  welcomePromoEnabled: boolean;
  welcomePromoAmount: number;
  landingVideoUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  defaultBuyWarning: string;
  defaultBuyWarningLevel?: 'serious' | 'info';
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
  brandMigratedV2?: boolean;
  brandMigratedV3?: boolean;
  dashboardNoticeEnabled?: boolean;
  dashboardNoticeText?: string;
  dashboardNoticeTone?: 'amber' | 'info' | 'emerald' | 'rose';
  dashboardWalletBadge?: string;
  dashboardWalletTitle?: string;
  dashboardWalletSubtitle?: string;
  dashboardBalanceLabel?: string;
  dashboardFundButtonLabel?: string;
  dashboardHistoryButtonLabel?: string;
  dashboardBanners?: DashboardBannerItem[];

  // SMS Panel Tier Settings
  smsPrimeLabel?: string;
  smsAlternateLabel?: string;
  smsAlternateMode?: 'discount' | 'markup';
  smsAlternateDiscountPct?: number;

  // Revenue & Profit Estimation Settings
  profitCostPercentMarketplace?: number;
  profitCostPercentSms?: number;
  profitCostPercentBoosting?: number;

  // Dedicated Section Write-Ups (Wallet & Workspace Sections)
  walletPageTitle?: string;
  walletPageSubtitle?: string;
  walletNoticeText?: string;
  walletCardHeader?: string;
  walletFormTitle?: string;
  walletUploadHint?: string;
  walletSubmitButtonLabel?: string;
  walletActivityTitle?: string;
  walletEmptyActivityText?: string;

  marketplaceTitle?: string;
  marketplaceSubtitle?: string;
  marketplacePausedText?: string;

  smsTitle?: string;
  smsSubtitle?: string;
  smsSessionNote?: string;
  smsInboxTitle?: string;
  smsRentButtonLabel?: string;
  smsPausedText?: string;

  boostingTitle?: string;
  boostingSubtitle?: string;
  boostingHistoryTitle?: string;
  boostingEmptyText?: string;
  boostingPausedText?: string;

  ordersTitle?: string;
  ordersSubtitle?: string;

  transactionsTitle?: string;
  transactionsSubtitle?: string;

  referralTitle?: string;
  referralSubtitle?: string;
  referralCardBadge?: string;
  referralCardHeadline?: string;
  referralCardDesc?: string;

  tutorialsTitle?: string;
  tutorialsSubtitle?: string;
  supportTitle?: string;
  supportSubtitle?: string;
  notificationsTitle?: string;
  notificationsSubtitle?: string;
  settingsTitle?: string;
  settingsSubtitle?: string;
}

export interface MaintenanceStatusResponse {
  maintenanceMode: boolean;
  maintenanceHeadline: string;
  maintenanceMessage: string;
  siteName: string;
  siteLogoUrl: string;
  siteNameColorMode?: 'solid' | 'split' | 'gradient';
  siteNameColor1?: string;
  siteNameColor2?: string;
  siteNameSplitRule?: 'words' | 'sure_prefix';
  siteNameThemeTarget?: 'first' | 'second' | 'both' | 'custom';
  siteNameAutoTheme?: boolean;
  seasonalTheme?:
    | 'none'
    | 'christmas'
    | 'new_year'
    | 'valentine'
    | 'ramadan_eid'
    | 'black_friday'
    | 'easter'
    | 'custom';
  seasonalBannerEnabled?: boolean;
  seasonalHeadline?: string;
  seasonalEffectsEnabled?: boolean;
  seasonalCustomEmoji?: string;
  seasonalCustomColor?: string;
  supportWhatsapp: string;
  supportEmail: string;
  creatorName: string;
  checkedAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isMainAdmin?: boolean;
  allowedAdminTab?: AdminFeatureTab;
  authProvider?: 'email' | 'google';
  balance: number;
  status: UserStatus;
  referralCode: string;
  referredBy?: string;
  referralRewardClaimed?: boolean;
  emailVerified?: boolean;
  avatarUrl?: string;
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
  buyWarningLevel?: 'serious' | 'info';
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
  buyWarningLevel?: 'serious' | 'info';
  createdAt: string;
  adminCleared?: boolean;
  buyerEmail?: string;
  buyerName?: string;
}

export interface CustomSectionProduct {
  id: string;
  sectionId: string;
  title: string;
  shortSpec: string;
  description: string;
  buyWarning: string;
  buyWarningLevel?: 'serious' | 'info';
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
  badgeTag?: string;
  accentColor?: string;
  defaultBuyWarning?: string;
  defaultBuyWarningLevel?: 'serious' | 'info';
  aiNotes?: string;
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
  category: 'deposit' | 'order' | 'ticket' | 'user' | 'visitor' | 'system';
  read: boolean;
  createdAt: string;
}

export interface AdminPhoneAlertDispatch {
  id: string;
  eventType: 'new_user' | 'wallet_funding' | 'new_order' | 'system';
  targetPhone: string;
  message: string;
  whatsappUrl: string;
  deliveryStatus: 'queued' | 'webhook_dispatched';
  createdAt: string;
}

export interface AccountingRecord {
  id: string;
  kind: 'order' | 'transaction';
  sourceId: string;
  category: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  detail: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface VisitorSessionLog {
  visitorId: string;
  path: string;
  device: string;
  visitedAt: string;
}

export interface VisitorStats {
  totalVisits: number;
  lastVisitAt?: string;
  recentSessions: VisitorSessionLog[];
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
