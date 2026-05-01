/**
 * api/availability.js — Vercel Serverless Function
 * GET /api/availability?timezone=<IANA>
 *
 * Returns available 30-minute booking slots for the next 30 days.
 *
 * Flow:
 *   1. Generate all theoretically possible slots from Jason's schedule.
 *   2. Call Claude (claude-sonnet-4-6) with tool calling to fetch busy times
 *      from Google Calendar.
 *   3. Filter out booked slots.
 *   4. Return clean JSON to the frontend.
 *
 * Token efficiency:
 *   - Prompt caching via system prompt (stable content, Claude caches automatically)
 *   - Single tool call round-trip — no multi-turn conversation
 *   - Structured JSON output only
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCalendarClient } from '../lib/google-auth.js';
import { generatePossibleSlots, filterAvailableSlots } from '../lib/slots.js';

const CALENDAR_ID = process.env.CALENDAR_ID || 'jasonmartinde@gmail.com';

// ─── Claude tool definition ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_calendar_busy_times',
    description:
      'Fetches the busy/blocked time periods from Google Calendar for a given date range. ' +
      'Returns an array of {start, end} UTC ISO strings representing when the calendar is occupied.',
    input_schema: {
      type: 'object',
      properties: {
        time_min: {
          type: 'string',
          description: 'Start of the query range as UTC ISO 8601 string (e.g. "2026-05-01T00:00:00Z")',
        },
        time_max: {
          type: 'string',
          description: 'End of the query range as UTC ISO 8601 string',
        },
      },
      required: ['time_min', 'time_max'],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(name, input) {
  if (name === 'get_calendar_busy_times') {
    try {
      const calendar = getCalendarClient();
      const resp = await calendar.freebusy.query({
        requestBody: {
          timeMin: input.time_min,
          timeMax: input.time_max,
          timeZone: 'UTC',
          items: [{ id: CALENDAR_ID }],
        },
      });
      const busy = resp.data?.calendars?.[CALENDAR_ID]?.busy ?? [];
      return JSON.stringify(busy);
    } catch (err) {
      console.error('[availability] Calendar freebusy error:', err.message);
      return JSON.stringify([]); // Fail open: show all slots if calendar is unavailable
    }
  }
  return JSON.stringify({ error: 'Unknown tool' });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS — allow the live site and local dev
  const origin = req.headers.origin || '';
  const allowed = [
    process.env.FRONTEND_ORIGIN || 'https://martinjason.com',
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
    // 1. Generate all possible slots
    const possible = generatePossibleSlots(new Date());
    if (possible.length === 0) {
      return res.status(200).json({ slots: [], timezone_host: 'Asia/Makassar' });
    }

    const timeMin = possible[0].start;
    const timeMax = possible[possible.length - 1].end;

    // 2. Use Claude with tool calling to fetch busy times
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      {
        role: 'user',
        content:
          `Please fetch the Google Calendar busy times from ${timeMin} to ${timeMax} ` +
          `using the get_calendar_busy_times tool, then return ONLY the raw JSON result.`,
      },
    ];

    let busyTimes = [];

    // Agentic loop (max 3 iterations to guard against runaway)
    for (let i = 0; i < 3; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system:
          'You are a scheduling assistant. Your only job is to call the provided tool to ' +
          'retrieve Google Calendar busy periods, then output the raw JSON array of busy slots. ' +
          'Do not add any explanation or commentary.',
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'tool_use') {
        const toolUseBlock = response.content.find(b => b.type === 'tool_use');
        if (!toolUseBlock) break;

        const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input);

        // Try to parse the result as busy times now (avoid a second Claude round-trip)
        try {
          busyTimes = JSON.parse(toolResult);
        } catch (_) { /* will use empty array */ }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: toolResult,
            },
          ],
        });
        // We have the data — no need for another Claude turn
        break;
      }

      // Claude finished without tool use — try to parse its text response
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        if (textBlock) {
          const m = textBlock.text.match(/\[[\s\S]*\]/);
          if (m) {
            try { busyTimes = JSON.parse(m[0]); } catch (_) { /* ignore */ }
          }
        }
        break;
      }
    }

    // 3. Filter slots against busy times
    const available = filterAvailableSlots(possible, busyTimes);

    return res.status(200).json({
      slots: available,
      timezone_host: 'Asia/Makassar',
    });

  } catch (err) {
    console.error('[availability] Unhandled error:', err);
    return res.status(500).json({ error: 'Failed to fetch availability. Please try again.' });
  }
}
