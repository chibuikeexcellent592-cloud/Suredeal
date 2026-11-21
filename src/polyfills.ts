// Lightweight runtime polyfills & feature detection for legacy browsers and older Android WebViews (Android 5+/Chrome 49+/Safari 11+)

export function initBrowserCompat(): void {
  if (typeof window === 'undefined') return;

  const w = window as unknown as Record<string, unknown>;

  // 1. globalThis polyfill (Chrome < 71, Safari < 12.1)
  if (typeof w.globalThis === 'undefined') {
    try {
      Object.defineProperty(Object.prototype, '__sd_gt__', {
        get() {
          return this;
        },
        configurable: true,
      });
      // @ts-expect-error dynamic getter
      const g = typeof __sd_gt__ !== 'undefined' ? __sd_gt__ : window;
      // @ts-expect-error cleanup
      delete Object.prototype.__sd_gt__;
      g.globalThis = g;
    } catch {
      w.globalThis = window;
    }
  }

  // 2. queueMicrotask polyfill (Chrome < 71, Safari < 12.1, older Android WebView)
  if (typeof window.queueMicrotask !== 'function') {
    window.queueMicrotask = (cb: VoidFunction) => {
      if (typeof Promise === 'function') {
        Promise.resolve()
          .then(cb)
          .catch((err) => {
            setTimeout(() => {
              throw err;
            }, 0);
          });
      } else {
        setTimeout(cb, 0);
      }
    };
  }

  // 3. Element.matches & Element.closest & NodeList.forEach (Chrome < 51, Android 5 WebView)
  if (typeof Element !== 'undefined') {
    const ep = Element.prototype as Element & {
      matchesSelector?: (s: string) => boolean;
      mozMatchesSelector?: (s: string) => boolean;
      msMatchesSelector?: (s: string) => boolean;
      oMatchesSelector?: (s: string) => boolean;
      webkitMatchesSelector?: (s: string) => boolean;
    };
    if (!ep.matches) {
      const legacyMatches =
        ep.matchesSelector ||
        ep.mozMatchesSelector ||
        ep.msMatchesSelector ||
        ep.oMatchesSelector ||
        ep.webkitMatchesSelector ||
        function (this: Element, s: string): boolean {
          const doc = this.ownerDocument || document;
          const matches = doc.querySelectorAll(s);
          let i = matches.length;
          while (--i >= 0 && matches.item(i) !== this) {
            // loop
          }
          return i > -1;
        };
      (ep as unknown as { matches: (s: string) => boolean }).matches = legacyMatches;
    }
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (this: Element, s: string) {
        let el: Element | null = this;
        do {
          if (el && el.matches(s)) return el;
          el = el.parentElement || (el.parentNode as Element | null);
        } while (el !== null && el.nodeType === 1);
        return null;
      };
    }
  }

  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach as unknown as typeof NodeList.prototype.forEach;
  }

  // 4. Safe ES2019-ES2022 runtime fallbacks for un-polyfilled environments (including dev server)
  const Obj = Object as unknown as {
    fromEntries?: <T = unknown>(entries: Iterable<readonly [PropertyKey, T]>) => Record<string, T>;
    hasOwn?: (o: object, p: PropertyKey) => boolean;
  };
  if (typeof Obj.fromEntries !== 'function') {
    Obj.fromEntries = <T = unknown>(entries: Iterable<readonly [PropertyKey, T]>) => {
      const out: Record<string, T> = {};
      for (const pair of entries) {
        if (pair && pair.length >= 2) {
          out[String(pair[0])] = pair[1];
        }
      }
      return out;
    };
  }
  if (typeof Obj.hasOwn !== 'function') {
    Obj.hasOwn = (o, p) => Object.prototype.hasOwnProperty.call(o, p);
  }

  if (typeof Array.prototype.at !== 'function') {
    // eslint-disable-next-line no-extend-native
    Array.prototype.at = function (n: number) {
      let idx = Math.trunc(n) || 0;
      if (idx < 0) idx += this.length;
      if (idx < 0 || idx >= this.length) return undefined;
      return this[idx];
    };
  }

  if (typeof String.prototype.replaceAll !== 'function') {
    // eslint-disable-next-line no-extend-native
    String.prototype.replaceAll = function (
      search: string | RegExp,
      replacement: string | ((substring: string, ...args: unknown[]) => string),
    ) {
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError('replaceAll must be called with a global RegExp');
        }
        return this.replace(search, replacement as string);
      }
      return this.split(search).join(String(replacement));
    };
  }

  if (typeof Promise !== 'undefined' && typeof Promise.allSettled !== 'function') {
    Promise.allSettled = ((promises: Iterable<unknown>) =>
      Promise.all(
        Array.from(promises).map((p) =>
          Promise.resolve(p).then(
            (value) => ({ status: 'fulfilled' as const, value }),
            (reason) => ({ status: 'rejected' as const, reason }),
          ),
        ),
      )) as typeof Promise.allSettled;
  }

  // 5. CustomEvent fallback
  if (typeof window.CustomEvent !== 'function') {
    const CustomEventPolyfill = function (
      event: string,
      params?: CustomEventInit,
    ) {
      const opts = params || { bubbles: false, cancelable: false, detail: undefined };
      const evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, Boolean(opts.bubbles), Boolean(opts.cancelable), opts.detail);
      return evt;
    };
    CustomEventPolyfill.prototype = window.Event.prototype;
    w.CustomEvent = CustomEventPolyfill;
  }

  // 6. Lightweight URLSearchParams fallback (Chrome < 49 / Android 5 stock WebView)
  if (typeof window.URLSearchParams !== 'function') {
    class SimpleURLSearchParams {
      private map: Record<string, string[]> = {};
      constructor(init?: string) {
        const str = (init || '').replace(/^\?/, '');
        if (!str) return;
        for (const part of str.split('&')) {
          if (!part) continue;
          const idx = part.indexOf('=');
          const k = decodeURIComponent((idx >= 0 ? part.slice(0, idx) : part).replace(/\+/g, ' '));
          const v = decodeURIComponent((idx >= 0 ? part.slice(idx + 1) : '').replace(/\+/g, ' '));
          if (!this.map[k]) this.map[k] = [];
          this.map[k].push(v);
        }
      }
      get(key: string): string | null {
        return this.map[key]?.[0] ?? null;
      }
      has(key: string): boolean {
        return Boolean(this.map[key]?.length);
      }
    }
    w.URLSearchParams = SimpleURLSearchParams;
  }

  // 7. Minimal Headers + XHR-backed fetch fallback (only when fetch is missing on ultra-old Android 4.4/5.0)
  if (typeof window.Headers !== 'function') {
    class SimpleHeaders {
      private store: Record<string, string> = {};
      constructor(init?: HeadersInit) {
        if (Array.isArray(init)) {
          init.forEach(([k, v]) => this.set(k, v));
        } else if (init && typeof init === 'object') {
          Object.keys(init).forEach((k) => this.set(k, (init as Record<string, string>)[k]));
        }
      }
      set(name: string, value: string) {
        this.store[name.toLowerCase()] = String(value);
      }
      get(name: string): string | null {
        const key = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
      }
      has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.store, name.toLowerCase());
      }
      forEach(cb: (value: string, key: string) => void) {
        Object.keys(this.store).forEach((k) => cb(this.store[k], k));
      }
    }
    w.Headers = SimpleHeaders;
  }

  if (typeof window.fetch !== 'function') {
    w.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = typeof input === 'string' ? input : String(input);
        const method = (init?.method || 'GET').toUpperCase();
        xhr.open(method, url, true);
        if (init?.credentials === 'include') xhr.withCredentials = true;

        const hdrs = init?.headers;
        if (hdrs) {
          if (typeof (hdrs as Headers).forEach === 'function') {
            (hdrs as Headers).forEach((val, key) => {
              try {
                xhr.setRequestHeader(key, val);
              } catch {
                // ignore restricted headers
              }
            });
          } else if (typeof hdrs === 'object') {
            Object.entries(hdrs as Record<string, string>).forEach(([key, val]) => {
              try {
                xhr.setRequestHeader(key, val);
              } catch {
                // ignore restricted headers
              }
            });
          }
        }

        xhr.onload = () => {
          const responseHeaders = new window.Headers();
          const rawHeaders = xhr.getAllResponseHeaders() || '';
          rawHeaders.split(/\r?\n/).forEach((line) => {
            const idx = line.indexOf(':');
            if (idx > 0) {
              responseHeaders.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
            }
          });
          const bodyText = xhr.responseText || '';
          const status = xhr.status === 1223 ? 204 : xhr.status;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: xhr.statusText || '',
            headers: responseHeaders,
            text: () => Promise.resolve(bodyText),
            json: () => Promise.resolve(bodyText ? JSON.parse(bodyText) : {}),
          });
        };
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.ontimeout = () => reject(new TypeError('Network request timed out'));
        xhr.send((init?.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
      });
  }

  // 8. Feature-detect CSS flexbox `gap` (missing in Chrome < 84 / Android 5-10 / Safari < 14.1)
  try {
    if (document.body) {
      flagFlexGap();
    } else {
      document.addEventListener('DOMContentLoaded', flagFlexGap, false);
    }
  } catch {
    // ignore
  }
}

function flagFlexGap(): void {
  try {
    document.removeEventListener('DOMContentLoaded', flagFlexGap, false);
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.style.pointerEvents = 'none';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    const isSupported = flex.scrollHeight === 1;
    document.body.removeChild(flex);
    if (!isSupported && document.documentElement) {
      if (document.documentElement.classList) {
        document.documentElement.classList.add('no-flex-gap');
      } else {
        document.documentElement.className += ' no-flex-gap';
      }
    }
  } catch {
    // ignore
  }
}

initBrowserCompat();
