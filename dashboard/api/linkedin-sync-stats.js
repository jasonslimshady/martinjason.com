// ============================================================
//  /api/linkedin-sync-stats — pull per-post analytics from LinkedIn
//
//  This is what fills the "LinkedIn → Statistiken" tab. Without it the
//  analytics columns on the posts table stay NULL forever and every post
//  shows "Noch keine Daten".
//
//  For each published post that has a stored LinkedIn URN it fetches the
//  metrics LinkedIn actually exposes (reactions + comments always; and for
//  company-page posts also impressions, reach, link-clicks, reshares — see
//  api/_lib/linkedin.js → syncPostStats) and writes them back onto the row,
//  stamping analytics_synced_at.
//
//  Two ways to call it:
//    • POST (owner Supabase JWT)          → manual "Statistiken synchronisieren"
//                                            button in the dashboard.
//    • GET/POST Authorization: Bearer <CRON_SECRET>
//                                          → Vercel Cron / external pinger,
//                                            same secret as /api/linkedin-cron.
//
//  Only posts published in the last SYNC_WINDOW_DAYS (default 120) are
//  refreshed, newest first, so a long history doesn't blow the request
//  budget — engagement on old posts has long since plateaued anyway.
// ============================================================

import { SUPABASE_URL, sbHeaders, syncPostStats } from './_lib/linkedin.js';

const ALLOWED_EMAIL = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';
const SYNC_WINDOW_DAYS = Number(process.env.LINKEDIN_SYNC_WINDOW_DAYS || 120);
const MAX_POSTS = 60; // hard cap per run

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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert', code: 'server_not_configured' });
  }

  // Auth: either the Vercel/pinger cron secret, or the logged-in owner's JWT.
  const auth = req.headers.authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && bearer === cronSecret;

  if (!isCron) {
    if (!bearer) return res.status(401).json({ error: 'Missing Authorization header' });
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${bearer}` },
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Ungültige Sitzung' });
    const authUser = await userRes.json().catch(() => ({}));
    if (ALLOWED_EMAIL && (authUser.email || '').toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: 'Kein Zugriff' });
    }
  }

  const headers = sbHeaders(serviceKey);
  const sinceIso = new Date(Date.now() - SYNC_WINDOW_DAYS * 86400000).toISOString();

  try {
    // Published posts with a stored LinkedIn URN, newest first.
    const q = `${SUPABASE_URL}/rest/v1/posts`
      + `?status=eq.posted`
      + `&posted_at=gte.${encodeURIComponent(sinceIso)}`
      + `&or=(linkedin_post_urn.not.is.null,linkedin_org_post_urn.not.is.null)`
      + `&select=id,posted_at,linkedin_post_urn,linkedin_org_post_urn`
      + `&order=posted_at.desc&limit=${MAX_POSTS}`;
    const listRes = await fetch(q, { headers });
    if (!listRes.ok) throw new Error('Posts konnten nicht geladen werden: ' + (await listRes.text()));
    const posts = await listRes.json();

    let updated = 0, failed = 0;
    const outcomes = [];
    for (const post of posts) {
      try {
        const { metrics, errors } = await syncPostStats(serviceKey, post);
        const hasData = Object.keys(metrics).length > 0;
        if (!hasData) {
          failed++;
          outcomes.push({ id: post.id, ok: false, error: errors.join(' | ') || 'Keine Daten' });
          continue;
        }
        const patch = { ...metrics, analytics_synced_at: new Date().toISOString() };
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        });
        if (!patchRes.ok) throw new Error('Speichern fehlgeschlagen: ' + (await patchRes.text()));
        updated++;
        outcomes.push({ id: post.id, ok: true, metrics, partialErrors: errors.length ? errors : undefined });
      } catch (e) {
        failed++;
        if (e.code === 'not_connected' || e.code === 'reauth_required') {
          return res.status(409).json({ error: e.message, code: e.code });
        }
        outcomes.push({ id: post.id, ok: false, error: e.message });
      }
    }

    return res.json({ checked: posts.length, updated, failed, outcomes });
  } catch (err) {
    console.error('linkedin-sync-stats error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
