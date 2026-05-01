/**
 * api/availability.js — Vercel Serverless Function
 * GET /api/availability?timezone=<IANA>
 *
 * Returns available 30-minute booking slots for the next 30 days.
 *
 * Flow (no Claude needed here — pure JS + Google Calendar):
 *   1. Generate all theoretically possible slots from Jason's schedule.
 *   2. Query Google Calendar freebusy API directly.
 *   3. Filter out busy slots in JS.
 *   4. Return clean JSON.
 *
 * Claude is only used in /api/book where it genuinely adds value
 * (crafting the calendar event description + confirmation email).
 */

import { getCalendarClient } from '../lib/google-auth.js';
import { generatePossibleSlots, filterAvailableSlots } from '../lib/slots.js';

const CALENDAR_ID = process.env.CALENDAR_ID || 'jasonmartinde@gmail.com';

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────────
  const origin = req.headers.origin || '';
  const allowed = [
    process.env.FRONTEND_ORIGIN || 'https://martinjason.com',
    'https://www.martinjason.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
  ];
  if (allowed.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Generate all theoretically possible slots (pure JS, no API calls)
    const possible = generatePossibleSlots(new Date());

    if (possible.length === 0) {
      return res.status(200).json({ slots: [], timezone_host: 'Asia/Makassar' });
    }

    const timeMin = possible[0].start;
    const timeMax = possible[possible.length - 1].end;

    // 2. Fetch busy periods directly from Google Calendar
    let busyTimes = [];
    try {
      const calendar = getCalendarClient();
      const resp = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          timeZone: 'UTC',
          items: [{ id: CALENDAR_ID }],
        },
      });
      busyTimes = resp.data?.calendars?.[CALENDAR_ID]?.busy ?? [];
      console.log(`[availability] Found ${busyTimes.length} busy periods`);
    } catch (calErr) {
      // Fail open — if calendar is unreachable, show all slots rather than
      // returning an error. Worst case: a double-booking is caught manually.
      console.error('[availability] Google Calendar error (showing all slots):', calErr.message);
    }

    // 3. Filter out any slot that overlaps a busy period
    const available = filterAvailableSlots(possible, busyTimes);
    console.log(`[availability] ${possible.length} possible → ${available.length} available`);

    return res.status(200).json({
      slots: available,
      timezone_host: 'Asia/Makassar',
    });

  } catch (err) {
    console.error('[availability] Unhandled error:', err);
    return res.status(500).json({ error: 'Failed to fetch availability. Please try again.' });
  }
}
