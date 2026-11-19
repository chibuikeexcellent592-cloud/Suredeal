const TOKEN_KEY = 'suredeal_auth_token';
const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '',
)
  .trim()
  .replace(/\/+$/, '');

export function resolveApiUrl(url: string): string {
  if (
    !url ||
    /^https?:\/\//i.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('/src/') ||
    url.startsWith('/assets/')
  ) {
    return url;
  }
  if (!API_BASE_URL) return url;
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;
}

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(resolveApiUrl(url), {
    cache: 'no-store',
    ...options,
    headers,
  });

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let data: unknown = {};
  let jsonValid = true;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      jsonValid = false;
      data = { error: text };
    }
  }

  if (!res.ok) {
    if (res.status === 503 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('suredeal:maintenance'));
    }
    const errMsg =
      jsonValid && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(errMsg, res.status);
  }

  if (!jsonValid || contentType.includes('text/html')) {
    throw new Error(
      'Backend API is unreachable or returned HTML instead of JSON. Ensure the API server is running.',
    );
  }

  return data as T;
}

export function formatNaira(amount: number, symbol = '₦'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safe.toLocaleString('en-NG')}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand for iOS Safari / restricted contexts
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(el);
    return copied;
  } catch {
    return false;
  }
}

export function formatAccountCredential(
  login: string,
  password: string,
  twoFactor?: string,
): string {
  const cleanLogin = login.trim();
  const cleanPass = password.trim();
  const clean2fa = (twoFactor || '').trim() || 'None';
  return `Login: ${cleanLogin} | Password: ${cleanPass} | 2FA: ${clean2fa}`;
}

export function parseAccountCredential(
  raw: string,
): { login: string; password: string; twoFactor: string } | null {
  const match = raw.match(
    /^Login:\s*(.+?)\s*\|\s*Password:\s*(.+?)\s*\|\s*2FA:\s*(.+)$/i,
  );
  if (!match) return null;
  return {
    login: match[1].trim(),
    password: match[2].trim(),
    twoFactor: match[3].trim(),
  };
}

export function formatCountdown(
  expiresAt: string,
  nowMs: number,
): { label: string; remainingMs: number; isUrgent: boolean } {
  const targetMs = new Date(expiresAt).getTime();
  const remainingMs = Number.isFinite(targetMs) ? Math.max(0, targetMs - nowMs) : 0;
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return {
    label,
    remainingMs,
    isUrgent: remainingMs > 0 && remainingMs <= 120_000,
  };
}

