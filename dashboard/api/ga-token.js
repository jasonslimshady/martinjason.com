// ============================================================
//  /api/ga-token — persistent Google Analytics login
//
//  Mints GA4 access tokens from a stored OAuth refresh token so the
//  dashboard never has to show the Google login popup again.
//
//  One-time setup:
//    1. Run the "app_tokens" block from supabase-setup.sql in the
//       Supabase SQL Editor.
//    2. Vercel → Project Settings → Environment Variables:
//         GOOGLE_CLIENT_SECRET      Google Cloud Console → APIs & Services
//                                   → Credentials → your OAuth Web client
//         SUPABASE_SERVICE_ROLE_KEY Supabase → Settings → API → service_role
//    3. Open the dashboard → Analytics → "Mit Google anmelden"
//       one last time. The refresh token is stored and every device
//       stays connected from then on.
//
//  Endpoints (both require a valid Supabase session JWT):
//    GET            → { access_token, expires_in }
//                     mints a fresh token from the stored refresh token
//    POST { code }  → exchanges the one-time OAuth code from the
//                     dashboard popup, stores the refresh token
// ============================================================

const SUPABASE_URL     = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '672383429326-fve9t1ak2haf7ll2he2r54rkvohtqugt.apps.googleusercontent.com';
const TOKEN_ID         = 'ga4'; // row id in the app_tokens table
const ALLOWED_EMAIL    = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';

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

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientSecret || !serviceKey) {
    return res.status(500).json({
      error: 'GOOGLE_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert',
      code: 'server_not_configured',
    });
  }

  // Only the logged-in dashboard OWNER may mint tokens
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

  async function googleToken(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: clientSecret,
        ...params,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(data.error_description || data.error || r.statusText);
      err.google = data.error;
      throw err;
    }
    return data;
  }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.code) return res.status(400).json({ error: 'code fehlt' });

      // 'postmessage' is the fixed redirect URI for the GIS popup code flow
      const tokens = await googleToken({
        grant_type: 'authorization_code',
        code: body.code,
        redirect_uri: 'postmessage',
      });

      if (tokens.refresh_token) {
        const up = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens`, {
          method: 'POST',
          headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            id: TOKEN_ID,
            token: tokens.refresh_token,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!up.ok) {
          throw new Error('Refresh-Token konnte nicht gespeichert werden — wurde der app_tokens-Block aus supabase-setup.sql ausgeführt?');
        }
      }

      return res.json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        stored: !!tokens.refresh_token,
      });
    }

    // GET — mint a fresh access token from the stored refresh token
    let refreshToken = process.env.GA_REFRESH_TOKEN || null;
    if (!refreshToken) {
      const q = await fetch(
        `${SUPABASE_URL}/rest/v1/app_tokens?id=eq.${TOKEN_ID}&select=token`,
        { headers: sbHeaders },
      );
      if (q.ok) refreshToken = (await q.json())[0]?.token || null;
    }
    if (!refreshToken) {
      return res.status(404).json({ error: 'Noch nicht verbunden', code: 'not_connected' });
    }

    try {
      const tokens = await googleToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      return res.json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
    } catch (e) {
      if (e.google === 'invalid_grant') {
        // Refresh token revoked or expired → forget it so the client
        // shows the connect button instead of failing forever.
        await fetch(`${SUPABASE_URL}/rest/v1/app_tokens?id=eq.${TOKEN_ID}`, {
          method: 'DELETE',
          headers: sbHeaders,
        }).catch(() => {});
        return res.status(409).json({
          error: 'Google-Verbindung abgelaufen — bitte einmal neu verbinden',
          code: 'reauth_required',
        });
      }
      throw e;
    }
  } catch (err) {
    console.error('ga-token error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
