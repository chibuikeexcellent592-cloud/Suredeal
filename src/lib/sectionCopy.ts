import type { PlatformSettings } from '../types';

export const SECTION_COPY_DEFAULTS = {
  dashboardNoticeEnabled: true,
  dashboardNoticeText:
    'This platform provides digital tools for legitimate use only. Users are responsible.',
  dashboardNoticeTone: 'amber' as 'amber' | 'info' | 'emerald' | 'rose',
  dashboardWalletBadge: '',
  dashboardWalletTitle: 'Dashboard Overview, {{NAME}} 👋',
  dashboardWalletSubtitle:
    'Rent virtual SMS numbers, launch social campaigns, and manage your digital Vault.',
  dashboardBalanceLabel: 'Account Balance',
  dashboardFundButtonLabel: 'Add Funds',
  dashboardHistoryButtonLabel: 'History',

  walletPageTitle: 'Wallet & {{BANK}} Funding',
  walletPageSubtitle:
    'Transfer Naira ({{SYMBOL}}) to our official {{BANK}} account and upload your receipt for instant AI & Team verification.',
  walletNoticeText: '',
  walletCardHeader: 'Official Funding Account',
  walletFormTitle: 'Submit Transfer Receipt',
  walletUploadHint: 'Click to select PNG / JPG transfer receipt',
  walletSubmitButtonLabel: 'Submit Deposit for Verification',
  walletActivityTitle: 'Recent Wallet Activity',
  walletEmptyActivityText: 'No transactions matching this filter.',

  marketplaceTitle: 'Marketplace',
  marketplaceSubtitle: 'Instant proxies, VPN licenses, and verified social accounts.',
  marketplacePausedText:
    'Marketplace & Vault purchases are temporarily paused by our team. Previously purchased Vault items remain accessible.',

  smsTitle: 'Virtual SMS Verification',
  smsSubtitle:
    'Rent dedicated 15-minute numbers for OTP verification with automatic instant refund if cancelled before delivery.',
  smsSessionNote:
    '15-minute active session · Automatic instant refund if cancelled before OTP arrival',
  smsInboxTitle: 'Active Numbers & OTP Inbox',
  smsRentButtonLabel: 'Rent Virtual Number',
  smsPausedText:
    'Virtual SMS verification orders are temporarily paused by our team. You can still view active numbers and refunds below.',

  boostingTitle: 'Social Media Boosting',
  boostingSubtitle:
    'Configure growth campaigns priced in Nigerian Naira ({{SYMBOL}}). Orders send directly to our Team fulfillment desk.',
  boostingHistoryTitle: 'Campaign History',
  boostingEmptyText: 'No boosting campaigns placed yet.',
  boostingPausedText:
    'Social Media Boosting orders are temporarily paused by our team. Existing orders continue updating below.',

  ordersTitle: 'My Orders & Delivery History',
  ordersSubtitle:
    'All marketplace credentials, virtual SMS rentals, and social boosting campaigns in one place.',

  transactionsTitle: 'Transaction History',
  transactionsSubtitle:
    'Complete audit log of deposits, marketplace purchases, SMS rentals, refunds, and referral credits.',

  referralTitle: 'Refer & Earn',
  referralSubtitle:
    'Invite friends to {{SITE}} and earn {{BONUS}} when they complete their first verified deposit.',
  referralCardBadge: 'Deposit-Gated Referral Bonus',
  referralCardHeadline: 'Earn {{BONUS}} per Verified Friend',
  referralCardDesc:
    'Your bonus is automatically credited to your wallet the moment your invited friend completes their first verified deposit.',

  tutorialsTitle: 'Tutorials & Guides',
  tutorialsSubtitle: 'Learn how to fund via {{BANK}}, rent OTP numbers, and activate Vault tools.',
  supportTitle: 'Support Desk',
  supportSubtitle:
    'Open a ticket for receipt audits, order assistance, or custom asset requests.',
  notificationsTitle: 'Notifications & Broadcasts',
  notificationsSubtitle: 'Direct messages, deposit approvals, and platform announcements.',
  settingsTitle: 'Account Settings',
  settingsSubtitle: 'Manage your profile details and account password.',
};

export interface CopyTokenVars {
  bank?: string;
  symbol?: string;
  site?: string;
  bonus?: string;
  name?: string;
}

export function applyCopyTokens(text: string, vars: CopyTokenVars = {}): string {
  return text
    .replace(/\{\{BANK\}\}/gi, vars.bank || 'MONIEPOINT')
    .replace(/\{\{SYMBOL\}\}/gi, vars.symbol || '₦')
    .replace(/\{\{SITE\}\}/gi, vars.site || 'SureDeal Store')
    .replace(/\{\{BONUS\}\}/gi, vars.bonus || '₦500')
    .replace(/\{\{NAME\}\}/gi, vars.name || 'User');
}

type StringCopyKey = Exclude<
  keyof typeof SECTION_COPY_DEFAULTS,
  'dashboardNoticeEnabled' | 'dashboardNoticeTone'
>;

export function getSectionCopy(
  settings: Partial<PlatformSettings> | undefined,
  key: StringCopyKey,
  vars: CopyTokenVars = {},
): string {
  const custom = settings?.[key];
  const raw =
    typeof custom === 'string' && custom.trim() ? custom.trim() : SECTION_COPY_DEFAULTS[key];
  return applyCopyTokens(raw, vars);
}
