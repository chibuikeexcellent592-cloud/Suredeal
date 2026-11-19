import type { ReceiptAiAudit, ReceiptAuditChecks } from '../src/types.ts';
import { sha256Hex } from './crypto.ts';

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

export async function verifyMoniepointReceiptWithAiWeb(params: {
  receiptDataUrl: string;
  claimedAmount: number;
  expectedBank: string;
  expectedAccountNumber: string;
  expectedAccountName: string;
  existingDeposits?: ExistingDepositSnapshot[];
  geminiApiKey?: string;
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
  const receiptHash = await sha256Hex(base64Data);
  const existing = params.existingDeposits || [];

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

  const apiKey = (params.geminiApiKey || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const prompt = `You are a strict forensic Nigerian bank transfer auditor for SureDeal Store.
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
1. AUTHENTICITY & TAMPERING (noTampering): Is this an authentic, unedited Nigerian bank transfer receipt?
2. TRANSFER STATUS (statusSuccess): Does the receipt explicitly show "Successful", "Completed", or "Transfer Successful"?
3. EXACT AMOUNT (extractedAmount & amountMatch): Extract the exact transfer amount sent. It must equal ${params.claimedAmount}.
4. DESTINATION BANK (extractedBank & bankMatch): Compare beneficiary bank against "${params.expectedBank}".
5. DESTINATION ACCOUNT NUMBER (extractedAccount & accountNumberMatch): Compare beneficiary account digits against "${params.expectedAccountNumber}".
6. DESTINATION ACCOUNT NAME (extractedAccountName & accountNameMatch): Compare beneficiary name against "${params.expectedAccountName}".
7. DATE & TIME COMPARISON (extractedDateTime, extractedDateTimeIso, dateTimeRecent):
   - Convert printed date/time to ISO-8601 assuming Nigeria WAT +01:00 if no offset is printed.
   - Compare against ${nowLagosFormatted}. Future (>15m ahead) or >48h old -> verdict="mismatch".
8. SENDER & REFERENCE (extractedSenderName, extractedSenderBank, extractedReference): Extract sender details and transaction reference / NIP session ID.

Respond strictly in JSON.`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              verdict: { type: 'STRING' },
              confidence: { type: 'NUMBER' },
              extractedAmount: { type: 'NUMBER' },
              extractedBank: { type: 'STRING' },
              extractedAccount: { type: 'STRING' },
              extractedAccountName: { type: 'STRING' },
              extractedSenderName: { type: 'STRING' },
              extractedSenderBank: { type: 'STRING' },
              extractedDateTime: { type: 'STRING' },
              extractedDateTimeIso: { type: 'STRING' },
              extractedReference: { type: 'STRING' },
              extractedStatus: { type: 'STRING' },
              checks: {
                type: 'OBJECT',
                properties: {
                  amountMatch: { type: 'BOOLEAN' },
                  bankMatch: { type: 'BOOLEAN' },
                  accountNumberMatch: { type: 'BOOLEAN' },
                  accountNameMatch: { type: 'BOOLEAN' },
                  statusSuccess: { type: 'BOOLEAN' },
                  dateTimeRecent: { type: 'BOOLEAN' },
                  noTampering: { type: 'BOOLEAN' },
                },
              },
              summary: { type: 'STRING' },
            },
          },
        },
      }),
    });

    if (!resp.ok) {
      throw new Error(`Gemini HTTP ${resp.status}`);
    }

    const payload = (await resp.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

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

    const parsed = JSON.parse(rawText.trim()) as RawAiAudit;

    const rawVerdict: 'match' | 'uncertain' | 'mismatch' =
      parsed.verdict === 'match' || parsed.verdict === 'mismatch' || parsed.verdict === 'uncertain'
        ? parsed.verdict
        : 'uncertain';

    let verdict: 'match' | 'uncertain' | 'mismatch' = rawVerdict;
    let confidence =
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 50;
    const notes: string[] = [];

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
          notes.push(`Receipt is too old (${Math.round(ageMinutes / 60)}h ago vs current time).`);
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
    console.error('Worker Gemini receipt verification error:', err);
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
