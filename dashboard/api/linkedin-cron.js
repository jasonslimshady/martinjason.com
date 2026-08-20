// ============================================================
//  /api/linkedin-cron — automatic publish at each post's scheduled_for
//
//  This is what makes "posting after a set time" actually work: without
//  this, nothing ever looked at scheduled_for — posts just sat as
//  "approved" forever until someone clicked the manual button.
//
//  Triggered by Vercel Cron (see vercel.json → "crons"). Vercel signs
//  cron requests with `Authorization: Bearer $CRON_SECRET` when the
//  CRON_SECRET env var is set — set one in Vercel and this endpoint will
//  require it. Without CRON_SECRET configured it still runs (Vercel Cron
//  requests only ever originate from Vercel's own infrastructure), but
//  setting it is recommended so the endpoint can't be triggered by anyone
//  who finds the URL.
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
//  NOTE: Vercel's Hobby plan only runs cron jobs once per day; scheduled
//  posts will publish up to ~24h late on that plan. Pro plan allows
//  per-minute schedules — adjust vercel.json → crons[].schedule to match
//  whatever plan this project is on.
// ============================================================

import { SUPABASE_URL, sbHeaders, publishToLinkedIn, nextOccurrence } from './_lib/linkedin.js';

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nicht konfiguriert' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  }

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
      try {
        const results = await publishToLinkedIn(serviceKey, post);
        const anyOk = results.some(r => r.ok);
        if (anyOk) {
          const firstUrn = results.find(r => r.ok && r.urn)?.urn;
          const patch = { status: 'posted', posted_at: post.posted_at || nowIso, last_publish_error: null };
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
            body: JSON.stringify({ last_publish_error: errMsg.slice(0, 500) }),
          }).catch(() => {});
          outcomes.push({ id: post.id, ok: false, error: errMsg });
        }
      } catch (e) {
        await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(post.id)}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ last_publish_error: String(e.message || e).slice(0, 500) }),
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
