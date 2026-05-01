#!/usr/bin/env node
/**
 * get-token.js (v3 — web redirect flow)
 *
 * Uses https://martinjason.com as the redirect URI, which matches
 * the Web App OAuth client already configured in Google Cloud Console.
 *
 * How it works:
 *   1. Script prints an authorization URL
 *   2. You open it → sign in → Google redirects to https://martinjason.com?code=XXXX
 *   3. Your website loads normally but the URL bar contains ?code=XXXX
 *   4. Copy just the code value from the URL → paste it here
 *   5. Script exchanges it for a refresh token
 *
 * Usage:
 *   GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." node get-token.js
 */

import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = 'https://martinjason.com'; // Must match Google Cloud Console exactly

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running.\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt:      'consent',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
});

console.log('\n─────────────────────────────────────────────────────────');
console.log('  Google OAuth2 Token Setup — martinjason.com');
console.log('─────────────────────────────────────────────────────────\n');
console.log('STEP 1 — Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nSTEP 2 — Sign in with jasonmartinde@gmail.com and click Allow.\n');
console.log('STEP 3 — Your website (martinjason.com) will load.');
console.log('         Look at the URL bar — it will look like:');
console.log('         https://martinjason.com/?code=4%2FXXXXXXXXXXX&scope=...\n');
console.log('STEP 4 — Copy only the code value (between "code=" and "&scope").');
console.log('         It starts with "4/" and is about 60-80 characters long.\n');
console.log('─────────────────────────────────────────────────────────\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the code here: ', async (raw) => {
  rl.close();

  // Decode in case they copied the URL-encoded version (4%2F → 4/)
  const code = decodeURIComponent(raw.trim());

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\n⚠️  Google did not return a refresh token.');
      console.error('   Go to https://myaccount.google.com/permissions');
      console.error('   find "martinjason Booking" → Remove access, then run this script again.\n');
      process.exit(1);
    }

    console.log('\n✅  Done! Add these to Vercel → Settings → Environment Variables:\n');
    console.log('────────────────────────────────────────────────────────────────────');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('────────────────────────────────────────────────────────────────────\n');
    console.log('(Also add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY,');
    console.log(' CALENDAR_ID=jasonmartinde@gmail.com, FRONTEND_ORIGIN=https://martinjason.com)\n');

  } catch (err) {
    console.error('\n❌  Token exchange failed:', err.message);
    if (err.message.includes('invalid_grant')) {
      console.error('\n   The code expired or was already used (they are single-use).');
      console.error('   Run this script again to get a fresh URL and a new code.\n');
    }
    process.exit(1);
  }
});
