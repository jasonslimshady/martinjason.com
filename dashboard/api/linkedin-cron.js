// ============================================================
//  /api/linkedin-cron — automatic publish at each post's scheduled_for
//
//  This is what makes "posting after a set time" actually work: without
//  this, nothing ever looked at scheduled_for — posts just sat as
//  "approved" forever until someone clicked the manual button.
//
//  Triggered by Vercel Cron (see vercel.json → "crons"). Vercel signs
//  cron requests with `Authorization: Bearer $CRON_SECRET`. CRON_SECRET
//  must be set in Vercel — without it this endpoint refuses to run at all
//  (fails closed), so it can never be triggered by anyone who just finds
//  the URL.
//
//  Each run:
//    1. finds posts with status='approved' and scheduled_for <= now()
//    2. publishes each one via the same logic as the manual button
//       (see api/_lib/linkedin.js), including media + first comment
//    3. on success: status='posted', posted_at=now(); if the post has a
//       recurring_rule, inserts the next occurrence as a new draft
//    4. on failure: leaves status untouched and records last_publish_error
//       so the dashboard can surface it, instead of retrying forever
//       silently
//
//  NOTE: Vercel's Hobby (free) plan only runs cron jobs once per day, so
//  vercel.json's own "crons" entry (0 3 * * *) is just a once-daily safety
//  net. Real scheduling precision comes from an external pinger — e.g. a
//  free cron-job.org job hitting this same URL every 5-15 minutes with
//  header "Authorization: Bearer <CRON_SECRET>". Both can run at once:
//  this endpoint is idempotent (a post only publishes once, since it's
//  no longer status='approved' after the first successful run).
// ============================================================

import { SUPABASE_URL, sbHeaders, publishToLinkedIn, nextOccurrence } from './_lib/linkedin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET nicht konfiguriert' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });

  const headers = sbHeaders(serviceKey);
  const nowIso = new Date().toISOString();

  try {
    const dueRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?status=eq.approved&scheduled_for=lte.${encodeURIComponent(nowIso)}&select=*&order=scheduled_for.asc&limit=20`,
      { headers },
    );
    if (!dueRes.ok) throw new Error('Fällige Posts konnten nicht geladen werden');
    const due = await dueRes.json();

    const outcomes = [];
    for (const post of due) {
      if (!post.content || !post.content.trim()) {
        outcomes.push({ id: post.id, ok: false, error: 'Post hat keinen Text' });
        continue;
      }

      // Claim the row atomically before publishing: only a request that still
      // finds status='approved' can flip it to 'publishing'. An overlapping
      // cron run (or a manual click racing this one) gets zero rows back and
      // skips — preventing the double-publish this replaces.
      const claimRes = await fetch(
        `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}&status=eq.approved`,
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ status: 'publishing' }) },
      );
      const claimed = claimRes.ok ? await claimRes.json().catch(() => []) : [];
      if (!claimed.length) {
        outcomes.push({ id: post.id, ok: false, error: 'Bereits von einem anderen Lauf beansprucht' });
        continue;
      }

      try {
        const results = await publishToLinkedIn(serviceKey, post);
        const anyOk = results.some(r => r.ok);
        if (anyOk) {
          const firstUrn = results.find(r => r.ok && r.urn)?.urn;
          const fcErrors = results.filter(r => r.firstCommentError).map(r => `${r.target}: ${r.firstCommentError}`).join(' | ');
          const patch = { status: 'posted', posted_at: post.posted_at || nowIso, last_publish_error: fcErrors || null };
          if (firstUrn) patch.linkedin_post_urn = firstUrn;
          let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify(patch),
          });
          if (!patchRes.ok) {
            delete patch.linkedin_post_urn;
            await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
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
          outcomes.push({ id: post.id, ok: true });
        } else {
          const errMsg = results.map(r => `${r.target}: ${r.error}`).join(' | ');
          await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
            method: 'PATCH',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'approved', last_publish_error: errMsg.slice(0, 500) }),
          }).catch(() => {});
          outcomes.push({ id: post.id, ok: false, error: errMsg });
        }
      } catch (e) {
        await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'approved', last_publish_error: String(e.message || e).slice(0, 500) }),
        }).catch(() => {});
        outcomes.push({ id: post.id, ok: false, error: e.message });
      }
    }

    return res.json({ checked: due.length, outcomes });
  } catch (err) {
    console.error('linkedin-cron error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
