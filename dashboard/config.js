// ============================================================
//  martinjason.com — BI Dashboard
//  Configuration — update GA4_MEASUREMENT_ID once GA4 is set up
// ============================================================

const CONFIG = {

  // ----------------------------------------------------------
  //  Supabase
  //  Project URL + anon key (safe for client-side use — data
  //  is protected by Row Level Security in the database)
  // ----------------------------------------------------------
  SUPABASE_URL:      'https://blibykmyvkdtdvgzuwyr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsaWJ5a215dmtkdGR2Z3p1d3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDI4ODYsImV4cCI6MjA5MzQxODg4Nn0.9CeJ9wNUcA7_3CXWXZ2rEZZMkbEYmBSQVvvv5ycNINA',

  // ----------------------------------------------------------
  //  Google Analytics 4
  //  Replace the placeholder below with your Measurement ID
  //  (format: G-XXXXXXXXXX) once you create the GA4 property.
  //  The tracking snippet will be injected into all site pages.
  // ----------------------------------------------------------
  GA4_MEASUREMENT_ID: 'G-VGBWRTMZW2',

  // ----------------------------------------------------------
  //  Google Analytics 4 — Property ID (numeric)
  //  NOT the G-... Measurement ID — this is a plain number.
  //  Find it: GA4 → Admin (gear icon, bottom-left) → Property Settings → Property ID
  //  Example: '325847291'
  // ----------------------------------------------------------
  GA4_PROPERTY_ID: '535837432',

  // ----------------------------------------------------------
  //  Invoicing defaults (shown as pre-filled values)
  // ----------------------------------------------------------
  INVOICE_FROM: {
    name:    'Jason Martin',
    email:   'jasonmartinph@gmail.com',
    website: 'martinjason.com',
    // Add your address + VAT/Steuernummer below for German invoices
    address: '',
    tax_id:  '',
  },

  // German MwSt — change to 0 if you're a Kleinunternehmer (§19 UStG)
  DEFAULT_TAX_RATE: 19,

  // Default payment term in days
  DEFAULT_PAYMENT_DAYS: 14,

  // ----------------------------------------------------------
  //  Gmail OAuth (for sending invoices from your Gmail)
  //  1. Go to console.cloud.google.com → your project → APIs & Services → Credentials
  //  2. Create OAuth 2.0 Client ID → Web application
  //  3. Add http://localhost and https://dashboard.martinjason.com to Authorized JS origins
  //  4. Paste the Client ID below (looks like: XXXXXXXXX.apps.googleusercontent.com)
  // ----------------------------------------------------------
  GMAIL_CLIENT_ID: '672383429326-fve9t1ak2haf7ll2he2r54rkvohtqugt.apps.googleusercontent.com',

};
