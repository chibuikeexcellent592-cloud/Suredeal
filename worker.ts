import { SureDealStoreDO, type WorkerEnv } from './worker/backend.ts';

export { SureDealStoreDO };

const STRIP_PROXY_HEADERS = [
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-ew-via',
  'cdn-loop',
];

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      const rawOrigin = (env.API_ORIGIN || '').trim().replace(/\/+$/, '');
      if (rawOrigin) {
        let parsedOrigin: URL;
        try {
          parsedOrigin = new URL(rawOrigin);
        } catch {
          return jsonError(
            'Invalid API_ORIGIN configured on this Cloudflare Worker. Provide a full https:// origin URL.',
            502,
          );
        }

        if (parsedOrigin.origin !== url.origin) {
          const targetUrl = `${parsedOrigin.origin}${url.pathname}${url.search}`;
          const proxyHeaders = new Headers(request.headers);
          for (const h of STRIP_PROXY_HEADERS) {
            proxyHeaders.delete(h);
          }
          proxyHeaders.set('x-forwarded-host', url.host);
          proxyHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));

          const init: RequestInit = {
            method: request.method,
            headers: proxyHeaders,
            redirect: 'manual',
          };
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            init.body = request.body;
          }

          try {
            return await fetch(targetUrl, init);
          } catch {
            return jsonError(
              'Unable to reach the external backend API server configured in API_ORIGIN.',
              502,
            );
          }
        }
      }

      if (!env.STORE_DO) {
        if (url.pathname.startsWith('/api/')) {
          return jsonError(
            'STORE_DO Durable Object binding is missing in wrangler.jsonc. Redeploy using the updated wrangler.jsonc.',
            503,
          );
        }
        return new Response('Not found', { status: 404 });
      }

      const id = env.STORE_DO.idFromName('suredeal-primary');
      const stub = env.STORE_DO.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
