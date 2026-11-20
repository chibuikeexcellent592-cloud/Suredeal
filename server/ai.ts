import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { ReceiptAiAudit, ReceiptAuditChecks } from '../src/types.ts';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ExistingDepositSnapshot {
  id: string;
  receiptHash?: string;
  reference?: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface ReceiptVerificationResult {
  aiAudit: ReceiptAiAudit;
  receiptHash?: string;
  allChecksPassed: boolean;
}

function normalizeText(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameTokensMatch(extracted: string | undefined, expected: string): boolean {
  const expTokens = normalizeText(expected)
    .split(' ')
    .filter((t) => t.length >= 2);
  const extTokens = normalizeText(extracted)
    .split(' ')
    .filter((t) => t.length >= 2);
  if (expTokens.length === 0 || extTokens.length === 0) return false;
  const matched = expTokens.filter((token) => extTokens.includes(token));
  return matched.length >= Math.min(2, expTokens.length);
}

export async function verifyMoniepointReceiptWithAi(params: {
  receiptDataUrl: string;
  claimedAmount: number;
  expectedBank: string;
  expectedAccountNumber: string;
  expectedAccountName: string;
  existingDeposits?: ExistingDepositSnapshot[];
}): Promise<ReceiptVerificationResult> {
  const match = params.receiptDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return {
      aiAudit: {
        verdict: 'uncertain',
        confidence: 0,
        inspectedAt: new Date().toISOString(),
        summary:
          'Receipt file format could not be parsed for image inspection; awaiting manual Admin review.',
      },
      allChecksPassed: false,
    };
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const receiptHash = crypto.createHash('sha256').update(base64Data).digest('hex');
  const existing = params.existingDeposits || [];

  // 1. Immediate cryptographic duplicate image check (prevents submitting the same screenshot twice)
  const duplicateImage = existing.find(
    (d) => d.receiptHash === receiptHash && d.status !== 'rejected',
  );
  if (duplicateImage) {
    return {
      receiptHash,
      allChecksPassed: false,
      aiAudit: {
        verdict: 'mismatch',
        confidence: 99,
        inspectedAt: new Date().toISOString(),
        checks: {
          amountMatch: false,
          bankMatch: false,
          accountNumberMatch: false,
          accountNameMatch: false,
          statusSuccess: false,
          dateTimeRecent: false,
          noTampering: false,
          uniqueReference: false,
        },
        summary: `Duplicate receipt image blocked: identical screenshot was already submitted on deposit #${duplicateImage.id} (${duplicateImage.status}).`,
      },
    };
  }

  const ai = getAiClient();
  if (!ai) {
    return {
      receiptHash,
      allChecksPassed: false,
      aiAudit: {
        verdict: 'unavailable',
        confidence: 0,
        inspectedAt: new Date().toISOString(),
        summary:
          'Automated AI receipt scanner is offline; routed directly to Admin verification desk.',
      },
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowLagosFormatted = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(now);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `You are a strict forensic Nigerian bank transfer auditor for SureDeal Store.
Inspect EVERY detail visible on this receipt image and compare it rigorously against expected values and current Nigeria time.

CURRENT SERVER REFERENCE TIME:
- Current Nigeria Time (WAT / Africa/Lagos, UTC+1): ${nowLagosFormatted}
- Current UTC ISO Timestamp: ${nowIso}

EXPECTED DEPOSIT DETAILS TO VERIFY:
- Claimed Deposit Amount (NGN): ${params.claimedAmount}
- Expected Destination Bank: ${params.expectedBank}
- Expected Destination Account Number: ${params.expectedAccountNumber}
- Expected Destination Account Name: ${params.expectedAccountName}

FORENSIC CHECKLIST (ALL MUST BE INSPECTED):
1. AUTHENTICITY & TAMPERING (noTampering): Is this an authentic, unedited Nigerian bank transfer receipt (e.g. Moniepoint, OPay, PalmPay, Kuda, GTBank, Access, Zenith, UBA, FirstBank, Fidelity, Stanbic, Wema)? Check for photoshopped/overlaid text, mismatched font sizes/colors, blurred patches around numbers, cropped header/footer hiding date or status, or non-receipt images.
2. TRANSFER STATUS (statusSuccess): Does the receipt explicitly show "Successful", "Completed", "Transfer Successful", or equivalent? Pending, Processing, Failed, Reversed, or Scheduled MUST be statusSuccess=false.
3. EXACT AMOUNT (extractedAmount & amountMatch): Extract the exact transfer amount sent (principal amount, NOT fees unless combined, clarify in summary). It must equal ${params.claimedAmount}.
4. DESTINATION BANK (extractedBank & bankMatch): Compare the beneficiary/recipient bank printed on the receipt against "${params.expectedBank}".
5. DESTINATION ACCOUNT NUMBER (extractedAccount & accountNumberMatch): Extract the beneficiary/recipient account number digits shown. Compare against "${params.expectedAccountNumber}". If completely different -> false. If partially masked or unreadable -> false unless the visible digits unambiguously match and note it.
6. DESTINATION ACCOUNT NAME (extractedAccountName & accountNameMatch): Extract the beneficiary/recipient account name and verify it matches "${params.expectedAccountName}".
7. DATE & TIME COMPARISON (extractedDateTime, extractedDateTimeIso, dateTimeRecent):
   - Extract the exact transaction date and time printed on the receipt (and convert to ISO-8601 assuming Nigeria WAT +01:00 if no timezone offset is printed, e.g. "2026-11-17T10:35:00+01:00").
   - Compare it against Current Nigeria Time (${nowLagosFormatted}).
   - If date/time is missing or illegible -> dateTimeRecent=false.
   - If date/time is in the FUTURE (>15 minutes ahead of Current Nigeria Time) -> dateTimeRecent=false and verdict="mismatch".
   - If receipt is OLDER than 12 hours compared to Current Nigeria Time -> dateTimeRecent=false. If older than 48 hours -> verdict="mismatch".
8. SENDER & REFERENCE (extractedSenderName, extractedSenderBank, extractedReference): Extract sender name, sender bank, and Transaction Reference / Session ID / NIP Reference if shown.

Respond strictly in JSON matching the schema.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              description: 'Must be one of: match, uncertain, mismatch',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score between 0 and 100',
            },
            extractedAmount: {
              type: Type.NUMBER,
              description: 'Numeric transfer amount extracted from receipt if visible',
            },
            extractedBank: {
              type: Type.STRING,
              description: 'Destination bank name printed on receipt',
            },
            extractedAccount: {
              type: Type.STRING,
              description: 'Destination account number printed on receipt',
            },
            extractedAccountName: {
              type: Type.STRING,
              description: 'Destination beneficiary account name printed on receipt',
            },
            extractedSenderName: {
              type: Type.STRING,
              description: 'Sender full name printed on receipt if visible',
            },
            extractedSenderBank: {
              type: Type.STRING,
              description: 'Sender bank name if visible',
            },
            extractedDateTime: {
              type: Type.STRING,
              description: 'Exact date and time string printed on the receipt',
            },
            extractedDateTimeIso: {
              type: Type.STRING,
              description:
                'Receipt date & time converted to ISO-8601 string with +01:00 offset (or empty string if missing)',
            },
            extractedReference: {
              type: Type.STRING,
              description: 'Transaction reference or NIP session ID printed on receipt',
            },
            extractedStatus: {
              type: Type.STRING,
              description: 'Transfer status label printed on receipt (e.g. Successful, Pending, Failed)',
            },
            checks: {
              type: Type.OBJECT,
              properties: {
                amountMatch: { type: Type.BOOLEAN },
                bankMatch: { type: Type.BOOLEAN },
                accountNumberMatch: { type: Type.BOOLEAN },
                accountNameMatch: { type: Type.BOOLEAN },
                statusSuccess: { type: Type.BOOLEAN },
                dateTimeRecent: { type: Type.BOOLEAN },
                noTampering: { type: Type.BOOLEAN },
              },
            },
            summary: {
              type: Type.STRING,
              description:
                'Detailed 1-2 sentence forensic verification summary covering amount, destination, status, and date/time comparison.',
            },
          },
        },
      },
    });

    interface RawAiAudit {
      verdict?: string;
      confidence?: number;
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
      checks?: Partial<ReceiptAuditChecks>;
      summary?: string;
    }

    const parsed = JSON.parse((response.text ?? '{}').trim()) as RawAiAudit;

    const rawVerdict: 'match' | 'uncertain' | 'mismatch' =
      parsed.verdict === 'match' || parsed.verdict === 'mismatch' || parsed.verdict === 'uncertain'
        ? parsed.verdict
        : 'uncertain';

    let verdict: 'match' | 'uncertain' | 'mismatch' = rawVerdict;
    let confidence =
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 50;
    const notes: string[] = [];

    // Deterministic check #1: Exact Amount
    const amountMatch =
      typeof parsed.extractedAmount === 'number' &&
      Number.isFinite(parsed.extractedAmount) &&
      Math.abs(parsed.extractedAmount - params.claimedAmount) <= 1 &&
      parsed.checks?.amountMatch !== false;
    if (!amountMatch && typeof parsed.extractedAmount === 'number') {
      verdict = 'mismatch';
      confidence = Math.max(confidence, 92);
      notes.push(
        `Amount mismatch: receipt shows ₦${parsed.extractedAmount.toLocaleString()} vs claimed ₦${params.claimedAmount.toLocaleString()}.`,
      );
    }

    // Deterministic check #2: Destination Bank & Account Number & Account Name
    const expectedDigits = params.expectedAccountNumber.replace(/\D/g, '');
    const extractedDigits = (parsed.extractedAccount || '').replace(/\D/g, '');
    let accountNumberMatch = Boolean(parsed.checks?.accountNumberMatch);
    if (expectedDigits && extractedDigits.length >= 6) {
      if (extractedDigits.includes(expectedDigits)) {
        accountNumberMatch = true;
      } else if (extractedDigits.length >= 10) {
        accountNumberMatch = false;
        verdict = 'mismatch';
        confidence = Math.max(confidence, 92);
        notes.push(
          `Destination account mismatch: receipt shows ${parsed.extractedAccount} instead of ${params.expectedAccountNumber}.`,
        );
      }
    } else if (!parsed.extractedAccount) {
      accountNumberMatch = false;
    }

    const bankMatch =
      Boolean(parsed.checks?.bankMatch) &&
      Boolean(parsed.extractedBank && parsed.extractedBank.trim().length > 0);

    const accountNameMatch =
      Boolean(parsed.checks?.accountNameMatch) ||
      nameTokensMatch(parsed.extractedAccountName, params.expectedAccountName);

    const statusSuccess = Boolean(parsed.checks?.statusSuccess);
    const noTampering = parsed.checks?.noTampering !== false;
    if (!noTampering) {
      verdict = 'mismatch';
      confidence = Math.max(confidence, 90);
      notes.push('Possible image tampering or cropped receipt detected.');
    }
    if (!statusSuccess && parsed.extractedStatus) {
      verdict = 'mismatch';
      confidence = Math.max(confidence, 90);
      notes.push(`Transfer status is "${parsed.extractedStatus}" (not successful).`);
    }

    // Deterministic check #3: Date & Time Freshness vs Current Nigeria Time
    let dateTimeRecent = Boolean(parsed.checks?.dateTimeRecent);
    let ageMinutes: number | undefined;
    if (parsed.extractedDateTimeIso) {
      const parsedMs = Date.parse(parsed.extractedDateTimeIso);
      if (!Number.isNaN(parsedMs)) {
        ageMinutes = Math.round((now.getTime() - parsedMs) / 60000);
        if (ageMinutes < -15) {
          dateTimeRecent = false;
          verdict = 'mismatch';
          confidence = Math.max(confidence, 95);
          notes.push(
            `Receipt timestamp (${parsed.extractedDateTime || parsed.extractedDateTimeIso}) is in the future compared to Nigeria time.`,
          );
        } else if (ageMinutes > 2880) {
          dateTimeRecent = false;
          verdict = 'mismatch';
          confidence = Math.max(confidence, 90);
          notes.push(
            `Receipt is too old (${Math.round(ageMinutes / 60)}h ago vs current time).`,
          );
        } else if (ageMinutes > 720) {
          dateTimeRecent = false;
          if (verdict === 'match') verdict = 'uncertain';
          notes.push(
            `Receipt is ${Math.round(ageMinutes / 60)}h old (over 12h auto-approval window); routed to Admin review.`,
          );
        } else {
          dateTimeRecent = true;
        }
      }
    } else if (!parsed.extractedDateTime) {
      dateTimeRecent = false;
      if (verdict === 'match') verdict = 'uncertain';
      notes.push('Receipt date & time could not be read clearly.');
    }

    // Deterministic check #4: Unique Transaction Reference / Session ID
    const cleanRef = (parsed.extractedReference || '').trim();
    const normRef = cleanRef.toLowerCase();
    const duplicateRef =
      normRef.length >= 6
        ? existing.find(
            (d) =>
              d.status !== 'rejected' &&
              d.reference &&
              d.reference.trim().toLowerCase() === normRef,
          )
        : undefined;

    const uniqueReference = !duplicateRef;
    if (duplicateRef) {
      verdict = 'mismatch';
      confidence = 99;
      notes.push(
        `Duplicate bank reference "${cleanRef}" was already used on deposit #${duplicateRef.id}.`,
      );
    }

    const checks: ReceiptAuditChecks = {
      amountMatch,
      bankMatch,
      accountNumberMatch,
      accountNameMatch,
      statusSuccess,
      dateTimeRecent,
      noTampering,
      uniqueReference,
    };

    const allChecksPassed =
      checks.amountMatch &&
      checks.bankMatch &&
      checks.accountNumberMatch &&
      checks.accountNameMatch &&
      checks.statusSuccess &&
      checks.dateTimeRecent &&
      checks.noTampering &&
      checks.uniqueReference;

    if (!allChecksPassed && verdict === 'match') {
      verdict = 'uncertain';
    }

    const baseSummary = parsed.summary || 'AI forensic receipt inspection completed.';
    const finalSummary = notes.length > 0 ? `${baseSummary} Checks: ${notes.join(' ')}` : baseSummary;

    return {
      receiptHash,
      allChecksPassed,
      aiAudit: {
        verdict,
        confidence,
        extractedAmount:
          typeof parsed.extractedAmount === 'number' ? parsed.extractedAmount : undefined,
        extractedBank: parsed.extractedBank,
        extractedAccount: parsed.extractedAccount,
        extractedAccountName: parsed.extractedAccountName,
        extractedSenderName: parsed.extractedSenderName,
        extractedSenderBank: parsed.extractedSenderBank,
        extractedDateTime: parsed.extractedDateTime,
        extractedDateTimeIso: parsed.extractedDateTimeIso,
        extractedReference: cleanRef || undefined,
        extractedStatus: parsed.extractedStatus,
        ageMinutes,
        checks,
        inspectedAt: nowIso,
        summary: finalSummary,
      },
    };
  } catch (err) {
    console.error('Gemini receipt verification error:', err);
    return {
      receiptHash,
      allChecksPassed: false,
      aiAudit: {
        verdict: 'unavailable',
        confidence: 0,
        inspectedAt: nowIso,
        summary: 'AI receipt check temporarily unavailable; queued for manual Admin inspection.',
      },
    };
  }
}

export interface CustomSectionStarterProduct {
  title: string;
  shortSpec: string;
  description: string;
  buyWarning: string;
  buyWarningLevel: 'serious' | 'info';
  price: number;
  stock: number;
  credentialTemplate: string;
}

export interface CustomSectionSetupResult {
  refinedDescription: string;
  badgeTag: string;
  accentColor: string;
  recommendedIcon: string;
  defaultBuyWarning: string;
  defaultBuyWarningLevel: 'serious' | 'info';
  aiNotes: string;
  starterProducts: CustomSectionStarterProduct[];
  source: 'gemini' | 'fallback';
}

function buildFallbackSectionSetup(params: {
  name: string;
  description?: string;
  currencySymbol?: string;
}): CustomSectionSetupResult {
  const cleanName = params.name.trim() || 'Digital Suite';
  const cleanDesc =
    (params.description || '').trim() ||
    `Verified ${cleanName} products with instant automated Vault delivery.`;
  const lower = `${cleanName} ${cleanDesc}`.toLowerCase();
  const isSerious =
    /account|proxy|vpn|bank|kyc|login|2fa|stripe|paypal|fb|facebook|tiktok/.test(lower);
  const accentColor = /vpn|proxy|security|cloud/.test(lower)
    ? '#0EA5E9'
    : /stream|music|video|youtube|netflix/.test(lower)
      ? '#E11D48'
      : /ai|bot|gpt|claude|tool/.test(lower)
        ? '#7C3AED'
        : '#2563EB';
  const recommendedIcon = /ai|bot|gpt/.test(lower)
    ? 'Sparkles'
    : /stream|video|music/.test(lower)
      ? 'Play'
      : /vpn|proxy/.test(lower)
        ? 'Shield'
        : 'Layers';

  return {
    refinedDescription: cleanDesc,
    badgeTag: 'NEW',
    accentColor,
    recommendedIcon,
    defaultBuyWarning: isSerious
      ? `Important Notice: Ensure you follow the recommended IP/VPN setup before logging into ${cleanName} credentials. Vault deliveries cannot be refunded after reveal.`
      : `Delivery Info: Your ${cleanName} access details are delivered immediately to your Vault after checkout confirmation.`,
    defaultBuyWarningLevel: isSerious ? 'serious' : 'info',
    aiNotes: 'Configured with SureDeal Section Architect template.',
    starterProducts: [
      {
        title: `${cleanName} — Starter Access`,
        shortSpec: 'Instant Vault Delivery · Verified Quality',
        description: `Ready-to-use ${cleanName} starter package delivered directly inside your SureDeal Vault immediately after purchase.`,
        buyWarning: isSerious
          ? 'Use clean residential IP and review login instructions before first sign-in.'
          : 'Credentials appear automatically in your Vault once payment succeeds.',
        buyWarningLevel: isSerious ? 'serious' : 'info',
        price: 3500,
        stock: 20,
        credentialTemplate: 'ACCESS-{{KEY4}}-{{RAND4}}',
      },
      {
        title: `${cleanName} — Pro Bundle`,
        shortSpec: 'Priority Fulfillment · 30-Day Replacement Cover',
        description: `Higher-capacity ${cleanName} package built for teams, creators, and heavy daily operations.`,
        buyWarning: isSerious
          ? 'Save your 2FA backup key immediately after opening the Vault card.'
          : 'Includes priority replacement coverage for valid issues reported within 24h.',
        buyWarningLevel: isSerious ? 'serious' : 'info',
        price: 7500,
        stock: 15,
        credentialTemplate: 'PRO-{{KEY4}}-{{KEY4}}',
      },
    ],
    source: 'fallback',
  };
}

export async function generateCustomSectionSetupWithAi(params: {
  name: string;
  description?: string;
  goal?: string;
  currencySymbol?: string;
}): Promise<CustomSectionSetupResult> {
  const fallback = buildFallbackSectionSetup(params);
  const ai = getAiClient();
  if (!ai) {
    return fallback;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are an e-commerce merchandiser for SureDeal Store (a Nigerian digital products platform priced in Naira ₦).
An admin is creating a custom storefront navigation section:
- Section Name: ${params.name}
- Admin Short Description: ${params.description || '(none provided)'}
- Merchandising Goal / Notes: ${params.goal || 'Fast setup with clean copy and realistic starter SKUs'}

Generate:
1. refinedDescription: crisp 1-sentence storefront subtitle (max 140 chars).
2. badgeTag: short 1-word uppercase pill label like NEW, HOT, PRO, or VIP (max 6 chars).
3. accentColor: hex color (#RRGGBB) fitting this niche cleanly.
4. recommendedIcon: one of Layers, Sparkles, Shield, Play, KeyRound, Globe.
5. defaultBuyWarning: helpful buyer notice shown before checkout.
6. defaultBuyWarningLevel: "serious" (for login/account/proxy risk notices needing amber caution) or "info" (for general activation/delivery instructions in blue).
7. aiNotes: brief 1-sentence admin merchandising tip.
8. starterProducts: 2 realistic starter products with title, shortSpec, description, buyWarning, buyWarningLevel ("serious" or "info"), price (number in NGN between 1500 and 35000), stock (number 10-50), credentialTemplate (e.g. "Login: user{{RAND4}}@mail.com | Password: Pass{{KEY4}}! | 2FA: {{KEY4}}").`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedDescription: { type: Type.STRING },
            badgeTag: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            recommendedIcon: { type: Type.STRING },
            defaultBuyWarning: { type: Type.STRING },
            defaultBuyWarningLevel: { type: Type.STRING },
            aiNotes: { type: Type.STRING },
            starterProducts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  shortSpec: { type: Type.STRING },
                  description: { type: Type.STRING },
                  buyWarning: { type: Type.STRING },
                  buyWarningLevel: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  stock: { type: Type.NUMBER },
                  credentialTemplate: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<CustomSectionSetupResult>;
    const starterProducts = Array.isArray(parsed.starterProducts) && parsed.starterProducts.length > 0
      ? parsed.starterProducts.slice(0, 4).map((p, i) => ({
          title: String(p.title || `${params.name} Item #${i + 1}`).slice(0, 80),
          shortSpec: String(p.shortSpec || 'Instant Vault Delivery').slice(0, 90),
          description: String(p.description || fallback.refinedDescription).slice(0, 350),
          buyWarning: String(p.buyWarning || fallback.defaultBuyWarning).slice(0, 300),
          buyWarningLevel: (p.buyWarningLevel === 'info' ? 'info' : 'serious') as 'serious' | 'info',
          price: Number.isFinite(Number(p.price)) && Number(p.price) > 0 ? Number(p.price) : 3500,
          stock: Number.isFinite(Number(p.stock)) && Number(p.stock) >= 0 ? Number(p.stock) : 20,
          credentialTemplate: String(p.credentialTemplate || 'ACCESS-{{KEY4}}-{{RAND4}}').slice(0, 140),
        }))
      : fallback.starterProducts;

    return {
      refinedDescription: String(parsed.refinedDescription || fallback.refinedDescription).slice(0, 180),
      badgeTag: String(parsed.badgeTag || 'NEW').toUpperCase().slice(0, 8),
      accentColor: /^#[0-9a-fA-F]{6}$/.test(String(parsed.accentColor || ''))
        ? String(parsed.accentColor).toUpperCase()
        : fallback.accentColor,
      recommendedIcon: String(parsed.recommendedIcon || fallback.recommendedIcon),
      defaultBuyWarning: String(parsed.defaultBuyWarning || fallback.defaultBuyWarning).slice(0, 320),
      defaultBuyWarningLevel: parsed.defaultBuyWarningLevel === 'info' ? 'info' : 'serious',
      aiNotes: String(parsed.aiNotes || 'Generated by AI Section Architect.'),
      starterProducts,
      source: 'gemini',
    };
  } catch (err) {
    console.error('AI section architect error:', err);
    return fallback;
  }
}

