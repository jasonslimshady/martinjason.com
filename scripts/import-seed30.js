// ============================================================
//  scripts/import-seed30.js
//
//  Imports the 30 pre-written seed posts (LinkedIn_Seed_30_Posts.md)
//  into the dashboard's `posts` table as drafts, on a fixed 15-workday
//  schedule. See LinkedIn_Content_System_v1.md for the rules this
//  schedule and content were derived from (read-only reference, not
//  parsed by this script).
//
//  Usage:
//    SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-seed30.js [--start=YYYY-MM-DD] [--source=/path/to/LinkedIn_Seed_30_Posts.md]
//
//  --start   Overrides the default start date (the next Monday after
//            today). Must itself be a Monday, or the script aborts.
//  --source  Overrides the default source markdown path.
//
//  Every post is written with status='draft', media=[], recurring_rule=
//  NULL — this script never makes anything postable. It upserts on
//  seed_ref (see posts_seed_ref_uidx): a post already at a status other
//  than 'draft' (approved/posted/rejected by Jason) is left untouched
//  and reported as skipped, so re-running never clobbers a reviewed post.
// ============================================================

const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
const TIME_ZONE = 'Europe/Berlin';

const DEFAULT_SOURCE =
  process.env.HOME +
  '/Library/Mobile Documents/com~apple~CloudDocs/🦅 Pacific Origins LLC/Business - Martin, Jason/Business - Martin, Jason/03_LinkedIn/02_Content-Planung/LinkedIn_Seed_30_Posts.md';

// Category prefix -> posts.category enum value (see posts_category_check).
const PREFIX_TO_CATEGORY = { P: 'persoenlich', V: 'value', B: 'portfolio', T: 'these', M: 'markt' };

// Fixed day -> [Slot A 08:30, Slot B 17:00] seed_ref assignment. Copied
// verbatim from the content plan — do not recompute or reorder.
const SCHEDULE = [
  ['V-01', 'P-01'],
  ['B-01', 'T-01'],
  ['M-01', 'P-02'],
  ['V-02', 'T-02'],
  ['B-02', 'M-03'],
  ['V-03', 'P-03'],
  ['B-03', 'T-03'],
  ['M-02', 'P-04'],
  ['V-04', 'T-04'],
  ['B-04', 'M-05'],
  ['V-05', 'P-05'],
  ['B-05', 'T-05'],
  ['M-04', 'P-06'],
  ['V-06', 'T-06'],
  ['B-06', 'M-06'],
];

function sbHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

// Converts a Europe/Berlin wall-clock time to the correct UTC instant for
// that specific date, honoring whatever DST offset applies that day —
// never a hardcoded +01:00/+02:00.
function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(naiveUTC)).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = asUTC - naiveUTC;
  return new Date(naiveUTC - offsetMs);
}

function nextMondayAfter(d) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  let diff = (8 - day) % 7;
  if (diff === 0) diff = 7;
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

function resolveStartDate(startArg) {
  if (!startArg) {
    const today = new Date();
    return nextMondayAfter(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
  }
  const m = startArg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`--start muss im Format YYYY-MM-DD sein, erhalten: "${startArg}"`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCDay() !== 1) {
    throw new Error(`--start=${startArg} ist kein Montag (Wochentag: ${d.getUTCDay()}). Abbruch.`);
  }
  return d;
}

// day index i is 0-based (0..14); business days = 3 unbroken Mon-Fri weeks
// starting at `startMonday`, so no weekend-walking logic is needed.
function dateForDayIndex(startMonday, i) {
  const week = Math.floor(i / 5);
  const weekday = i % 5;
  const d = new Date(startMonday);
  d.setUTCDate(d.getUTCDate() + week * 7 + weekday);
  return d;
}

// ── Source markdown parsing ─────────────────────────────────────────────
// Section shape:
//   ### P-01
//   **Medien:** <medien-text> · **Erst-Kommentar:** <kommentar-text>
//   > post text, possibly multiple > -prefixed lines/paragraphs
function isNoneValue(s, noneWord) {
  const cleaned = s.trim().toLowerCase().replace(/\.$/, '');
  return cleaned === noneWord || cleaned.startsWith(noneWord + ' ');
}

