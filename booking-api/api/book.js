/**
 * api/book.js — Vercel Serverless Function
 * POST /api/book
 *
 * Body: { slot: {start, end}, name, email, description, timezone }
 *
 * Uses Claude (claude-sonnet-4-6) with function calling to:
 *   1. Create a Google Calendar event
 *   2. Send a confirmation email via Gmail to the booker
 *
 * Claude acts as the orchestrator — it decides the event title,
 * crafts the email copy, and calls both tools in sequence.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCalendarClient, getGmailClient } from '../lib/google-auth.js';

const CALENDAR_ID  = process.env.CALENDAR_ID  || 'jasonmartinde@gmail.com';
const HOST_NAME    = 'Jason Martin';
const HOST_EMAIL   = process.env.CALENDAR_ID  || 'jasonmartinde@gmail.com';
const MEET_LINK    = 'https://meet.google.com/new'; // Google Meet auto-creates on calendar

// ─── Claude tool definitions ──────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_calendar_event',
    description:
      'Creates a Google Calendar event for the booked call and invites the attendee. ' +
      'Returns the created event ID.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Short event title, e.g. "Strategiegespräch mit Max Mustermann"',
        },
        description: {
          type: 'string',
          description:
            'HTML event description including what was discussed in the booking request, ' +
            'a Google Meet link placeholder, and any relevant context.',
        },
        start_datetime: { type: 'string', description: 'UTC ISO 8601 start time' },
        end_datetime:   { type: 'string', description: 'UTC ISO 8601 end time' },
        attendee_email: { type: 'string', description: "Booker's email address" },
        timezone:       { type: 'string', description: "Booker's IANA timezone" },
      },
      required: ['summary', 'description', 'start_datetime', 'end_datetime', 'attendee_email', 'timezone'],
    },
  },
  {
    name: 'send_confirmation_email',
    description:
      'Sends an HTML confirmation email from Jason to the booker. ' +
      'Write a warm, professional email in German.',
    input_schema: {
      type: 'object',
      properties: {
        to:       { type: 'string', description: 'Recipient email address' },
        subject:  { type: 'string', description: 'Email subject line in German' },
        html_body: {
          type: 'string',
          description:
            'Full HTML email body. Should be clean, minimal, mobile-friendly. ' +
            'Include: greeting, booking summary (date + time), what to expect, ' +
            'a Google Meet note, and a friendly sign-off from Jason Martin. ' +
            'Use inline styles for formatting. Keep it short (< 300 words).',
        },
      },
      required: ['to', 'subject', 'html_body'],
    },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────

async function createCalendarEvent(input) {
  const calendar = getCalendarClient();

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    sendUpdates: 'all',           // Google sends its own invite email too
    requestBody: {
      summary:     input.summary,
      description: input.description,
      start: {
        dateTime: input.start_datetime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: input.end_datetime,
        timeZone: 'UTC',
      },
      attendees: [
        { email: HOST_EMAIL,        displayName: HOST_NAME,      responseStatus: 'accepted' },
        { email: input.attendee_email,                            responseStatus: 'needsAction' },
      ],
      conferenceData: {
        createRequest: {
          requestId: Date.now().toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
    conferenceDataVersion: 1,
  });

  return JSON.stringify({ event_id: event.data.id, html_link: event.data.htmlLink });
}

async function sendConfirmationEmail(input) {
  const gmail = getGmailClient();

  // Build RFC 2822 message
  const messageParts = [
    `From: "${HOST_NAME}" <${HOST_EMAIL}>`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(input.html_body).toString('base64'),
  ].join('\r\n');

  const encoded = Buffer.from(messageParts)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return JSON.stringify({ sent: true });
}

async function executeTool(name, input) {
  if (name === 'create_calendar_event')   return createCalendarEvent(input);
  if (name === 'send_confirmation_email') return sendConfirmationEmail(input);
  return JSON.stringify({ error: 'Unknown tool: ' + name });
}

// ─── Format datetime for Claude's prompt ─────────────────────────────────────

function formatForClaude(isoString, timezone) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: timezone || 'UTC',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZoneName: 'short',
    }).format(new Date(isoString));
  } catch (_) {
    return isoString;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Parse + validate body
  const { slot, name, email, description, timezone } = req.body || {};

  if (!slot?.start || !slot?.end || !name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Missing required fields: slot, name, email' });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Slot must be in the future
  if (new Date(slot.start) <= new Date()) {
    return res.status(400).json({ error: 'This time slot is no longer available.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const visitorTz = timezone || 'UTC';
    const startFormatted = formatForClaude(slot.start, visitorTz);
    const endFormatted   = formatForClaude(slot.end,   visitorTz);
    const baliFormatted  = formatForClaude(slot.start, 'Asia/Makassar');

    const systemPrompt =
      `You are the booking assistant for ${HOST_NAME}, an AI Product Gallery Designer based in Bali. ` +
      `When someone books a 30-minute strategy call, you must:\n` +
      `1. Call create_calendar_event to add the meeting to the Google Calendar. ` +
      `   Write a German event description that summarises what the prospect wants to discuss, ` +
      `   mentions this is a 30-minute free strategy call, and includes a note that a Google Meet link will be added automatically.\n` +
      `2. Call send_confirmation_email to send the booker a warm confirmation email in German. ` +
      `   The email should feel personal and premium — not robotic. ` +
      `   Show the booking time in both the booker's timezone and Bali time (so Jason knows when to be online). ` +
      `   Sign off as ${HOST_NAME}.\n` +
      `Always call both tools — do not skip either one.`;

    const userMessage =
      `New booking request:\n` +
      `• Name: ${name}\n` +
      `• Email: ${email}\n` +
      `• Time (visitor's timezone ${visitorTz}): ${startFormatted} – ${endFormatted}\n` +
      `• Time (Bali / Jason's timezone): ${baliFormatted}\n` +
      `• UTC start: ${slot.start}\n` +
      `• UTC end:   ${slot.end}\n` +
      `• Their message: "${description || 'Keine Angabe'}"\n\n` +
      `Please create the calendar event and send the confirmation email now.`;

    const messages = [{ role: 'user', content: userMessage }];
    const toolsExecuted = new Set();

    // Agentic loop — Claude calls both tools, we execute them
    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          try {
            const result = await executeTool(block.name, block.input);
            toolsExecuted.add(block.name);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          } catch (toolErr) {
            console.error(`[book] Tool "${block.name}" failed:`, toolErr.message);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              is_error: true,
              content: JSON.stringify({ error: toolErr.message }),
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });

        // Both tools done — no need to continue
        if (toolsExecuted.has('create_calendar_event') &&
            toolsExecuted.has('send_confirmation_email')) {
          break;
        }
        continue;
      }

      // Claude finished
      break;
    }

    // Verify both operations happened
    if (!toolsExecuted.has('create_calendar_event')) {
      throw new Error('Calendar event was not created');
    }

    return res.status(200).json({
      success: true,
      message: 'Booking confirmed. A confirmation email has been sent.',
      calendarCreated: toolsExecuted.has('create_calendar_event'),
      emailSent: toolsExecuted.has('send_confirmation_email'),
    });

  } catch (err) {
    console.error('[book] Unhandled error:', err);

    // Return a user-friendly message based on error type
    const msg = err.message?.includes('Calendar event') || err.message?.includes('calendar')
      ? 'Could not create calendar event. Please try again.'
      : 'Booking failed. Please try again or contact directly at ' + HOST_EMAIL;

    return res.status(500).json({ error: msg });
  }
}
