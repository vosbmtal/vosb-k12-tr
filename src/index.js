export default {
  async fetch(request, env, ctx) {
    const ORIGIN = 'https://velikoyosb.meb.k12.tr';
    const url = new URL(request.url);

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

    const modifiedResponse = new Response(response.body, response);

    // CORS headers
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');
    modifiedResponse.headers.set('Access-Control-Expose-Headers', '*');

    // Rewrite redirect Location to proxy domain
    const location = modifiedResponse.headers.get('location');
    if (location) {
      modifiedResponse.headers.set(
        'location',
        location.replace(ORIGIN, `${url.protocol}//${url.host}`)
      );
    }

    // Cache static assets at the edge
    if (request.method === 'GET' && response.ok) {
      const ct = response.headers.get('content-type') ?? '';
      const isStatic = /\.(css|js|png|jpe?g|gif|svg|ico|woff2?)$/i.test(url.pathname);
      if (isStatic || ct.includes('image') || ct.includes('font')) {
        ctx.waitUntil(cache.put(cacheKey, modifiedResponse.clone()));
      }
    }

    return modifiedResponse;
  },
};
