/**
 * api/book.js — Vercel Serverless Function
 * POST /api/book
 *
 * Body: { slot: {start, end}, name, email, description, timezone }
 *
 * No Claude / Anthropic API needed — everything is handled directly:
 *   1. Create Google Calendar event (with Google Meet link)
 *   2. Send HTML confirmation email via Gmail API
 */

import { getCalendarClient, getGmailClient } from '../lib/google-auth.js';

const CALENDAR_ID = process.env.CALENDAR_ID || 'jasonmartinde@gmail.com';
const HOST_NAME   = 'Jason Martin';
const HOST_EMAIL  = process.env.CALENDAR_ID || 'jasonmartinde@gmail.com';

// ── Meeting type → event title map ───────────────────────────────────────────

const MEETING_TITLES = {
  erstgespraech: 'Kostenloses Erstgespräch - Gespräch mit Martin, Jason',
  sprint:        'PDP Gallery Sprint - Gespräch mit Martin, Jason',
  launch:        'Product/Kollektion Launch System - Gespräch mit Martin, Jason',
  partner:       'Gallery Partner werden - Gespräch mit Martin, Jason',
};

function getEventTitle(meetingTypeId, fallbackName) {
  return MEETING_TITLES[meetingTypeId] || `Strategiegespräch mit ${fallbackName}`;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDateTime(isoString, timezone) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: timezone,
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(isoString));
  } catch (_) { return isoString; }
}

function fmtTime(isoString, timezone) {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: timezone,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(isoString));
  } catch (_) { return isoString; }
}

// ── Calendar event ────────────────────────────────────────────────────────────

async function createCalendarEvent({ slot, name, email, description, timezone, meetingTypeId }) {
  const calendar = getCalendarClient();
  const eventTitle = getEventTitle(meetingTypeId, name);

  const eventDescription =
    `30-Minuten ${eventTitle}\n\n` +
    (description ? `Thema: ${description}\n\n` : '') +
    `Gebuchte Zeit (Besucherzone ${timezone}):\n` +
    `${fmtDateTime(slot.start, timezone)} – ${fmtTime(slot.end, timezone)}\n\n` +
    `Gebuchte Zeit (Bali / Jason):\n` +
    `${fmtDateTime(slot.start, 'Asia/Makassar')} – ${fmtTime(slot.end, 'Asia/Makassar')}\n\n` +
    `Google Meet Link wird automatisch hinzugefügt.`;

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary:     eventTitle,
      description: eventDescription,
      start: { dateTime: slot.start, timeZone: 'UTC' },
      end:   { dateTime: slot.end,   timeZone: 'UTC' },
      attendees: [
        { email: HOST_EMAIL, displayName: HOST_NAME,  responseStatus: 'accepted' },
        { email,             displayName: name,        responseStatus: 'needsAction' },
      ],
      conferenceData: {
        createRequest: {
          requestId: `booking-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  return event.data;
}

// ── Confirmation email ────────────────────────────────────────────────────────

function buildEmailHtml({ name, slot, timezone, description }) {
  const dateStr     = fmtDateTime(slot.start, timezone);
  const timeEnd     = fmtTime(slot.end, timezone);
  const baliDateStr = fmtDateTime(slot.start, 'Asia/Makassar');

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F1;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;">
          <p style="margin:0;font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#0A84FF;">Jason Martin</p>
          <p style="margin:4px 0 0;font-size:13px;color:#8A8A92;">AI Product Gallery Designer</p>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#fff;border-radius:20px;border:1px solid rgba(10,10,10,0.08);padding:36px 32px;box-shadow:0 4px 24px rgba(10,10,10,0.06);">

          <!-- Check icon -->
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.18);display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
            <span style="font-size:22px;">✅</span>
          </div>

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#0A0A0A;">Termin bestätigt!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#54545A;line-height:1.55;">
            Hey ${name}, freut mich! Ich habe uns einen Termin eingetragen und du solltest gleich eine Kalendereinladung von Google erhalten.
          </p>

          <!-- Booking details box -->
          <div style="background:#F7F5F1;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#8A8A92;">Dein Termin</p>
            <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#0A0A0A;">${dateStr}</p>
            <p style="margin:0;font-size:13px;color:#54545A;">bis ${timeEnd} · Deine Zeitzone</p>
            ${timezone !== 'Asia/Makassar' ? `<p style="margin:6px 0 0;font-size:12px;color:#8A8A92;">Jason's Zeit (Bali): ${baliDateStr}</p>` : ''}
          </div>

          ${description ? `
          <div style="border-left:3px solid #0A84FF;padding:8px 16px;margin-bottom:24px;background:rgba(10,132,255,0.04);border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13px;color:#54545A;font-style:italic;">"${description}"</p>
          </div>` : ''}

          <!-- What to expect -->
          <div style="margin-bottom:24px;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0A0A0A;">Was dich erwartet</p>
            <p style="margin:0 0 6px;font-size:14px;color:#54545A;">📋 &nbsp;Wir schauen uns gemeinsam deine Produktseite an</p>
            <p style="margin:0 0 6px;font-size:14px;color:#54545A;">💡 &nbsp;Du nimmst 3 konkrete Verbesserungen mit</p>
            <p style="margin:0;font-size:14px;color:#54545A;">🎥 &nbsp;Wir treffen uns via Google Meet (Link kommt per Kalendereinladung)</p>
          </div>

          <p style="margin:0 0 4px;font-size:14px;color:#54545A;">Bis dahin,</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#0A0A0A;">Jason Martin</p>
          <p style="margin:2px 0 0;font-size:13px;color:#8A8A92;">martinjason.com</p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8A8A92;">
            Falls du den Termin verschieben möchtest, antworte einfach auf diese E-Mail.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendConfirmationEmail({ name, email, slot, timezone, description }) {
  const gmail   = getGmailClient();
  const subject = `Termin bestätigt: ${fmtDateTime(slot.start, timezone)}`;
  const html    = buildEmailHtml({ name, slot, timezone, description });

  const message = [
    `From: "${HOST_NAME}" <${HOST_EMAIL}>`,
    `To: "${name}" <${email}>`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
  ].join('\r\n');

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { slot, name, email, description, timezone, meetingType } = req.body || {};

  // Validate
  if (!slot?.start || !slot?.end || !name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Missing required fields: slot, name, email' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (new Date(slot.start) <= new Date()) {
    return res.status(400).json({ error: 'This time slot is no longer available.' });
  }

  const tz = timezone || 'UTC';

  try {
    // 1. Create calendar event
    await createCalendarEvent({ slot, name, email, description: description?.trim() || '', timezone: tz, meetingTypeId: meetingType });
    console.log(`[book] Calendar event created for ${email} at ${slot.start}`);

    // 2. Send confirmation email (non-fatal if it fails)
    try {
      await sendConfirmationEmail({ name, email, slot, timezone: tz, description: description?.trim() || '' });
      console.log(`[book] Confirmation email sent to ${email}`);
    } catch (emailErr) {
      console.error('[book] Email send failed (booking still confirmed):', emailErr.message);
    }

    return res.status(200).json({ success: true, message: 'Booking confirmed.' });

  } catch (err) {
    console.error('[book] Error:', err.message);
    return res.status(500).json({
      error: 'Booking failed. Please try again or email ' + HOST_EMAIL + ' directly.',
    });
  }
}
