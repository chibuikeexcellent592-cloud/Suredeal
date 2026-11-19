const TOKEN_KEY = 'suredeal_auth_token';

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

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response' };
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
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
    await navigator.clipboard.writeText(text);
    return true;
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

