// ============================================================
//  /api/linkedin-publish — actually publish a post draft to LinkedIn
//
//  This is the piece that was missing: the dashboard's "Als gepostet
//  markieren" button used to only flip a status column in Supabase —
//  it never called LinkedIn. This endpoint makes the real API calls.
//
//  POST { id }  (id = row id in the "posts" table)
//    → publishes post.content to the personal profile (always) and,
//      if LINKEDIN_ORGANIZATION_ID is configured, to the company page
//      too. Requires a prior one-time connect via /api/linkedin-token.
//    → on success (of at least one target) the post row is updated:
//      status='posted', posted_at=now().
//    → returns { results: [{ target, ok, urn|error }] } so the caller
//      can show exactly what happened per target.
//
//  See /api/linkedin-token.js for the one-time setup steps.
// ============================================================

const SUPABASE_URL       = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
const ALLOWED_EMAIL      = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';
const LINKEDIN_ORG_ID    = process.env.LINKEDIN_ORGANIZATION_ID || '';
// LinkedIn cuts a new API version every month (format YYYYMM) and only keeps
// each one active for ~12-24 months — an old hardcoded value WILL eventually
// start failing with "Requested version ... is not active". If that happens
// again, either bump the fallback below or set LINKEDIN_API_VERSION in Vercel
// without a redeploy. Current versions: https://learn.microsoft.com/en-us/linkedin/marketing/versioning
const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202601';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert', code: 'server_not_configured' });
  }

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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!body.id) return res.status(400).json({ error: 'id fehlt' });

  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // ── Load the post ──
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}&select=*`, { headers: sbHeaders });
    if (!postRes.ok) throw new Error('Post konnte nicht geladen werden');
    const post = (await postRes.json())[0];
    if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
    if (!post.content || !post.content.trim()) return res.status(400).json({ error: 'Post hat keinen Text' });

    // ── Load the stored LinkedIn access token (mint/refresh via linkedin-token's own logic) ──
    const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens?id=eq.linkedin&select=token`, { headers: sbHeaders });
    const rawToken = tokenRes.ok ? (await tokenRes.json())[0]?.token : null;
    if (!rawToken) return res.status(409).json({ error: 'LinkedIn ist nicht verbunden', code: 'not_connected' });
    let stored;
    try { stored = JSON.parse(rawToken); } catch { stored = null; }
    if (!stored?.access_token) return res.status(409).json({ error: 'LinkedIn ist nicht verbunden', code: 'not_connected' });

    let accessToken = stored.access_token;
    if (stored.expires_at && Date.now() >= stored.expires_at - 60 * 1000) {
      // Ask /api/linkedin-token to refresh it (keeps the refresh logic in one place)
      const refreshRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/linkedin-token`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const refreshed = await refreshRes.json().catch(() => ({}));
      if (!refreshRes.ok) {
        return res.status(refreshRes.status).json(refreshed);
      }
      accessToken = refreshed.access_token;
    }

    // ── Build the list of publish targets ──
    const targets = [{ label: 'Profil', author: stored.person_urn }];
    if (LINKEDIN_ORG_ID) {
      targets.push({ label: 'Unternehmensseite', author: `urn:li:organization:${LINKEDIN_ORG_ID}` });
    }

    async function publishTo(author) {
      const r = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author,
          commentary: post.content,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        throw new Error(errBody.message || `LinkedIn ${r.status} ${r.statusText}`);
      }
      return r.headers.get('x-restli-id') || r.headers.get('x-linkedin-id') || null;
    }

    const results = [];
    for (const t of targets) {
      if (!t.author) {
        results.push({ target: t.label, ok: false, error: 'Kein Ziel-URN vorhanden' });
        continue;
      }
      try {
        const urn = await publishTo(t.author);
        results.push({ target: t.label, ok: true, urn });
      } catch (e) {
        results.push({ target: t.label, ok: false, error: e.message });
      }
    }

    const anyOk = results.some(r => r.ok);
    if (anyOk) {
      const patch = { status: 'posted' };
      if (!post.posted_at) patch.posted_at = new Date().toISOString();
      const firstUrn = results.find(r => r.ok && r.urn)?.urn;
      if (firstUrn) patch.linkedin_post_urn = firstUrn;
      let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!patchRes.ok && firstUrn) {
        // linkedin_post_urn column may not exist yet (migration not run) — retry without it
        delete patch.linkedin_post_urn;
        await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, {
          method: 'PATCH',
          headers: { ...sbHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        }).catch(() => {});
      }
    }

    return res.status(anyOk ? 200 : 502).json({ results });
  } catch (err) {
    console.error('linkedin-publish error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
