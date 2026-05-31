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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.KLAVIYO_PRIVATE_KEY;
  if (!key) return res.status(500).json({ error: 'KLAVIYO_PRIVATE_KEY not configured' });

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
    // Fetch lists, profiles total, campaign values, and metrics list in parallel
    const [listsResult, profilesResult, cvResult, metricsResult] = await Promise.allSettled([
      kGet('/api/lists/?fields[list]=name,created,profile_count&page[size]=100'),
      kGet('/api/profiles/?page[size]=1'),
      kPost('/api/campaign-values-reports/', {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: {
              start: `${s}T00:00:00+00:00`,
              end: `${e}T23:59:59+00:00`,
            },
            conversion_metric_id: null,
            filter: 'equals(send_channel,"email")',
          },
        },
      }),
      kGet('/api/metrics/?page[size]=200'),
    ]);

    const lists    = listsResult.status    === 'fulfilled' ? listsResult.value    : { data: [] };
    const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value : {};
    const cv       = cvResult.status       === 'fulfilled' ? cvResult.value       : { data: [] };
    const metrics  = metricsResult.status  === 'fulfilled' ? metricsResult.value  : { data: [] };

    // Find the "Subscribed to List" metric for sign-up time series
    const subMetric = (metrics.data || []).find(
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

    return res.json({ lists, profiles, campaignValues: cv, signups });
  } catch (err) {
    console.error('Klaviyo overview error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
