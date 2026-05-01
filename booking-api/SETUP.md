# Booking System — Setup Guide

> Complete setup takes about 20–30 minutes.  
> You'll need: a Google account (jasonmartinde@gmail.com) and a terminal.

---

## Overview

The booking system has two parts:

| Part | Where | What it does |
|------|-------|-------------|
| **Frontend popup** | Your GitHub Pages site | Shows the calendar, collects details |
| **Backend API** | Vercel (free tier) | Fetches availability, creates events, sends emails |

---

## Step 1 — Get your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys**
2. Click **Create Key** → copy it
3. Keep it safe — you'll add it to Vercel later

---

## Step 2 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it `martinjason-booking` → **Create**

### Enable the APIs

4. In the left menu: **APIs & Services → Library**
5. Search for and enable each of these:
   - **Google Calendar API** → Enable
   - **Gmail API** → Enable

### Create OAuth2 Credentials

6. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
7. If prompted to configure the consent screen first:
   - User Type: **External**
   - App name: `martinjason Booking`
   - User support email: `jasonmartinde@gmail.com`
   - Developer contact: `jasonmartinde@gmail.com`
   - Click **Save and Continue** through all screens
   - Under **Test users**, click **Add Users** → add `jasonmartinde@gmail.com`
8. Back in **Create OAuth client ID**:
   - Application type: **Desktop app**
   - Name: `Booking API`
   - Click **Create**
9. **Copy** the **Client ID** and **Client Secret** — you'll need them next

---

## Step 3 — Get Your Refresh Token

This is a one-time step that authorises the API to access your calendar and Gmail.

```bash
# Open a terminal in the booking-api folder
cd booking-api

# Install dependencies
npm install

# Run the token helper (replace with your actual credentials)
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
node get-token.js
```

The script will print a URL — open it in your browser, sign in with `jasonmartinde@gmail.com`, 
click **Allow**, then paste the code back in the terminal.

**Copy the `GOOGLE_REFRESH_TOKEN` value it prints** — you'll need it in Step 5.

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up / log in (free account is fine)
2. Click **Add New → Project**
3. Import your GitHub repository  
   *(If booking-api is a subfolder, set the **Root Directory** to `booking-api`)*
4. Click **Deploy**

After the first deploy succeeds, copy your project URL (e.g. `https://martinjason-booking-api.vercel.app`).

---

## Step 5 — Add Environment Variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add each of these:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | From Step 1 |
| `GOOGLE_CLIENT_ID` | From Step 2 |
| `GOOGLE_CLIENT_SECRET` | From Step 2 |
| `GOOGLE_REFRESH_TOKEN` | From Step 3 |
| `CALENDAR_ID` | `jasonmartinde@gmail.com` |
| `FRONTEND_ORIGIN` | `https://martinjason.com` |

After adding them, go to **Deployments → Redeploy** (top-right) to apply the env vars.

---

## Step 6 — Update the Frontend

Open `martinjason.com/index.html` and replace the placeholder URL on this line:

```html
window.BOOKING_API_BASE = 'https://YOUR-VERCEL-URL.vercel.app';
```

Replace `YOUR-VERCEL-URL` with your actual Vercel project URL from Step 4.  
**Do not include a trailing slash.**

Example:
```html
window.BOOKING_API_BASE = 'https://martinjason-booking-api.vercel.app';
```

---

## Step 7 — Push to GitHub

```bash
cd martinjason.com
git add booking-popup.js booking-popup.css index.html
git commit -m "feat: add booking popup"
git push
```

GitHub Pages will rebuild automatically (~2 minutes).

---

## Testing

1. Open your live site → click any **Termin buchen** button
2. The popup should open and load available slots
3. Pick a date, time, fill in test details, submit
4. Check your Google Calendar for the new event
5. Check the test email address for a confirmation email

### Test locally (without deploying)

```bash
# In booking-api folder
npx vercel dev
```

Then open `index.html` with a local server (e.g. VS Code Live Server on port 5500).  
The local API runs at `http://localhost:3000` and CORS is pre-configured for it.

---

## Troubleshooting

**"Verfügbarkeit konnte nicht geladen werden"**  
→ Check Vercel function logs for the actual error  
→ Make sure all 5 env vars are set and the project has been redeployed

**"invalid_grant" in logs**  
→ Your refresh token has expired. Re-run `node get-token.js` and update the env var in Vercel.

**No slots showing / all slots greyed out**  
→ Your calendar might have no free slots in the working hours. Add a test event outside those times to verify.

**Email not received**  
→ Check spam folder. Gmail API emails occasionally land there initially.

---

## Booking Schedule (already configured)

| Day | Available (Bali / UTC+8) |
|-----|--------------------------|
| Monday | 13:00 – 19:00 |
| Tuesday | 13:00 – 15:30 and 16:30 – 19:00 |
| Wednesday | 13:00 – 19:00 |
| Thursday | 13:00 – 19:00 |
| Friday | 13:00 – 15:30 and 16:30 – 19:00 |

Slots are 30 minutes each. To change this, edit `booking-api/lib/slots.js`.
