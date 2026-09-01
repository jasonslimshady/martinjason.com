// ============================================================
//  Shared LinkedIn publish logic — used by:
//    /api/linkedin-publish.js  (manual "Jetzt auf LinkedIn posten" button)
//    /api/linkedin-cron.js     (automatic publish at scheduled_for time)
//  Files under api/_lib/ are ignored by Vercel's routing (leading "_"),
//  so this is safe as a plain shared module, not a route.
// ============================================================

import { PDFDocument } from 'pdf-lib';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
export const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORGANIZATION_ID || '';
// LinkedIn cuts a new API version every month (format YYYYMM) and only keeps
// each one active for ~12-24 months — bump LINKEDIN_API_VERSION in Vercel if
// publishing starts failing with "Requested version ... is not active".
// https://learn.microsoft.com/en-us/linkedin/marketing/versioning
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202601';

export function sbHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

export async function loadStoredToken(serviceKey) {
  const q = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens?id=eq.linkedin&select=token`, { headers: sbHeaders(serviceKey) });
  if (!q.ok) return null;
  const raw = (await q.json())[0]?.token;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function storeToken(serviceKey, data) {
  const up = await fetch(`${SUPABASE_URL}/rest/v1/app_tokens`, {
    method: 'POST',
    headers: { ...sbHeaders(serviceKey), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 'linkedin', token: JSON.stringify(data), updated_at: new Date().toISOString() }),
  });
  if (!up.ok) throw new Error('LinkedIn-Token konnte nicht gespeichert werden');
}

async function linkedinTokenRequest(params) {
  const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
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

// Returns { access_token, person_urn } for a valid (refreshed-if-needed) token.
// Throws an error with .code = 'not_connected' | 'reauth_required' on failure.
export async function ensureFreshToken(serviceKey) {
  const stored = await loadStoredToken(serviceKey);
  if (!stored?.access_token) {
    const err = new Error('LinkedIn ist nicht verbunden');
    err.code = 'not_connected';
    throw err;
  }
  if (stored.expires_at && Date.now() < stored.expires_at - 5 * 60 * 1000) {
    return { access_token: stored.access_token, person_urn: stored.person_urn };
  }
  if (!stored.refresh_token) {
    const err = new Error('LinkedIn-Verbindung abgelaufen — bitte einmal neu verbinden');
    err.code = 'reauth_required';
    throw err;
  }
  try {
    const tokens = await linkedinTokenRequest({ grant_type: 'refresh_token', refresh_token: stored.refresh_token });
    const expires_at = Date.now() + (tokens.expires_in || 0) * 1000;
    await storeToken(serviceKey, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || stored.refresh_token,
      expires_at,
      person_urn: stored.person_urn,
    });
    return { access_token: tokens.access_token, person_urn: stored.person_urn };
  } catch (e) {
    if (e.linkedin === 'invalid_grant' || e.linkedin === 'invalid_request') {
      await fetch(`${SUPABASE_URL}/rest/v1/app_tokens?id=eq.linkedin`, { method: 'DELETE', headers: sbHeaders(serviceKey) }).catch(() => {});
      const err = new Error('LinkedIn-Verbindung abgelaufen — bitte einmal neu verbinden');
      err.code = 'reauth_required';
      throw err;
    }
    throw e;
  }
}

// ── Media assets: download the file from Supabase Storage, upload it to
// LinkedIn as an image/video asset, return the resulting asset URN. ──
async function downloadMediaBytes(serviceKey, path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/post-media/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) throw new Error(`Mediendatei konnte nicht geladen werden (${path})`);
  return Buffer.from(await r.arrayBuffer());
}

async function uploadImageAsset(accessToken, author, serviceKey, item) {
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  if (!initRes.ok) throw new Error('Bild-Upload (initialize) fehlgeschlagen: ' + (await initRes.text()));
  const init = (await initRes.json()).value;

  const bytes = await downloadMediaBytes(serviceKey, item.path);
  const putRes = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) throw new Error('Bild-Upload (PUT) fehlgeschlagen: ' + putRes.status);
  return init.image;
}

async function uploadVideoAsset(accessToken, author, serviceKey, item) {
  const bytes = await downloadMediaBytes(serviceKey, item.path);
  const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false } }),
  });
  if (!initRes.ok) throw new Error('Video-Upload (initialize) fehlgeschlagen: ' + (await initRes.text()));
  const init = (await initRes.json()).value;

  const uploadedPartIds = [];
  for (const instr of init.uploadInstructions) {
    const chunk = bytes.subarray(instr.firstByte, instr.lastByte + 1);
    const putRes = await fetch(instr.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: chunk });
    if (!putRes.ok) throw new Error('Video-Upload (Chunk) fehlgeschlagen: ' + putRes.status);
    uploadedPartIds.push(putRes.headers.get('etag'));
  }

  const finRes = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ finalizeUploadRequest: { video: init.video, uploadToken: init.uploadToken || '', uploadedPartIds } }),
  });
  if (!finRes.ok) throw new Error('Video-Upload (finalize) fehlgeschlagen: ' + (await finRes.text()));
  return init.video;
}

// Builds a PDF with one full-bleed page per image, in array order — this is
// LinkedIn's actual "carousel" mechanism: a Document post renders each PDF
// page as a swipeable slide. (LinkedIn has no dedicated multi-image-carousel
// object; `multiImage` instead renders as a static collage, which is not
// what "carousel" means to people who ask for one.) pdf-lib only embeds
// JPEG/PNG — any other image format fails loudly here rather than silently
// producing a broken document.
async function buildCarouselPdf(serviceKey, images) {
  const MAX_DIM = 2000; // keep the PDF a sane size; LinkedIn scales slides to fit anyway
  const pdf = await PDFDocument.create();
  for (const img of images) {
    const bytes = await downloadMediaBytes(serviceKey, img.path);
    let embedded;
    try {
      embedded = await pdf.embedJpg(bytes);
    } catch {
      try {
        embedded = await pdf.embedPng(bytes);
      } catch {
        throw new Error(`Bild "${img.name || img.path}" hat ein für Carousels nicht unterstütztes Format (nur JPG/PNG).`);
      }
    }
    const scale = Math.min(1, MAX_DIM / Math.max(embedded.width, embedded.height));
    const w = embedded.width * scale, h = embedded.height * scale;
    const page = pdf.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
  }
  return Buffer.from(await pdf.save());
}

// Documents API — same init/PUT upload shape as images/videos, but the
// asset is the PDF itself. Like the Comments API below, this is gated
// behind LinkedIn's Community Management API product; a 403 here usually
// means that product isn't approved on the app yet even though plain
// image/video posts work.
async function uploadDocumentAsset(accessToken, author, pdfBytes) {
  const initRes = await fetch('https://api.linkedin.com/rest/documents?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  if (!initRes.ok) throw new Error('Carousel-Upload (initialize) fehlgeschlagen: ' + (await initRes.text()));
  const init = (await initRes.json()).value;

  const putRes = await fetch(init.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/pdf' },
    body: pdfBytes,
  });
  if (!putRes.ok) throw new Error('Carousel-Upload (PUT) fehlgeschlagen: ' + putRes.status);
  return init.document;
}

// Builds the "content" field for the Posts API from post.media (array of
// {type:'image'|'video', path, name}). Only one media kind can be attached
// per LinkedIn post: a single video, a single image, or a carousel document —
// if a video is present it wins; otherwise every image is used (1 = single
// image, 2+ = carousel PDF, one image per slide, in upload/edit order).
async function buildContent(accessToken, author, serviceKey, media) {
  if (!media || !media.length) return null;
  const video = media.find(m => m.type === 'video');
  if (video) {
    const urn = await uploadVideoAsset(accessToken, author, serviceKey, video);
    return { media: { id: urn, title: video.name || 'Video' } };
  }
  const images = media.filter(m => m.type === 'image');
  if (!images.length) return null;
  if (images.length === 1) {
    const urn = await uploadImageAsset(accessToken, author, serviceKey, images[0]);
    return { media: { id: urn, title: images[0].name || 'Bild' } };
  }
  const pdfBytes = await buildCarouselPdf(serviceKey, images);
  const urn = await uploadDocumentAsset(accessToken, author, pdfBytes);
  return { media: { id: urn, title: images[0].name || 'Carousel' } };
}

// Publishes `post` (row from the "posts" table) to every configured target
// (profile always, + company page if LINKEDIN_ORGANIZATION_ID is set).
// Returns [{ target, ok, urn|error }]. Also posts the first comment (if
// post.first_comment is set) on every target that published successfully.
export async function publishToLinkedIn(serviceKey, post) {
  const { access_token, person_urn } = await ensureFreshToken(serviceKey);

  const targets = [{ label: 'Profil', author: person_urn }];
  if (LINKEDIN_ORG_ID) targets.push({ label: 'Unternehmensseite', author: `urn:li:organization:${LINKEDIN_ORG_ID}` });

  const results = [];
  for (const t of targets) {
    if (!t.author) { results.push({ target: t.label, ok: false, error: 'Kein Ziel-URN vorhanden' }); continue; }
    try {
      // Media assets must be uploaded with owner === post author, or LinkedIn
      // rejects the post — so each target uploads (and pays for) its own copy.
      const content = await buildContent(access_token, t.author, serviceKey, post.media);
      const body = {
        author: t.author,
        commentary: post.content,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };
      if (content) body.content = content;

      const r = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        throw new Error(errBody.message || `LinkedIn ${r.status} ${r.statusText}`);
      }
      const urn = r.headers.get('x-restli-id') || r.headers.get('x-linkedin-id') || null;

      let firstCommentError = null;
      if (urn && post.first_comment && post.first_comment.trim()) {
        try { await postFirstComment(access_token, t.author, urn, post.first_comment.trim()); }
        catch (e) {
          console.warn('linkedin first_comment failed:', e.message);
          firstCommentError = e.message;
        }
      }

      results.push({ target: t.label, ok: true, urn, firstCommentError });
    } catch (e) {
      results.push({ target: t.label, ok: false, error: e.message });
    }
  }
  return results;
}

// Comments API — technically part of LinkedIn's "Community Management API"
// product family (learn.microsoft.com/.../community-management/shares/comments-api),
// the same gated product that company-page posting needs. If this keeps
// failing with a 403/PERMISSION-type error even though the post itself
// published fine, the app most likely only has "Share on LinkedIn"
// approved and needs Community Management API review for commenting too.
async function postFirstComment(accessToken, actor, shareUrn, text) {
  const r = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ actor, object: shareUrn, message: { text } }),
  });
  if (!r.ok) {
    const bodyText = await r.text();
    throw new Error(`Erster Kommentar fehlgeschlagen (${r.status}): ${bodyText}`);
  }
}

// ============================================================
//  Comments — write a comment on any post (used by /api/linkedin-comment)
//
//  Part of the Community Management API. `as` decides who the comment is
//  authored by: 'member' (your personal profile, default) or 'organization'
//  (your company page — needs w_organization_social + LINKEDIN_ORGANIZATION_ID).
// ============================================================
export async function postComment(serviceKey, shareUrn, text, as = 'member') {
  const { access_token, person_urn } = await ensureFreshToken(serviceKey);
  let actor = person_urn;
  if (as === 'organization') {
    if (!LINKEDIN_ORG_ID) throw new Error('Kein LINKEDIN_ORGANIZATION_ID konfiguriert — als Unternehmensseite kommentieren ist nicht möglich.');
    actor = `urn:li:organization:${LINKEDIN_ORG_ID}`;
  }
  const r = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ actor, object: shareUrn, message: { text } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 403 here almost always means the Community Management API product isn't
    // approved (or the org scope wasn't granted on connect), not a bad request.
    throw new Error(data.message || `LinkedIn ${r.status} ${r.statusText}`);
  }
  return { id: r.headers.get('x-restli-id') || data.$URN || null, actor };
}

// ============================================================
//  Analytics sync — pull per-post metrics from LinkedIn
//
//  Two sources, each best-effort (a failure in one never blocks the other):
//    • socialActions/{urn}                    → reactions + comments counts.
//      Works for both personal and company posts.
//    • organizationalEntityShareStatistics    → impressions, unique reach,
//      link-clicks, reshares (+ authoritative reaction/comment totals).
//      Company-page posts only; needs the org scopes + LINKEDIN_ORGANIZATION_ID.
//
//  LinkedIn does not expose personal-profile impressions / profile-views /
//  followers-gained through the public API, so those columns stay NULL for
//  profile-only posts and the dashboard shows "Noch keine Daten" for them.
// ============================================================
const LI_ANALYTICS_HEADERS = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  'LinkedIn-Version': LINKEDIN_API_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
});

async function fetchSocialActionCounts(accessToken, shareUrn) {
  const r = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(shareUrn)}`, {
    headers: LI_ANALYTICS_HEADERS(accessToken),
  });
  if (!r.ok) throw new Error(`socialActions ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return {
    reactions: data.likesSummary?.aggregatedTotalLikes ?? data.likesSummary?.totalLikes ?? null,
    comments: data.commentsSummary?.aggregatedTotalComments ?? data.commentsSummary?.count ?? null,
  };
}

async function fetchOrgShareStatistics(accessToken, orgId, shareUrn) {
  const orgUrn = `urn:li:organization:${orgId}`;
  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity`
    + `&organizationalEntity=${encodeURIComponent(orgUrn)}`
    + `&shares=List(${encodeURIComponent(shareUrn)})`;
  const r = await fetch(url, { headers: LI_ANALYTICS_HEADERS(accessToken) });
  if (!r.ok) throw new Error(`organizationalEntityShareStatistics ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const t = data.elements?.[0]?.totalShareStatistics;
  if (!t) return {};
  return {
    impressions: t.impressionCount ?? null,
    members_reached: t.uniqueImpressionsCount ?? null,
    link_clicks: t.clickCount ?? null,
    reshares: t.shareCount ?? null,
    reactions: t.likeCount ?? null,
    comments: t.commentCount ?? null,
  };
}

// Returns the metric object to PATCH onto the post row (only keys with a real
// value are returned; callers should merge and always set analytics_synced_at).
// Throws only if NOTHING at all could be fetched, so a fully-failed sync is
// visible instead of silently marking the post "synced" with no data.
export async function syncPostStats(serviceKey, post) {
  const memberUrn = post.linkedin_post_urn;
  const orgUrn = post.linkedin_org_post_urn;
  if (!memberUrn && !orgUrn) {
    const err = new Error('Kein LinkedIn-URN gespeichert — dieser Post wurde nicht über das Dashboard veröffentlicht.');
    err.code = 'no_urn';
    return { metrics: {}, errors: [err.message] };
  }
  const { access_token } = await ensureFreshToken(serviceKey);

  const metrics = {};
  const errors = [];

  // socialActions on whichever urn we have (member preferred — it's the one
  // the personal Statistiken view is about).
  const socialUrn = memberUrn || orgUrn;
  try {
    const counts = await fetchSocialActionCounts(access_token, socialUrn);
    if (counts.reactions != null) metrics.reactions = counts.reactions;
    if (counts.comments != null) metrics.comments = counts.comments;
  } catch (e) { errors.push(e.message); }

  // Company-page analytics (impressions/reach/clicks/reshares) — only if we
  // actually posted to the org and an org id is configured.
  if (orgUrn && LINKEDIN_ORG_ID) {
    try {
      const org = await fetchOrgShareStatistics(access_token, LINKEDIN_ORG_ID, orgUrn);
      for (const [k, v] of Object.entries(org)) if (v != null) metrics[k] = v;
    } catch (e) { errors.push(e.message); }
  }

  return { metrics, errors };
}

// ── Recurring posts: compute the next occurrence's scheduled_for from a
// rule {freq:'daily'|'weekly'|'monthly', interval, weekdays:[0-6 Mon-Sun], until} ──
export function nextOccurrence(scheduledFor, rule) {
  if (!rule || !rule.freq) return null;
  const d = new Date(scheduledFor);
  const interval = Math.max(1, rule.interval || 1);

  if (rule.freq === 'daily') {
    d.setDate(d.getDate() + interval);
  } else if (rule.freq === 'weekly') {
    const days = (rule.weekdays && rule.weekdays.length) ? [...rule.weekdays].sort((a, b) => a - b) : [(d.getDay() + 6) % 7];
    const curDow = (d.getDay() + 6) % 7; // Monday=0
    const next = days.find(w => w > curDow);
    if (next != null) {
      d.setDate(d.getDate() + (next - curDow));
    } else {
      d.setDate(d.getDate() + (7 * interval - curDow + days[0]));
    }
  } else if (rule.freq === 'monthly') {
    d.setMonth(d.getMonth() + interval);
  } else {
    return null;
  }

  if (rule.until && d.getTime() > new Date(rule.until + 'T23:59:59').getTime()) return null;
  return d.toISOString();
}
