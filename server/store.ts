import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
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
  notifications: NotificationItem[];
  emailLogs: EmailLog[];
  tutorials: TutorialItem[];
  tickets: SupportTicket[];
  adminAlerts: AdminAlert[];
  adminPhoneAlerts: AdminPhoneAlertDispatch[];
  promoCodes: PromoCode[];
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
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

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createInitialState(): DatabaseState {
  const now = new Date().toISOString();

  const adminUser: StoredUser = {
    id: 'usr_head_admin',
    name: 'Chibuike Excellent',
    email: 'chibuikeexcellent592@gmail.com',
    passwordHash: hashPassword('goodluck901.'),
    role: 'admin',
    balance: 250000,
    status: 'active',
    referralCode: 'SUREADMIN',
    createdAt: now,
  };

  return {
    settings: {
      siteName: 'SureDeal Store',
      siteLogoUrl: '',
      currencyCode: 'NGN',
      currencySymbol: '₦',
      announcementBanner: '',
      pinnedTickerEnabled: true,
      pinnedTickerText:
        'Welcome to SureDeal Store — Instant Moniepoint Funding (7031537390), Verified Proxies, Social Boosting & Virtual SMS Numbers Active 24/7.',
      pinnedTickerTheme: 'blue',
      brandColor: '#2563EB',
      accentColor: '#0EA5E9',
      surfaceBgLight: '#F8FAFC',
      surfaceBgDark: '#0B0F17',
      colorPreset: 'royal-blue',
      maintenanceMode: false,
      supportEmail: 'chibuikeexcellent592@gmail.com',
      supportWhatsapp: '+2347031537390',
      showFloatingWhatsapp: true,
      creatorName: 'Excellent',
      creatorUrl: '',
      allowNewSignups: true,
      enableSmsService: true,
      enableBoostingService: true,
      enableMarketplace: true,
      allowPromoCodes: true,
      showLandingShowcase: true,
      showLandingRates: true,
      adminNotifyPhone: '+2347031537390',
      adminWebhookUrl: '',
      autoApproveDeposits: false,
      minimumDeposit: 500,
      referralBonusAmount: 500,
      welcomePromoEnabled: false,
      welcomePromoAmount: 500,
      landingVideoUrl: '',
      bankName: 'MONIEPOINT',
      bankAccountNumber: '7031537390',
      bankAccountName: 'UCHECHI BLESSING OJI',
      defaultBuyWarning:
        'Important Notice: Verify your target details before confirming. Digital keys, proxies, and accounts delivered to your Vault cannot be refunded once revealed.',
      heroKicker: "Africa's all-in-one marketplace for digital growth",
      heroHeadline: 'All-in-One Digital Tools & Growth Services in Africa',
      heroSecondaryHeadline:
        'SMS Verification, Social Boosting, VPN, Proxy & Verified Accounts — Fast, Secure & Affordable.',
      heroSubheadline:
        'Verify WhatsApp, Telegram, and global accounts with instant one-time codes, launch high-retention social boosting campaigns, and acquire CLiproxy, 9Proxy, PIAVPN, and verified accounts from one clean dashboard.',
      heroPrimaryCta: 'Get Started',
      heroSecondaryCta: 'Explore Services',
      snapshotKicker: 'Live Catalog Snapshot',
      snapshotTitle: 'Instant Delivery Hub',
      snapshotBadge: 'Active Now',
      snapshotFooterText: 'Instant Vault Delivery & 24/7 Automated Dispatch',
      servicesKicker: 'What You Can Do Here',
      servicesTitle: 'Built for creators, agencies, and digital marketers',
      landingStats: [
        { value: '99.4%', label: 'Campaign completion & auto-refill reliability' },
        { value: '10+ Countries', label: 'Clean SMS OTP carrier coverage worldwide' },
        { value: 'Unified Wallet', label: 'Fast Naira deposits inside your dashboard' },
        { value: 'Instant Vault', label: 'Zero-wait Login, Password & 2FA delivery' },
      ],
      landingShowcaseCards: [
        {
          id: 'sc_boost',
          category: 'Social Boosting',
          deliveryType: 'Creator Growth',
          title: 'Instagram & TikTok Viral Velocity',
          shortSpec: 'High-retention followers, reels views, and instant engagement campaigns.',
          priceLabel: '',
          imageUrl: '/src/assets/images/social_creator_filming_1794991853059.jpg',
        },
        {
          id: 'sc_sms',
          category: 'Virtual SMS OTP',
          deliveryType: '10+ Countries',
          title: 'Instant Account Verification Numbers',
          shortSpec: 'Dedicated WhatsApp, Telegram, TikTok, Instagram, and OpenAI OTP routing.',
          priceLabel: '',
          imageUrl: '/src/assets/images/social_mobile_lifestyle_1794991853436.jpg',
        },
        {
          id: 'sc_analytics',
          category: 'Creator & Proxies',
          deliveryType: 'Instant Vault',
          title: 'CLiproxy, 9Proxy & Creator Suites',
          shortSpec: 'Clean residential IPs, VPN licenses, and aged creator accounts for scaling.',
          priceLabel: '',
          imageUrl: '/src/assets/images/social_workspace_creators_1794991853444.jpg',
        },
      ],
      workflowKicker: 'Simple 4-Step Workflow',
      workflowTitle: 'Fund once, deploy across every tool',
      workflowSubtitle:
        'Every service shares one Naira wallet with instant Vault credential delivery and protected SMS escrow refunds.',
      workflowSteps: [
        {
          title: '01. Create Your Account & Fund Your Wallet',
          desc: 'Register for free, open Wallet & Fund inside your user dashboard to view live funding instructions, and credit your Naira balance seamlessly.',
        },
        {
          title: '02. Virtual SMS Verification Numbers',
          desc: 'Pick your country first, search WhatsApp, Telegram, Google, OpenAI, or TikTok, and enjoy automatic instant wallet refund if cancelled before OTP arrival.',
        },
        {
          title: '03. Direct Social Media Boosting',
          desc: 'Submit your target link and quantity once — boosting orders dispatch directly to our fulfillment desk for timely delivery.',
        },
        {
          title: '04. Proxies, VPNs & Referral Rewards',
          desc: 'Unlock CLiproxy, 9Proxy, PIAVPN, and verified accounts with Login, Password & 2FA in your Vault, plus earn referral rewards on invites.',
        },
      ],
      ctaKicker: 'Instant Account Access & Live Support',
      ctaTitle: 'Ready to start scaling faster?',
      ctaSubtitle:
        'Create your free account, open Wallet & Fund inside your dashboard to top up your Naira balance, and access every growth service right away.',
      maintenanceHeadline: 'Scheduled system refinement in progress.',
      maintenanceMessage:
        'We are updating our systems to deliver faster service. All Naira balances, receipts, and Vault credentials remain completely safe.',
      footerTagline:
        'Premium digital tools marketplace — virtual SMS verification numbers, social media boosting, proxies, VPNs, and verified accounts with instant delivery and secure wallet payments.',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
      resendApiKey: '',
    },
    users: [adminUser],
    pendingSignups: [],
    smsCountries: [
      { id: 'cnt_us', name: 'United States', code: 'US', dialCode: '+1', multiplier: 1.0, active: true },
      { id: 'cnt_uk', name: 'United Kingdom', code: 'GB', dialCode: '+44', multiplier: 1.15, active: true },
      { id: 'cnt_ng', name: 'Nigeria', code: 'NG', dialCode: '+234', multiplier: 0.75, active: true },
      { id: 'cnt_ca', name: 'Canada', code: 'CA', dialCode: '+1', multiplier: 1.05, active: true },
      { id: 'cnt_de', name: 'Germany', code: 'DE', dialCode: '+49', multiplier: 1.25, active: true },
      { id: 'cnt_fr', name: 'France', code: 'FR', dialCode: '+33', multiplier: 1.2, active: true },
      { id: 'cnt_nl', name: 'Netherlands', code: 'NL', dialCode: '+31', multiplier: 1.18, active: true },
      { id: 'cnt_in', name: 'India', code: 'IN', dialCode: '+91', multiplier: 0.65, active: true },
      { id: 'cnt_br', name: 'Brazil', code: 'BR', dialCode: '+55', multiplier: 0.85, active: true },
      { id: 'cnt_za', name: 'South Africa', code: 'ZA', dialCode: '+27', multiplier: 0.9, active: true },
    ],
    smsServices: [
      {
        id: 'svc_wa',
        name: 'WhatsApp',
        category: 'Messaging',
        basePrice: 1800,
        successRate: 98.4,
        stock: 1840,
        active: true,
        sampleTemplate: 'Your WhatsApp Business code: {{CODE}}. Never share this code with anyone.',
      },
      {
        id: 'svc_tg',
        name: 'Telegram',
        category: 'Messaging',
        basePrice: 1400,
        successRate: 99.1,
        stock: 2410,
        active: true,
        sampleTemplate: 'Telegram login code: {{CODE}}. Do not give this code to anyone.',
      },
      {
        id: 'svc_go',
        name: 'Google / Gmail',
        category: 'Identity',
        basePrice: 1200,
        successRate: 97.2,
        stock: 3120,
        active: true,
        sampleTemplate: 'G-{{CODE}} is your Google verification code. Valid for 10 minutes.',
      },
      {
        id: 'svc_ig',
        name: 'Instagram',
        category: 'Social',
        basePrice: 1050,
        successRate: 98.8,
        stock: 2950,
        active: true,
        sampleTemplate: "{{CODE}} is your Instagram code. Don't share it.",
      },
      {
        id: 'svc_tt',
        name: 'TikTok',
        category: 'Social',
        basePrice: 950,
        successRate: 98.1,
        stock: 2210,
        active: true,
        sampleTemplate: '[TikTok] {{CODE}} is your verification code, valid for 5 minutes.',
      },
      {
        id: 'svc_oa',
        name: 'OpenAI / ChatGPT',
        category: 'Developer & AI',
        basePrice: 1650,
        successRate: 99.3,
        stock: 1620,
        active: true,
        sampleTemplate: 'Your OpenAI verification code is: {{CODE}}',
      },
      {
        id: 'svc_dc',
        name: 'Discord',
        category: 'Community',
        basePrice: 900,
        successRate: 99.0,
        stock: 1980,
        active: true,
        sampleTemplate: 'Your Discord security verification code is {{CODE}}.',
      },
      {
        id: 'svc_x',
        name: 'X (Twitter)',
        category: 'Social',
        basePrice: 1150,
        successRate: 96.9,
        stock: 1440,
        active: true,
        sampleTemplate: 'Your X confirmation code is {{CODE}}.',
      },
    ],
    smsPool: [],
    smsOrders: [],
    boostingServices: [
      {
        id: 'bst_ig_fol',
        platform: 'Instagram',
        category: 'Followers',
        name: 'Instagram Global Real-Look Followers (High Retention)',
        ratePer1k: 4500,
        minQty: 100,
        maxQty: 100000,
        speedLabel: '15K / day',
        refillPolicy: '30-Day Refill',
        active: true,
      },
      {
        id: 'bst_ig_lik',
        platform: 'Instagram',
        category: 'Likes',
        name: 'Instagram Instant Engagement Likes',
        ratePer1k: 1350,
        minQty: 50,
        maxQty: 50000,
        speedLabel: 'Instant · 25K/hr',
        refillPolicy: '30-Day Refill',
        active: true,
      },
      {
        id: 'bst_ig_vue',
        platform: 'Instagram',
        category: 'Views',
        name: 'Instagram Reels High-Reach Views',
        ratePer1k: 800,
        minQty: 500,
        maxQty: 500000,
        speedLabel: '50K / day',
        refillPolicy: 'No Refill',
        active: true,
      },
      {
        id: 'bst_tt_fol',
        platform: 'TikTok',
        category: 'Followers',
        name: 'TikTok Creator Followers (Organic Velocity)',
        ratePer1k: 6500,
        minQty: 100,
        maxQty: 50000,
        speedLabel: '8K / day',
        refillPolicy: '30-Day Refill',
        active: true,
      },
      {
        id: 'bst_tt_lik',
        platform: 'TikTok',
        category: 'Likes',
        name: 'TikTok Post Likes (Fast Start)',
        ratePer1k: 1600,
        minQty: 100,
        maxQty: 100000,
        speedLabel: '20K / day',
        refillPolicy: '30-Day Refill',
        active: true,
      },
      {
        id: 'bst_tt_vue',
        platform: 'TikTok',
        category: 'Views',
        name: 'TikTok FYP Discovery Views',
        ratePer1k: 550,
        minQty: 1000,
        maxQty: 1000000,
        speedLabel: 'Instant · 100K/day',
        refillPolicy: 'Lifetime Guarantee',
        active: true,
      },
    ],
    boostingOrders: [],
    marketplaceCategories: [
      { id: 'cat_proxies', name: 'Proxies', description: 'Clean residential & ISP proxy packs' },
      { id: 'cat_vpns', name: 'VPNs', description: 'Dedicated encrypted VPN licenses' },
      { id: 'cat_accounts', name: 'Creator Accounts', description: 'Aged and verified social profiles' },
      { id: 'cat_bots', name: 'Automation Bots', description: 'Growth & workflow automation tools' },
    ],
    marketplaceListings: [
      {
        id: 'mkt_cliproxy_30',
        title: '30IPS CLIPROXY',
        category: 'Proxies',
        popularTag: 'Proxy',
        shortSpec: '30 Clean Residential IPs · High Speed SOCKS5/HTTP',
        description:
          '30 dedicated clean residential proxy IPs from CLiproxy with full country targeting and instant vault key delivery.',
        buyWarning:
          'Important: Redeem your CLiproxy key on dashboard.cliproxy.io immediately. Keys are single-use and non-refundable once revealed in your Vault.',
        features: [
          '30 Residential IP endpoints',
          'SOCKS5 & HTTP protocol support',
          'Instant API & Vault activation key',
          '99.9% route uptime',
        ],
        price: 14500,
        stock: 35,
        deliveryType: 'Automated Key',
        imageUrl: '/src/assets/images/marketplace_proxies_security_1794869407993.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate:
          'CLiproxy Key (30 IPs): CLI-30IP-{{KEY4}}-{{KEY4}}-{{RAND4}} | Portal: dashboard.cliproxy.io',
        stockKeys: [],
        soldCount: 18,
        active: true,
      },
      {
        id: 'mkt_9proxy_5',
        title: '5IPS 9PROXY',
        category: 'Proxies',
        popularTag: 'Proxy',
        shortSpec: '5 Clean Residential IPs · Lifetime Non-Expiring Credits',
        description:
          '5 residential proxy IPs via 9Proxy desktop & mobile client. Ideal for social account management and ad verification.',
        buyWarning:
          'Warning: Do not share your 9Proxy redeem code. Once opened in your Orders/Vault, replacement is only covered for invalid codes.',
        features: [
          '5 Dedicated Residential IPs',
          'No bandwidth cap per IP',
          'Windows, macOS & Linux app compatible',
          'Instant Vault key',
        ],
        price: 2800,
        stock: 60,
        deliveryType: 'Automated Key',
        imageUrl: '/src/assets/images/marketplace_proxies_security_1794869407993.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate: '9Proxy Redeem Code (5 IPs): 9PRX-5IP-{{KEY4}}-{{KEY4}}-{{RAND4}}',
        stockKeys: [],
        soldCount: 42,
        active: true,
      },
      {
        id: 'mkt_9proxy_10',
        title: '10IPS 9PROXY',
        category: 'Proxies',
        popularTag: 'Proxy',
        shortSpec: '10 Clean Residential IPs · Multi-Region Targeting',
        description:
          '10 clean residential IPs on 9Proxy network with city and ISP level selection.',
        buyWarning:
          'Notice: Redeem directly inside the official 9Proxy desktop/mobile client. Verify proxy compatibility before checkout.',
        features: [
          '10 Residential IPs',
          'ZIP & ISP targeting',
          'Zero expiry until used',
          'Instant Vault delivery',
        ],
        price: 5400,
        stock: 44,
        deliveryType: 'Automated Key',
        imageUrl: '/src/assets/images/marketplace_proxies_security_1794869407993.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate: '9Proxy Redeem Code (10 IPs): 9PRX-10IP-{{KEY4}}-{{KEY4}}-{{RAND4}}',
        stockKeys: [],
        soldCount: 31,
        active: true,
      },
      {
        id: 'mkt_9proxy_25',
        title: '25IPS 9PROXY',
        category: 'Proxies',
        popularTag: 'Proxy',
        shortSpec: '25 Clean Residential IPs · Agency Bundle',
        description:
          '25 high-trust residential proxy IPs engineered for agencies running multiple social accounts safely.',
        buyWarning:
          'Agency Notice: Keep your 25IP key confidential. All sales are final upon instant credential generation.',
        features: [
          '25 Clean Residential IPs',
          'Dedicated SOCKS5 forwarding',
          'Instant Vault activation code',
          'Priority replacement warranty',
        ],
        price: 12200,
        stock: 28,
        deliveryType: 'Automated Key',
        imageUrl: '/src/assets/images/marketplace_proxies_security_1794869407993.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate: '9Proxy Redeem Code (25 IPs): 9PRX-25IP-{{KEY4}}-{{KEY4}}-{{RAND4}}',
        stockKeys: [],
        soldCount: 14,
        active: true,
      },
      {
        id: 'mkt_piavpn_pro',
        title: 'PIAVPN Dedicated 1-Year License',
        category: 'VPNs',
        popularTag: 'VPN',
        shortSpec: 'Unlimited Bandwidth · 84 Countries · 10 Devices',
        description:
          'Private Internet Access (PIAVPN) verified annual credentials with WireGuard encryption and strict no-logs policy.',
        buyWarning:
          'Important: Do not change the master billing email on shared VPN licenses. Log in on up to 2 personal devices.',
        features: [
          '365-day active subscription',
          '10 simultaneous device logins',
          'Dedicated kill switch & MACE ad-blocker',
          'Instant Vault credential delivery',
        ],
        price: 3500,
        stock: 40,
        deliveryType: 'Automated Key',
        imageUrl: '/src/assets/images/marketplace_digital_vault_1794869408342.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate:
          'PIAVPN Account | User: pia-{{RAND4}}@suredeal.vault | Pass: SD#{{KEY4}}{{RAND4}}! | Valid: 12 Months',
        stockKeys: [],
        soldCount: 23,
        active: true,
      },
      {
        id: 'mkt_creator_aged',
        title: 'Verified Aged Creator Social Bundle',
        category: 'Creator Accounts',
        popularTag: 'Facebook',
        shortSpec: '2021 Aged Profile · 2FA Backup Codes · Email Access Included',
        description:
          'Clean aged creator social profile paired with original recovery email credentials and 2FA backup keys.',
        buyWarning:
          'Security Warning: Always log in using a clean residential proxy matching the account region and update the recovery password within 30 minutes.',
        features: [
          'Original creation email included',
          'Clean trust score & zero shadowbans',
          '2FA recovery secret included',
          'Instant Vault delivery',
        ],
        price: 16000,
        stock: 15,
        deliveryType: 'Vault Credentials',
        imageUrl: '/src/assets/images/card_social_growth_studio_1794880847533.jpg',
        logoUrl: '',
        bounceLogo: false,
        credentialTemplate:
          'Account: @creator_{{RAND4}} | Pass: SdVault!{{KEY4}} | Email: recovery_{{RAND4}}@suredeal.mail | 2FA: {{KEY4}}-{{KEY4}}',
        stockKeys: [],
        soldCount: 9,
        active: true,
      },
    ],
    vaultItems: [],
    customSections: [],
    transactions: [],
    notifications: [
      {
        id: 'ntf_welcome',
        title: 'Welcome to SureDeal Store',
        message:
          'Fund your wallet via Moniepoint (7031537390 · UCHECHI BLESSING OJI) and upload your receipt for rapid verification.',
        type: 'info',
        targetUserId: 'all',
        readBy: [],
        createdAt: now,
      },
    ],
    emailLogs: [],
    tutorials: [
      {
        id: 'tut_moniepoint',
        title: 'How to Fund Your Wallet via Moniepoint Bank Transfer',
        category: 'Wallet & Funding',
        duration: '2 min read',
        summary:
          'Step-by-step guide to transferring Naira (₦) to Moniepoint 7031537390 and uploading your receipt for automated AI inspection.',
        content:
          '1. Open Wallet & Fund in your left navigation.\n2. Copy the official Moniepoint account number: 7031537390 (Account Name: UCHECHI BLESSING OJI).\n3. Complete your Naira transfer from any Nigerian bank app.\n4. Take a clear screenshot of the successful receipt showing the amount, date, and beneficiary.\n5. Upload the screenshot in SureDeal Store and click Submit Deposit.',
        videoUrl: '',
        createdAt: now,
      },
      {
        id: 'tut_sms_otp',
        title: 'Renting Virtual SMS Numbers & Instant Refund Protection',
        category: 'SMS Verification',
        duration: '3 min read',
        summary:
          'How to choose the right country carrier, receive OTP codes within seconds, and use auto-refund if you cancel before arrival.',
        content:
          '1. Navigate to SMS Numbers in your workspace.\n2. Pick the target app (WhatsApp, Telegram, Google, OpenAI, etc.) and select your preferred country carrier.\n3. Click Rent Virtual Number to activate a 15-minute dedicated session.\n4. Enter the assigned number into your app and watch the live SMS inbox for your OTP code.\n5. If no OTP arrives, click Cancel & Refund to return 100% of the Naira fee back to your wallet.',
        videoUrl: '',
        createdAt: now,
      },
    ],
    tickets: [],
    adminAlerts: [],
    adminPhoneAlerts: [],
    promoCodes: [
      {
        id: 'prm_sure10',
        code: 'SURE10',
        discountType: 'percent',
        value: 10,
        uses: 0,
        maxUses: 100,
        active: true,
        createdAt: now,
      },
    ],
    auditLogs: [],
  };
}

