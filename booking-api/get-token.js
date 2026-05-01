#!/usr/bin/env node
/**
 * get-token.js
 * Run this ONCE locally to obtain your Google OAuth2 refresh token.
 *
 * Usage:
 *   1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment
 *      (or create a .env file and load it: node --env-file=.env get-token.js)
 *   2. Run:  node get-token.js
 *   3. Open the URL it prints in your browser
 *   4. Authorise access with your jasonmartinde@gmail.com account
 *   5. Copy the code shown → paste it back in the terminal
 *   6. Copy the printed GOOGLE_REFRESH_TOKEN → add it to your Vercel env vars
 *
 * This script is safe to run repeatedly — each run generates a fresh token.
 */

import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.\n');
  console.error('    Either export them first, or run:');
  console.error('    node --env-file=.env get-token.js\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'  // Desktop / manual copy-paste flow
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',           // Create events
  'https://www.googleapis.com/auth/calendar.readonly',  // Read busy times
  'https://www.googleapis.com/auth/gmail.send',         // Send confirmation emails
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type:  'offline',
  scope:        SCOPES,
  prompt:       'consent', // Forces refresh_token to be returned even if already authorised
});

console.log('\n─────────────────────────────────────────────────────');
console.log('  Google OAuth2 Token Setup for martinjason.com');
console.log('─────────────────────────────────────────────────────\n');
console.log('1. Open this URL in your browser:\n');
console.log('   ' + authUrl + '\n');
console.log('2. Sign in with jasonmartinde@gmail.com');
console.log('3. Click "Allow" on both permission screens');
console.log('4. Copy the authorisation code shown\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the authorisation code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error('\n⚠️  No refresh_token received.');
      console.error('   This usually means the app was already authorised.');
      console.error('   Go to https://myaccount.google.com/permissions, revoke access,');
      console.error('   then run this script again.\n');
      process.exit(1);
    }

    console.log('\n✅  Success! Add this to your Vercel environment variables:\n');
    console.log('   GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
    console.log('   Also add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET if not already set.\n');

  } catch (err) {
    console.error('\n❌  Token exchange failed:', err.message);
    console.error('    Make sure you copied the full code and try again.\n');
    process.exit(1);
  }
});