function parseSection(seedRef, rest) {
  const lines = rest.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const metaLine = lines[i] || '';
  i++;
  const metaMatch = metaLine.match(/\*\*Medien:\*\*\s*(.*?)\s*·\s*\*\*Erst-Kommentar:\*\*\s*(.*)$/);
  if (!metaMatch) {
    throw new Error(`${seedRef}: Medien/Erst-Kommentar-Zeile nicht gefunden (Zeile: "${metaLine}")`);
  }
  const [, mediaRaw, commentRaw] = metaMatch;

  // Skip blank lines and any editorial aside lines (e.g. a "*Alternativ-Motiv: …*"
  // note) between the meta line and the actual blockquote.
  while (i < lines.length && !lines[i].startsWith('>')) i++;
  const quoteLines = [];
  while (i < lines.length && lines[i].startsWith('>')) {
    quoteLines.push(lines[i].replace(/^>\s?/, ''));
    i++;
  }
  const content = quoteLines.join('\n').trim();
  if (!content) throw new Error(`${seedRef}: kein Post-Text (Blockquote) gefunden.`);

  return {
    seed_ref: seedRef,
    content,
    media_brief: isNoneValue(mediaRaw, 'keine') ? null : mediaRaw.trim(),
    first_comment: isNoneValue(commentRaw, 'keiner') ? null : commentRaw.trim(),
  };
}

