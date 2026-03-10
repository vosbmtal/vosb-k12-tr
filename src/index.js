export default {
  async fetch(request, env, ctx) {
    const ORIGIN = 'https://velikoyosb.meb.k12.tr';
    const url = new URL(request.url);
    const PROXY = `${url.protocol}//${url.host}`;

    // Handle preflight first — no other work needed
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const targetUrl = new URL(ORIGIN + url.pathname + url.search);

    // Build upstream headers
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    headers.set('Referer', ORIGIN);
    headers.set('Origin', ORIGIN);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    headers.set('Accept-Encoding', 'identity'); // prevent upstream gzip; CF strips content-encoding but not the body

    // Cache lookup for GET requests
    const cache = caches.default;
    const cacheKey = new Request(targetUrl.toString(), { headers });
    if (request.method === 'GET') {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    // Fetch upstream
    let response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      });
    } catch {
      return new Response('Bad Gateway', { status: 502 });
    }

    const ct = response.headers.get('content-type') ?? '';
    const isText = ct.includes('text/') || ct.includes('application/javascript') ||
                   ct.includes('application/json') || ct.includes('application/xml');

    // For text responses: rewrite upstream URLs in the body so all sub-requests
    // go through the proxy (fixes CORS errors and cross-origin iframe blocks)
    let body;
    if (isText) {
      const text = await response.text();
      body = text
        .replaceAll(ORIGIN, PROXY)
        .replaceAll(`//${new URL(ORIGIN).host}`, `//${url.host}`);
    } else {
      body = response.body;
    }

    const modifiedResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    // CORS headers
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');
    modifiedResponse.headers.set('Access-Control-Expose-Headers', '*');

    // Rewrite redirect Location to proxy domain
    const location = modifiedResponse.headers.get('location');
    if (location) {
      modifiedResponse.headers.set('location', location.replace(ORIGIN, PROXY));
    }

    // Cache static assets at the edge
    if (request.method === 'GET' && response.ok && !isText) {
      const isStatic = /\.(css|js|png|jpe?g|gif|svg|ico|woff2?)$/i.test(url.pathname);
      if (isStatic || ct.includes('image') || ct.includes('font')) {
        ctx.waitUntil(cache.put(cacheKey, modifiedResponse.clone()));
      }
    }

    return modifiedResponse;
  },
};
