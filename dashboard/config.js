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
  //  Owner lockdown — the dashboard belongs to exactly ONE
  //  account. The same email is enforced server-side (RLS
  //  policies in supabase-setup.sql + the /api endpoints); this
  //  client-side check is just the friendly first line.
  // ----------------------------------------------------------
  ALLOWED_EMAIL: 'jasonmartinde@gmail.com',

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
  //  Quote (Angebot) defaults — editable live in the dashboard
  //  under  Angebote → Einstellungen,  which stores per-browser
  //  overrides in localStorage.
  // ----------------------------------------------------------
  // How many days a quote stays valid by default (§145 BGB — an
  // unbounded quote otherwise binds you for a court-defined
  // "reasonable time", which this makes explicit instead).
  QUOTE_VALIDITY_DAYS: 30,

  // Default payment terms text, pre-filled into every new quote.
  // Adjust to your actual deposit / due-date policy.
  QUOTE_PAYMENT_TERMS: '50% Anzahlung nach Auftragsbestätigung, Restbetrag bei Fertigstellung. Zahlungsziel 14 Tage netto ab Rechnungsstellung.',

  // ----------------------------------------------------------
  //  Contract (Vertrag) template — editable live in the dashboard
  //  under  Vertrag → Einstellungen,  which stores a per-browser
  //  override in localStorage (key jm_contract_template).
  //
  //  Merge fields (replaced when a contract is first saved):
  //    {{client_name}}  {{client_address}}  {{scope_description}}
  //    {{fee_amount}}   {{payment_terms}}   {{start_date}}
  //    {{contract_number}}  {{contract_date}}
  //
  //  This is a starting-point draft, not a reviewed legal document —
  //  have it checked by a lawyer before sending it to a real client,
  //  and fill in the governing-law placeholder in § 8 either way.
  // ----------------------------------------------------------
  CONTRACT_TEMPLATE_HTML: `<p><strong>Auftraggeber:</strong><br>{{client_name}}<br>{{client_address}}</p>
<p><strong>Auftragnehmer:</strong><br>siehe Absenderangaben oben</p>
<p>Vertrag Nr. {{contract_number}} vom {{contract_date}}</p>

<h3>§ 1 Vertragsgegenstand</h3>
<p>{{scope_description}}</p>

<h3>§ 2 Vergütung</h3>
<p>Für die in § 1 beschriebene Leistung wird eine Vergütung in Höhe von {{fee_amount}} vereinbart.</p>
<p>{{payment_terms}}</p>

<h3>§ 3 Beginn und Laufzeit</h3>
<p>Die Leistungserbringung beginnt am {{start_date}}. Der Vertrag endet mit vollständiger Erbringung der in § 1 beschriebenen Leistung, sofern nicht schriftlich (Textform genügt) etwas anderes vereinbart wird.</p>

<h3>§ 4 Mitwirkungspflichten</h3>
<p>Der Auftraggeber stellt die für die Leistungserbringung erforderlichen Informationen, Zugänge und Materialien rechtzeitig zur Verfügung. Verzögerungen, die auf fehlende Mitwirkung zurückzuführen sind, verschieben vereinbarte Termine entsprechend.</p>

<h3>§ 5 Änderungen des Leistungsumfangs</h3>
<p>Leistungen, die über den in § 1 beschriebenen Umfang hinausgehen, bedürfen einer gesonderten Vereinbarung in Textform (z. B. per E-Mail), einschließlich der zusätzlichen Vergütung.</p>

<h3>§ 6 Vertraulichkeit</h3>
<p>Beide Parteien verpflichten sich, vertrauliche Informationen der jeweils anderen Partei, die im Rahmen dieses Vertrags bekannt werden, geheim zu halten und nicht ohne Zustimmung an Dritte weiterzugeben.</p>

<h3>§ 7 Haftung</h3>
<p>Die Parteien haften nach den gesetzlichen Bestimmungen. Für leicht fahrlässig verursachte Schäden aus der Verletzung unwesentlicher Vertragspflichten wird die Haftung ausgeschlossen, soweit gesetzlich zulässig.</p>

<h3>§ 8 Schlussbestimmungen</h3>
<p>Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Es gilt das Recht von [Rechtsordnung einfügen] unter Ausschluss des UN-Kaufrechts, soweit zwingende gesetzliche Bestimmungen am Sitz des Auftraggebers nichts anderes vorsehen. Sollte eine Bestimmung dieses Vertrags unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>

<div class="sig-block">
  <div style="flex:1"><div class="sig-line">Ort, Datum</div></div>
  <div style="flex:1"><div class="sig-line">Unterschrift Auftraggeber</div></div>
</div>`,

  // ----------------------------------------------------------
  //  Gmail OAuth (for sending invoices from your Gmail)
  //  1. Go to console.cloud.google.com → your project → APIs & Services → Credentials
  //  2. Create OAuth 2.0 Client ID → Web application
  //  3. Add http://localhost and https://dashboard.martinjason.com to Authorized JS origins
  //  4. Paste the Client ID below (looks like: XXXXXXXXX.apps.googleusercontent.com)
  // ----------------------------------------------------------
  GMAIL_CLIENT_ID: '672383429326-fve9t1ak2haf7ll2he2r54rkvohtqugt.apps.googleusercontent.com',

};
