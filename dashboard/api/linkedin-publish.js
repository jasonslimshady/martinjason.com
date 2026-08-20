// ============================================================
//  /api/linkedin-publish — actually publish a post draft to LinkedIn
//
//  This is the piece that was missing: the dashboard's "Als gepostet
//  markieren" button used to only flip a status column in Supabase —
//  it never called LinkedIn. This endpoint makes the real API calls.
//
//  POST { id }  (id = row id in the "posts" table)
//    → publishes post.content (+ media + first_comment) to the personal
//      profile (always) and, if LINKEDIN_ORGANIZATION_ID is configured,
//      to the company page too. Requires a prior one-time connect via
//      /api/linkedin-token.
//    → on success (of at least one target) the post row is updated:
//      status='posted', posted_at=now(); if the post has a recurring_rule,
//      the next occurrence is inserted as a new draft row.
//    → returns { results: [{ target, ok, urn|error }] } so the caller
//      can show exactly what happened per target.
//
//  Manual trigger only — /api/linkedin-cron.js is what makes this happen
//  automatically at each post's scheduled_for time.
//  See /api/linkedin-token.js for the one-time setup steps.
// ============================================================

import { SUPABASE_URL, sbHeaders, publishToLinkedIn, nextOccurrence } from './_lib/linkedin.js';

const ALLOWED_EMAIL = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinde@gmail.com';

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

  const headers = sbHeaders(serviceKey);

  try {
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}&select=*`, { headers });
    if (!postRes.ok) throw new Error('Post konnte nicht geladen werden');
    const post = (await postRes.json())[0];
    if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });
    if (!post.content || !post.content.trim()) return res.status(400).json({ error: 'Post hat keinen Text' });

    let results;
    try {
      results = await publishToLinkedIn(serviceKey, post);
    } catch (e) {
      if (e.code === 'not_connected' || e.code === 'reauth_required') {
        return res.status(409).json({ error: e.message, code: e.code });
      }
      throw e;
    }

    const anyOk = results.some(r => r.ok);
    if (anyOk) {
      const patch = { status: 'posted' };
      if (!post.posted_at) patch.posted_at = new Date().toISOString();
      const firstUrn = results.find(r => r.ok && r.urn)?.urn;
      if (firstUrn) patch.linkedin_post_urn = firstUrn;
      let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!patchRes.ok && firstUrn) {
        delete patch.linkedin_post_urn;
        await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        }).catch(() => {});
      }

      if (post.recurring_rule && post.scheduled_for) {
        const next = nextOccurrence(post.scheduled_for, post.recurring_rule);
        if (next) {
          await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({
              content: post.content,
              media: post.media || [],
              first_comment: post.first_comment || null,
              scheduled_for: next,
              status: 'approved',
              recurring_rule: post.recurring_rule,
              recurring_parent_id: post.recurring_parent_id || post.id,
            }),
          }).catch(() => {});
        }
      }
    }

    return res.status(anyOk ? 200 : 502).json({ results });
  } catch (err) {
    console.error('linkedin-publish error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
