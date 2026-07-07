// ============================================================
//  /api/klaviyo — Klaviyo overview for the dashboard
//
//  Auth: requires a valid Supabase session JWT of the dashboard
//  owner (Authorization: Bearer …) — the endpoint is NOT public.
// ============================================================

const SUPABASE_URL      = process.env.SUPABASE_URL || 'https://blibykmyvkdtdvgzuwyr.supabase.co';
// The anon key is public by design (it is shipped in config.js) — here it is
// only used to validate the caller's session JWT against Supabase Auth.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsaWJ5a215dmtkdGR2Z3p1d3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDI4ODYsImV4cCI6MjA5MzQxODg4Nn0.9CeJ9wNUcA7_3CXWXZ2rEZZMkbEYmBSQVvvv5ycNINA';
const ALLOWED_EMAIL     = process.env.DASHBOARD_ALLOWED_EMAIL || 'jasonmartinph@gmail.com';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.KLAVIYO_PRIVATE_KEY;
  if (!key) return res.status(500).json({ error: 'KLAVIYO_PRIVATE_KEY not configured' });

  // ── Auth: only the logged-in dashboard owner may read this ──
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing Authorization header' });
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Ungültige Sitzung' });
  const user = await userRes.json().catch(() => ({}));
  if (ALLOWED_EMAIL && (user.email || '').toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  const BASE = 'https://a.klaviyo.com';
  const REV = '2024-10-15';
  const authHeaders = {
    'Authorization': `Klaviyo-API-Key ${key}`,
    'revision': REV,
    'Accept': 'application/json',
  };

  async function kGet(path) {
    const r = await fetch(`${BASE}${path}`, { headers: authHeaders });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.errors?.[0]?.detail || `Klaviyo ${r.status} ${r.statusText}`);
    }
    return r.json();
  }

  async function kPost(path, body) {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      throw new Error(b.errors?.[0]?.detail || `Klaviyo ${r.status} ${r.statusText}`);
    }
    return r.json();
  }

  const { resource, start, end } = req.query;

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  const s = start || defaultStart;
  const e = end || todayStr;

  if (resource !== 'overview') {
    return res.status(400).json({ error: `Unknown resource: ${resource}` });
  }

  try {
    // Fetch lists, profiles total and the metrics catalog in parallel
    const [listsResult, profilesResult, metricsResult] = await Promise.allSettled([
      kGet('/api/lists/?fields[list]=name,created,profile_count&page[size]=100'),
      kGet('/api/profiles/?page[size]=1'),
      kGet('/api/metrics/?page[size]=200'),
    ]);

    const lists    = listsResult.status    === 'fulfilled' ? listsResult.value    : { data: [] };
    const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value : {};
    const metrics  = metricsResult.status  === 'fulfilled' ? metricsResult.value  : { data: [] };
    const metricList = metrics.data || [];

    // ── Campaign performance ──
    // campaign-values reports REQUIRE a conversion_metric_id and a
    // statistics list; the response groups results by campaign_id, so
    // campaign names/send times are joined in from the campaigns endpoint.
    // Everything is normalized to the flat shape the dashboard renders.
    const conversionMetric =
      metricList.find(m => m.attributes?.name === 'Placed Order') || metricList[0] || null;

    let campaignValues = { data: [] };
    if (conversionMetric?.id) {
      try {
        const [report, campaigns] = await Promise.all([
          kPost('/api/campaign-values-reports/', {
            data: {
              type: 'campaign-values-report',
              attributes: {
                timeframe: {
                  start: `${s}T00:00:00+00:00`,
                  end: `${e}T23:59:59+00:00`,
                },
                conversion_metric_id: conversionMetric.id,
                statistics: ['recipients', 'opens_unique', 'open_rate', 'clicks_unique', 'click_rate', 'unsubscribes'],
                filter: 'equals(send_channel,"email")',
              },
            },
          }),
          kGet(`/api/campaigns/?filter=${encodeURIComponent('equals(messages.channel,"email")')}&fields[campaign]=name,send_time&sort=-created_at&page[size]=100`)
            .catch(() => ({ data: [] })),
        ]);
        const nameMap = {};
        (campaigns.data || []).forEach(c => {
          nameMap[c.id] = { name: c.attributes?.name, send_time: c.attributes?.send_time };
        });
        campaignValues = {
          data: (report?.data?.attributes?.results || []).map(r => {
            const id = r.groupings?.campaign_id;
            const st = r.statistics || {};
            return {
              id,
              attributes: {
                campaign_name: nameMap[id]?.name || id || '—',
                send_time:     nameMap[id]?.send_time || null,
                recipients:    st.recipients    || 0,
                unique_opens:  st.opens_unique  || 0,
                open_rate:     st.open_rate     || 0,
                unique_clicks: st.clicks_unique || 0,
                click_rate:    st.click_rate    || 0,
                unsubscribes:  st.unsubscribes  || 0,
              },
            };
          }),
        };
      } catch (err) {
        console.warn('Klaviyo campaign values error:', err.message);
      }
    }

    // ── Sign-up time series ("Subscribed to List" metric) ──
    const subMetric = metricList.find(
      m => m.attributes?.name === 'Subscribed to List' ||
           m.attributes?.name?.toLowerCase().includes('subscribed')
    );

    let signups = null;
    if (subMetric?.id) {
      signups = await kPost('/api/metric-aggregates/', {
        data: {
          type: 'metric-aggregate',
          attributes: {
            metric_id: subMetric.id,
            measurements: ['count'],
            interval: 'day',
            filter: [
              `greater-or-equal(datetime,${s}T00:00:00+00:00)`,
              `less-than(datetime,${e}T23:59:59+00:00)`,
            ],
            sort: 'asc',
          },
        },
      }).catch(() => null);
    }

    return res.json({ lists, profiles, campaignValues, signups });
  } catch (err) {
    console.error('Klaviyo overview error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
