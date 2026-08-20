// ============================================================
//  /api/linkedin-token — persistent LinkedIn login
//
//  Mints LinkedIn access tokens from a stored token (refreshing it
//  when the app has refresh-token access) so the dashboard doesn't
//  need to show the LinkedIn login popup on every visit.
//
//  One-time setup:
//    1. https://www.linkedin.com/developers/apps → create an app.
//    2. Products tab → request "Sign In with LinkedIn using OpenID
//       Connect" and "Share on LinkedIn" (both self-serve, instant).
//       For company-page posting also request "Community Management
//       API" (requires LinkedIn review — until approved, only the
//       personal profile can be posted to).
//    3. Auth tab → add this exact redirect URL:
//         https://dashboard.martinjason.com/linkedin-callback.html
//       (and http://localhost:8080/linkedin-callback.html for local dev)
//    4. Put the Client ID in dashboard/config.js → LINKEDIN_CLIENT_ID.
//    5. Vercel → Project Settings → Environment Variables:
//         LINKEDIN_CLIENT_SECRET     Developer app → Auth tab
//         SUPABASE_SERVICE_ROLE_KEY  Supabase → Settings → API → service_role
//         LINKEDIN_ORGANIZATION_ID   (optional) numeric ID of your
//                                    company page, for posting there too
//    6. Run the "app_tokens" block from supabase-setup.sql if you
//       haven't already (shared with /api/ga-token).
//    7. Open the dashboard → LinkedIn → "Mit LinkedIn verbinden" once.
//
//  Endpoints (both require a valid Supabase session JWT):
//    GET            → { access_token, expires_in, person_urn }
//                     mints/returns a valid token from storage
//    POST { code, redirect_uri }
//                   → exchanges the one-time OAuth code from the
//                     dashboard popup, stores the token
// ============================================================

const SUPABASE_URL      = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const TOKEN_ID           = 'linkedin'; // row id in the app_tokens table
const ALLOWED_EMAIL      = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [
    'https://dashboard.martinjason.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:3000',
  ];
  if (allowed.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientSecret || !serviceKey || !LINKEDIN_CLIENT_ID) {
    return res.status(500).json({
      error: 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert',
      code: 'server_not_configured',
    });
  }

  // Only the logged-in dashboard OWNER may mint or store tokens
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing Authorization header' });
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Ungültige Sitzung' });
  const authUser = await userRes.json().catch(() => ({}));
  if (ALLOWED_EMAIL && (authUser.email || '').toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function loadStored() {
    const q = await fetch(
      `${SUPABASE_URL}/rest/v1/app_tokens?id=eq.${TOKEN_ID}&select=token`,
      { headers: sbHeaders },
    );
    if (!q.ok) return null;
    const raw = (await q.json())[0]?.token;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async function storeToken(data) {
    const up = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: TOKEN_ID,
        token: JSON.stringify(data),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!up.ok) {
      throw new Error('Token konnte nicht gespeichert werden — wurde der app_tokens-Block aus supabase-setup.sql ausgeführt?');
    }
  }

  async function linkedinToken(params) {
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: clientSecret,
        ...params,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error_description || data.error || r.statusText);
      err.linkedin = data.error;
      throw err;
    }
    return data;
  }

  async function fetchPersonUrn(accessToken) {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error('LinkedIn-Profil konnte nicht geladen werden (userinfo ' + r.status + ')');
    const data = await r.json();
    if (!data.sub) throw new Error('LinkedIn userinfo enthielt keine Profil-ID');
    return `urn:li:person:${data.sub}`;
  }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.code) return res.status(400).json({ error: 'code fehlt' });
      if (!body.redirect_uri) return res.status(400).json({ error: 'redirect_uri fehlt' });

      const tokens = await linkedinToken({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: body.redirect_uri,
      });

      const person_urn = await fetchPersonUrn(tokens.access_token);
      const expires_at = Date.now() + (tokens.expires_in || 0) * 1000;

      await storeToken({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at,
        person_urn,
      });

      return res.json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        person_urn,
        stored: true,
        has_refresh_token: !!tokens.refresh_token,
      });
    }

    // GET — return a valid access token from storage, refreshing if possible
    const stored = await loadStored();
    if (!stored) {
      return res.status(404).json({ error: 'Noch nicht verbunden', code: 'not_connected' });
    }

    if (stored.expires_at && Date.now() < stored.expires_at - 5 * 60 * 1000) {
      return res.json({
        access_token: stored.access_token,
        expires_in: Math.round((stored.expires_at - Date.now()) / 1000),
        person_urn: stored.person_urn,
      });
    }

    if (!stored.refresh_token) {
      return res.status(409).json({
        error: 'LinkedIn-Verbindung abgelaufen — bitte einmal neu verbinden',
        code: 'reauth_required',
      });
    }

    try {
      const tokens = await linkedinToken({
        grant_type: 'refresh_token',
        refresh_token: stored.refresh_token,
      });
      const expires_at = Date.now() + (tokens.expires_in || 0) * 1000;
      await storeToken({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || stored.refresh_token,
        expires_at,
        person_urn: stored.person_urn,
      });
      return res.json({ access_token: tokens.access_token, expires_in: tokens.expires_in, person_urn: stored.person_urn });
    } catch (e) {
      if (e.linkedin === 'invalid_grant' || e.linkedin === 'invalid_request') {
        const sbDel = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens?id=eq.${TOKEN_ID}`, {
          method: 'DELETE',
          headers: sbHeaders,
        }).catch(() => {});
        void sbDel;
        return res.status(409).json({
          error: 'LinkedIn-Verbindung abgelaufen — bitte einmal neu verbinden',
          code: 'reauth_required',
        });
      }
      throw e;
    }
  } catch (err) {
    console.error('linkedin-token error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
