export default {
  async fetch(request) {
    const origin = 'https://velikoyosb.meb.k12.tr';
    const url = new URL(request.url);
    const targetUrl = new URL(origin + url.pathname + url.search);

    // Copy headers from the incoming request
    const incomingHeaders = new Headers(request.headers);
    const headers = new Headers();

    // Copy all headers except those we need to modify
    incomingHeaders.forEach((value, key) => {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Always set these headers to match the origin site
    headers.set('Referer', origin);
    headers.set('Origin', origin);
    headers.set('X-Requested-With', 'XMLHttpRequest');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Fetch the resource
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
    });

    // Create modified response with CORS headers
    const modifiedResponse = new Response(response.body, response);

    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    modifiedResponse.headers.set('Access-Control-Expose-Headers', '*');

    const contentType = response.headers.get('Content-Type');
    if (contentType) {
      modifiedResponse.headers.set('Content-Type', contentType);
    }

    return modifiedResponse;
  },
};
