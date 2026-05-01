/**
 * lib/google-auth.js
 * Returns an authenticated Google OAuth2 client using the stored refresh token.
 */

import { google } from 'googleapis';

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob' // redirect URI used during token generation
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}

export function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getOAuthClient() });
}

export function getGmailClient() {
  return google.gmail({ version: 'v1', auth: getOAuthClient() });
}
