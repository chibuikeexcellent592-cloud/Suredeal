import nodemailer from 'nodemailer';
import type { PlatformSettings } from '../src/types.ts';

export interface EmailSendResult {
  delivered: boolean;
  mode: 'resend' | 'smtp' | 'preview';
  error?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  settings: PlatformSettings;
}): Promise<EmailSendResult> {
  const siteName = params.settings.siteName || 'SureDeal Store';
  const resendKey = (params.settings.resendApiKey || process.env.RESEND_API_KEY || '').trim();
  const smtpHost = (params.settings.smtpHost || process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(params.settings.smtpPort || process.env.SMTP_PORT || 587);
  const smtpUser = (params.settings.smtpUser || process.env.SMTP_USER || '').trim();
  const smtpPass = (params.settings.smtpPass || process.env.SMTP_PASS || '').trim();
  const smtpFrom = (
    params.settings.smtpFrom ||
    process.env.SMTP_FROM ||
    (smtpUser ? `${siteName} <${smtpUser}>` : `${siteName} <onboarding@resend.dev>`)
  ).trim();

  // 1. Prefer Resend API if configured
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: smtpFrom,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (resp.ok) {
        return { delivered: true, mode: 'resend' };
      }
      const errBody = await resp.text();
      console.error('Resend API error:', resp.status, errBody);
      return { delivered: false, mode: 'resend', error: `Resend rejected request (${resp.status})` };
    } catch (err) {
      console.error('Resend network error:', err);
      return {
        delivered: false,
        mode: 'resend',
        error: err instanceof Error ? err.message : 'Resend request failed',
      };
    }
  }

  // 2. Otherwise use SMTP via Nodemailer if configured
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: smtpFrom,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { delivered: true, mode: 'smtp' };
    } catch (err) {
      console.error('SMTP email send failed:', err);
      return {
        delivered: false,
        mode: 'smtp',
        error: err instanceof Error ? err.message : 'SMTP delivery failed',
      };
    }
  }

  // 3. No mail credentials configured yet — caller can gracefully show sandbox preview code
  return { delivered: false, mode: 'preview' };
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
  settings: PlatformSettings;
}): Promise<EmailSendResult> {
  const siteName = params.settings.siteName || 'SureDeal Store';
  const supportEmail = params.settings.supportEmail || 'chibuikeexcellent592@gmail.com';
  const safeName = escapeHtml(params.name || 'Customer');
  const safeSite = escapeHtml(siteName);
  const safeCode = escapeHtml(params.code);

  const subject = `${params.code} is your ${siteName} verification code`;
  const text = [
    `Hello ${params.name},`,
    '',
    `Your ${siteName} email verification code is: ${params.code}`,
    `This code expires in ${params.expiresInMinutes} minutes.`,
    '',
    `If you did not request this account registration, you can ignore this email.`,
    `Need help? Contact ${supportEmail}`,
  ].join('\n');

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F8FAFC; padding:32px 16px; color:#0F172A;">
    <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; padding:28px;">
      <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#0077FF;">
        ${safeSite}
      </p>
      <h1 style="margin:0 0 12px; font-size:22px; font-weight:700; color:#0F172A;">
        Verify your email address
      </h1>
      <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#475569;">
        Hello ${safeName}, enter the 6-digit verification code below to finish creating your ${safeSite} account and access your dashboard.
      </p>
      <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:18px; text-align:center; margin:0 0 20px;">
        <span style="font-family: 'SFMono-Regular', Consolas, monospace; font-size:32px; font-weight:800; letter-spacing:0.22em; color:#0077FF;">
          ${safeCode}
        </span>
      </div>
      <p style="margin:0 0 12px; font-size:13px; color:#64748B;">
        This code expires in <strong>${params.expiresInMinutes} minutes</strong>. Never share this code with anyone.
      </p>
      <hr style="border:none; border-top:1px solid #E2E8F0; margin:20px 0;" />
      <p style="margin:0; font-size:12px; color:#94A3B8;">
        Questions? Reply or contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0077FF;">${escapeHtml(supportEmail)}</a>.
      </p>
    </div>
  </div>`;

  return sendTransactionalEmail({
    to: params.to,
    subject,
    text,
    html,
    settings: params.settings,
  });
}
