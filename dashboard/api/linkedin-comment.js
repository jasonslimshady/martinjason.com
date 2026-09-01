// ============================================================
//  /api/linkedin-comment — write a comment on a LinkedIn post
//
//  Part of the Community Management API (approved product). Lets the
//  dashboard owner comment on one of their published posts straight from
//  the Statistiken tab, without leaving for linkedin.com.
//
//  POST { urn, text, as? }
//    urn  — the post's share URN (urn:li:share:… or urn:li:ugcPost:…)
//    text — comment body (1–1250 chars)
//    as   — 'member' (default, your personal profile) | 'organization'
//           (your company page; needs w_organization_social + the
//            LINKEDIN_ORGANIZATION_ID env var)
//
//  Requires a valid Supabase session JWT for the dashboard owner, and a
//  prior one-time LinkedIn connect (see /api/linkedin-token.js). A 403
//  from LinkedIn here usually means the org scope wasn't granted on
//  connect, or the Community Management API product isn't approved yet.
// ============================================================

import { SUPABASE_URL, postComment } from './_lib/linkedin.js';

const ALLOWED_EMAIL = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';
const MAX_LEN = 1250; // LinkedIn's per-comment character limit

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
  const urn = (body.urn || '').trim();
  const text = (body.text || '').trim();
  const as = body.as === 'organization' ? 'organization' : 'member';
  if (!urn) return res.status(400).json({ error: 'urn fehlt' });
  if (!urn.startsWith('urn:li:')) return res.status(400).json({ error: 'Ungültiger Post-URN' });
  if (!text) return res.status(400).json({ error: 'Kommentartext fehlt' });
  if (text.length > MAX_LEN) return res.status(400).json({ error: `Kommentar ist zu lang (max. ${MAX_LEN} Zeichen).` });

  try {
    const result = await postComment(serviceKey, urn, text, as);
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.code === 'not_connected' || err.code === 'reauth_required') {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    console.error('linkedin-comment error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
