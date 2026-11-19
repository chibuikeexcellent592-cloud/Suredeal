interface WorkerEnv {
  ASSETS: {
    fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
  };
  API_ORIGIN?: string;
}

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
      if (!rawOrigin) {
        if (url.pathname.startsWith('/api/')) {
          return jsonError(
            'Backend API server is not configured on this Cloudflare Worker. Set API_ORIGIN in Worker Variables or VITE_API_URL at build time.',
            503,
          );
        }
        return new Response('Not found', { status: 404 });
      }

      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(rawOrigin);
      } catch {
        return jsonError(
          'Invalid API_ORIGIN configured on this Cloudflare Worker. Provide a full https:// origin URL.',
          502,
        );
      }

      if (parsedOrigin.origin === url.origin) {
        return jsonError(
          'API_ORIGIN cannot point to the Cloudflare Worker itself. Set API_ORIGIN to your deployed Node.js backend URL.',
          502,
        );
      }

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
          'Unable to reach the backend API server configured in API_ORIGIN. Verify the backend server is online.',
          502,
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