class StoreManager {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadFromDisk();
    this.ensureHeadAdmin();
  }

  private mergeParsedState(parsed: Partial<DatabaseState>): DatabaseState {
    const defaults = createInitialState();
    const mergedSettings = { ...defaults.settings };
    if (parsed.settings) {
      for (const [key, value] of Object.entries(parsed.settings)) {
        if (value !== undefined) {
          (mergedSettings as Record<string, unknown>)[key] = value;
        }
      }
    }
    return {
      ...defaults,
      ...parsed,
      settings: mergedSettings,
      marketplaceListings: (parsed.marketplaceListings ?? defaults.marketplaceListings).map((l) => ({
        ...l,
        buyWarning: l.buyWarning ?? defaults.settings.defaultBuyWarning,
      })),
    };
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
    const adminEmail = 'chibuikeexcellent592@gmail.com';
    const existing = this.state.users.find(
      (u) => u.email.toLowerCase() === adminEmail.toLowerCase(),
    );
    if (!existing) {
      this.state.users.unshift({
        id: 'usr_head_admin',
        name: 'Chibuike Excellent',
        email: adminEmail,
        passwordHash: hashPassword('goodluck901.'),
        role: 'admin',
        balance: 250000,
        status: 'active',
        referralCode: 'SUREADMIN',
        createdAt: new Date().toISOString(),
      });
      this.save();
    } else if (existing.role !== 'admin' || existing.status !== 'active') {
      existing.role = 'admin';
      existing.status = 'active';
      this.save();
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
