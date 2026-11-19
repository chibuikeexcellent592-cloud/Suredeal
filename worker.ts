interface WorkerEnv {
  ASSETS: {
    fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
  };
  API_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      const apiOrigin = (env.API_ORIGIN || '').trim().replace(/\/+$/, '');
      if (apiOrigin) {
        const targetUrl = `${apiOrigin}${url.pathname}${url.search}`;
        const proxyHeaders = new Headers(request.headers);
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
        return fetch(targetUrl, init);
      }

      if (url.pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({
            error:
              'Backend API server is not configured on this Cloudflare Worker. Set API_ORIGIN in Worker Variables or VITE_API_URL at build time.',
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            },
          },
        );
      }

      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
