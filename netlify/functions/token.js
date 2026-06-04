const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

// Cryptographically secure token (was Math.random, which is predictable).
// 16 bytes of base32-ish output gives ample entropy for a PII-gating token.
function generateToken() {
  return crypto.randomBytes(12).toString('hex'); // 24 hex chars
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };

  var store = getStore({
    name: 'discovery-tokens',
    siteID: '6a4a1c67-e67c-4c03-9173-748beabf2025',
    token: process.env.NETLIFY_API_TOKEN
  });

  if (event.httpMethod === 'GET') {
    var token = event.queryStringParameters && event.queryStringParameters.t;
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'No token provided' }) };

    try {
      var raw = await store.get(token);
      if (!raw) return { statusCode: 404, body: JSON.stringify({ error: 'Token not found or expired' }) };

      var data = JSON.parse(raw);
      if (Date.now() > data.expires) {
        await store.delete(token);
        return { statusCode: 410, body: JSON.stringify({ error: 'Token expired' }) };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tally: data.tally })
      };
    } catch (err) {
      // Don't leak err.message to the client.
      console.error('token GET error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to retrieve token' }) };
    }
  }

  if (event.httpMethod === 'POST') {
    // FAIL CLOSED: if the secret isn't configured, reject — never allow
    // unauthenticated writes to the token store (it holds client PII).
    var secret = process.env.TOKEN_SECRET;
    if (!secret) {
      console.error('TOKEN_SECRET not configured — rejecting POST');
      return { statusCode: 503, body: JSON.stringify({ error: 'Service unavailable' }) };
    }
    if (event.headers['x-token-secret'] !== secret) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
    }

    var body;
    try { body = JSON.parse(event.body); }
    catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid body' }) }; }

    var token = generateToken();
    var payload = JSON.stringify({
      tally: {
        name: body.name || '',
        email: body.email || '',
        business: body.business || '',
        phone: body.phone || '',
        website: body.website || '',
        service: body.service || '',
        pages: body.pages || '',
        features: body.features || '',
        branding: body.branding || '',
        copy: body.copy || '',
        photos: body.photos || '',
        domain: body.domain || '',
        hosting: body.hosting || '',
        budget: body.budget || '',
        deadline: body.deadline || '',
        referral: body.referral || '',
        extra: body.extra || ''
      },
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });

    try {
      await store.set(token, payload);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          url: 'https://southstack.co.nz/discovery?t=' + token
        })
      };
    } catch (err) {
      console.error('token POST error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to store token' }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

// Code-based rate limiting (works on all Netlify plans).
// Token creation/lookup is cheap but PII-bearing — cap it per IP.
exports.config = {
  rateLimit: {
    windowSize: 60,
    windowLimit: 20,
    aggregateBy: ['ip']
  }
};
