import type { PlatformSettings } from '../src/types.ts';

export interface EmailSendResult {
  delivered: boolean;
  mode: 'resend' | 'preview';
  error?: string;
}

export async function sendTransactionalEmailWeb(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  settings: PlatformSettings;
  envResendApiKey?: string;
}): Promise<EmailSendResult> {
  const siteName = params.settings.siteName || 'SureDeal Store';
  const resendKey = (params.settings.resendApiKey || params.envResendApiKey || '').trim();
  const from = (
    params.settings.smtpFrom ||
    (params.settings.smtpUser
      ? `${siteName} <${params.settings.smtpUser}>`
      : `${siteName} <onboarding@resend.dev>`)
  ).trim();

  if (!resendKey) {
    return { delivered: false, mode: 'preview' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
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
    console.error('Worker Resend API error:', resp.status, errBody);
    return { delivered: false, mode: 'resend', error: `Resend rejected request (${resp.status})` };
  } catch (err) {
    console.error('Worker Resend network error:', err);
    return {
      delivered: false,
      mode: 'resend',
      error: err instanceof Error ? err.message : 'Resend request failed',
    };
  }
}
