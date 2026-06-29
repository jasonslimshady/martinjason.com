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

  // ----------------------------------------------------------
  //  Invoice company profile — DEFAULTS
  //  These are the pre-filled defaults for the generated invoice
  //  (English layout). They can be edited live in the dashboard
  //  under  Rechnungen → Einstellungen,  which stores per-browser
  //  overrides in localStorage. The logo is uploaded there too.
  // ----------------------------------------------------------
  INVOICE_ISSUER: {
    // The "Pay to" block — the company that issues the invoice.
    name:    'Pacific Origins LLC',
    address: '5830 E 2nd St, Ste 7000 #35505\n82609 Casper\nWyoming U.S.A.',
  },

  INVOICE_ACCOUNT: {
    // The "Account" block — where the client pays.
    bank: 'Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium',
    name: 'Jason Martin',
    iban: 'BE11 9676 2405 7748',
    bic:  'TRWIBEB1XXX',
  },

  // Legal note printed at the bottom of every invoice.
  INVOICE_LEGAL_NOTE: 'Service provider established in United States (non-EU). Place of supply: Germany. VAT reverse charge according to §13b UStG. Tax liability of the service recipient pursuant to §13b UStG. The recipient is liable to account for and pay the German VAT',

  // Label + amount for the tax line (reverse charge = 0).
  INVOICE_VAT_LABEL: 'VAT (reverse charge)',

  // Currency code shown next to every amount (e.g. EUR, USD).
  INVOICE_CURRENCY: 'EUR',

  // Default logo (data URL). Leave empty — upload one in the dashboard.
  INVOICE_LOGO: '',

  DEFAULT_TAX_RATE: 0,

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
