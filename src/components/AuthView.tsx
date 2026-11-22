import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { PublicUser } from '../types';
import { BrandLogo } from './BrandLogo';
import { BrandNameText } from './BrandNameText';

interface AuthViewProps {
  initialMode: 'login' | 'signup';
  onBack: () => void;
  onSuccess: (user: PublicUser) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function AuthView({ initialMode, onBack, onSuccess }: AuthViewProps) {
  const { catalog, login, signup, verifySignupCode, resendSignupCode, googleAuth, notify } =
    useApp();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email verification step state
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyInfo, setVerifyInfo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const settings = catalog?.settings;
  const siteName = settings?.siteName || 'SureDeal Store';
  const maintenance = Boolean(settings?.maintenanceMode);
  const googleEnabled = Boolean(
    !maintenance && !verifyEmail && settings?.googleAuthEnabled && settings?.googleClientId?.trim(),
  );
  const googleClientId = settings?.googleClientId?.trim() || '';

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg('');
    setVerifyEmail(null);
    setOtpCode('');
  }, [initialMode]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) setReferralCode(ref);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || !googleBtnRef.current) return;

    let cancelled = false;
    const renderGoogleButton = () => {
      if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
      try {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) {
              setErrorMsg('Google did not return a credential token. Please try again.');
              return;
            }
            setErrorMsg('');
            setGoogleBusy(true);
            try {
              const loggedUser = await googleAuth(
                response.credential,
                referralCode.trim() || undefined,
              );
              notify(`Signed in with Google as ${loggedUser.name}`, 'success');
              onSuccess(loggedUser);
            } catch (err) {
              setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed');
            } finally {
              setGoogleBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          shape: 'pill',
        });
      } catch {
        // ignore rendering error
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]',
      );
      if (existingScript) {
        existingScript.addEventListener('load', renderGoogleButton);
        return () => {
          cancelled = true;
          existingScript.removeEventListener('load', renderGoogleButton);
        };
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleEnabled, googleClientId, mode, referralCode, googleAuth, notify, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (mode === 'login' || maintenance) {
        const loggedUser = await login(email.trim(), password);
        notify(`Welcome back, ${loggedUser.name}`, 'success');
        onSuccess(loggedUser);
      } else {
        const res = await signup(
          name.trim(),
          email.trim(),
          password,
          referralCode.trim() || undefined,
        );
        if (res.user) {
          notify(`Welcome to ${siteName}, ${res.user.name}!`, 'success');
          onSuccess(res.user);
        } else if (res.requiresVerification) {
          const targetEmail = res.email || email.trim().toLowerCase();
          setVerifyEmail(targetEmail);
          setOtpCode('');
          setResendCooldown(30);
          setVerifyInfo(
            res.message ||
              `We sent a 6-digit verification code to ${targetEmail}. Check your inbox and spam folder.`,
          );
          notify(`Verification code sent to ${targetEmail}`, 'info');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail) return;
    setErrorMsg('');
    const cleaned = otpCode.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setErrorMsg('Enter the 6-digit verification code sent to your email.');
      return;
    }
    setVerifying(true);
    try {
      const verifiedUser = await verifySignupCode(verifyEmail, cleaned);
      notify(`Email verified! Welcome to ${siteName}, ${verifiedUser.name}`, 'success');
      onSuccess(verifiedUser);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!verifyEmail || resending || resendCooldown > 0) return;
    setErrorMsg('');
    setResending(true);
    try {
      const res = await resendSignupCode(verifyEmail);
      setResendCooldown(30);
      setVerifyInfo(res.message || `A new 6-digit verification code was sent to ${verifyEmail}.`);
      notify(`Fresh verification code sent to ${verifyEmail}`, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not resend verification code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-6 py-12 bg-[var(--site-bg)]">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {siteName}
        </button>

        <div className="mb-6">
          <div className="mb-4 inline-flex items-center gap-3">
            <BrandLogo
              logoUrl={settings?.siteLogoUrl}
              siteName={siteName}
              size="lg"
              shape="rounded"
            />
            <span className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:text-slate-200">
              <BrandNameText settings={settings} />
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {verifyEmail
              ? 'Verify your email'
              : maintenance
                ? 'Authorized Team Access'
                : mode === 'login'
                  ? 'Sign in to your account'
                  : 'Create your account'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {verifyEmail
              ? `Enter the 6-digit code sent directly to ${verifyEmail}.`
              : maintenance
                ? 'Protected Maintenance Mode is enabled. Only our team can sign in right now.'
                : mode === 'login'
                  ? 'Access your SMS verification numbers, boosting campaigns, and digital vault.'
                  : 'Register for instant virtual numbers, proxies, boosting, and automated Naira wallet funding.'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs">
          {maintenance && (
            <div className="mb-5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Maintenance Mode active · Team credentials required</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {verifyEmail ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-sky-400" />
                <div>
                  <p className="font-semibold">Verification Email Sent</p>
                  <p className="mt-0.5 opacity-90">{verifyInfo}</p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-otp"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-2xl font-mono font-extrabold tracking-[0.4em] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                />
              </div>

              <button
                type="submit"
                disabled={verifying || otpCode.length !== 6}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{verifying ? 'Verifying...' : 'Verify & Activate Account'}</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  disabled={resending || resendCooldown > 0}
                  onClick={() => void handleResendCode()}
                  className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-sky-400 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend code (${resendCooldown}s)`
                      : resending
                        ? 'Sending...'
                        : 'Resend code'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyEmail(null);
                    setOtpCode('');
                    setErrorMsg('');
                  }}
                  className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && !maintenance && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'signup' && !maintenance && (
                  <div>
                    <label
                      htmlFor="auth-referral"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Referral Code (Optional)
                    </label>
                    <input
                      id="auth-referral"
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="e.g. SD4A8F1C"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || googleBusy}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting
                    ? mode === 'login' || maintenance
                      ? 'Signing in...'
                      : 'Sending verification...'
                    : mode === 'login' || maintenance
                      ? 'Sign In'
                      : 'Create Account'}
                </button>
              </form>

              {googleEnabled && (
                <div className="mt-4 space-y-3">
                  <div className="relative flex items-center justify-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                    <span className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white dark:bg-slate-900 shrink-0">
                      Or continue with
                    </span>
                    <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <div ref={googleBtnRef} className="min-h-[42px] flex items-center justify-center" />
                    {googleBusy && (
                      <p className="text-xs text-slate-500 mt-1.5">Verifying Google session...</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!maintenance && !verifyEmail && (
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
              {mode === 'login' ? (
                <>
                  New to {siteName}?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setMode('signup');
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Create a free account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setMode('login');
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