function parseSeedPosts(raw) {
  const cutIdx = raw.search(/^##\s+Bildmaterial/m);
  const body = cutIdx === -1 ? raw : raw.slice(0, cutIdx);
  const sections = body.split(/^###\s+/m).slice(1);
  const posts = new Map();
  for (const section of sections) {
    const nl = section.indexOf('\n');
    const seedRef = (nl === -1 ? section : section.slice(0, nl)).trim();
    const rest = nl === -1 ? '' : section.slice(nl + 1);
    if (!seedRef) continue;
    const parsed = parseSection(seedRef, rest);
    posts.set(seedRef, parsed);
  }
  return posts;
}

// ── Supabase access ──────────────────────────────────────────────────────
async function fetchExistingBySeedRef(serviceKey, seedRef) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?seed_ref=eq.${encodeURIComponent(seedRef)}&select=id,status`,
    { headers: sbHeaders(serviceKey) },
  );
  if (!res.ok) throw new Error(`Lesen von ${seedRef} fehlgeschlagen: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function insertPost(serviceKey, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Insert ${body.seed_ref} fehlgeschlagen: ${res.status} ${await res.text()}`);
}

async function updatePost(serviceKey, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Update ${body.seed_ref} fehlgeschlagen: ${res.status} ${await res.text()}`);
}

async function verify(serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?experiment_batch=eq.seed30&select=id,seed_ref,category,status,recurring_rule,media,scheduled_for`,
    { headers: sbHeaders(serviceKey) },
  );
  if (!res.ok) throw new Error(`Verifikation fehlgeschlagen: ${res.status} ${await res.text()}`);
  const rows = await res.json();

  const byCategory = {};
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + 1;

  const nonDraft = rows.filter(r => r.status !== 'draft');
  const badRecurringOrMedia = rows.filter(
    r => r.recurring_rule !== null || !(Array.isArray(r.media) && r.media.length === 0),
  );
  const weekendHits = rows.filter(r => {
    if (!r.scheduled_for) return false;
    const dow = new Date(r.scheduled_for).getUTCDay();
    return dow === 0 || dow === 6;
  });

  const byDay = {};
  for (const r of rows) {
    if (!r.scheduled_for) continue;
    const key = new Date(r.scheduled_for).toISOString().slice(0, 10);
    (byDay[key] ||= []).push(r);
  }
  const dayIssues = Object.entries(byDay).filter(
    ([, posts]) => posts.length !== 2 || posts[0].category === posts[1].category,
  );

  console.log('\n--- Verifikation ---');
  console.log('Kategorie-Verteilung:', byCategory, '(erwartet: 6 je Kategorie, 30 gesamt)');
  console.log('Posts mit status <> draft:', nonDraft.length, nonDraft.map(r => r.seed_ref));
  console.log('Posts mit recurring_rule gesetzt oder media <> []:', badRecurringOrMedia.length, badRecurringOrMedia.map(r => r.seed_ref));
  console.log('Posts an Wochenend-Terminen:', weekendHits.length, weekendHits.map(r => r.seed_ref));
  console.log('Tage mit != 2 Posts oder gleicher Kategorie:', dayIssues.map(([day]) => day));
  console.log('Gesamtzahl seed30-Posts:', rows.length, '(erwartet: 30)');

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.');
    process.exit(1);
  }

  const sourcePath = args.source || DEFAULT_SOURCE;
  if (!fs.existsSync(sourcePath)) {
    console.error(`Quelldatei nicht gefunden: ${sourcePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = parseSeedPosts(raw);

  const usedRefs = new Set(SCHEDULE.flat());
  for (const ref of usedRefs) {
    if (!parsed.has(ref)) {
      console.error(`Im Terminplan referenzierter Post ${ref} fehlt in der Quelldatei.`);
      process.exit(1);
    }
  }

  let startMonday;
  try {
    startMonday = resolveStartDate(args.start);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const jobs = [];
  SCHEDULE.forEach(([slotARef, slotBRef], dayIdx) => {
    const date = dateForDayIndex(startMonday, dayIdx);
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate();
    jobs.push({ seedRef: slotARef, scheduledFor: zonedTimeToUtc(y, m, d, 8, 30, TIME_ZONE) });
    jobs.push({ seedRef: slotBRef, scheduledFor: zonedTimeToUtc(y, m, d, 17, 0, TIME_ZONE) });
  });

  const imported = [];
  const skipped = [];

  for (const job of jobs) {
    const post = parsed.get(job.seedRef);
    const prefix = job.seedRef.split('-')[0];
    const category = PREFIX_TO_CATEGORY[prefix];
    if (!category) throw new Error(`Unbekanntes Kategorie-Präfix für ${job.seedRef}`);

    const body = {
      content: post.content,
      status: 'draft',
      category,
      seed_ref: job.seedRef,
      experiment_batch: 'seed30',
      scheduled_for: job.scheduledFor.toISOString(),
      media: [],
      media_brief: post.media_brief,
      first_comment: post.first_comment,
      recurring_rule: null,
      recurring_parent_id: null,
    };

    const existing = await fetchExistingBySeedRef(serviceKey, job.seedRef);
    if (existing && existing.status !== 'draft') {
      skipped.push({ seed_ref: job.seedRef, status: existing.status });
      continue;
    }
    if (existing) {
      await updatePost(serviceKey, existing.id, body);
    } else {
      await insertPost(serviceKey, body);
    }
    imported.push(job.seedRef);
  }

  const lastDay = dateForDayIndex(startMonday, 14);

  console.log('\n--- Seed-30 Import ---');
  console.log(`Importiert: ${imported.length}/30`, imported);
  console.log(`Übersprungen (bereits freigegeben/gepostet/abgelehnt): ${skipped.length}`, skipped);
  console.log(`Startdatum: ${startMonday.toISOString().slice(0, 10)}`);
  console.log(`Letzter Postingtag: ${lastDay.toISOString().slice(0, 10)}`);

  await verify(serviceKey);

  console.log('\n--- Bekannte Blocker (nur Hinweis, nicht Teil dieses Imports) ---');
  console.log('- linkedin_oauth_tokens ist leer: Dashboard kann ohne durchlaufenen OAuth-Flow nicht posten.');
  console.log('- V-01..V-06 versprechen eine 10-Punkte-Checkliste als PDF ("GALERIE"-CTA) — Asset existiert noch nicht.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
