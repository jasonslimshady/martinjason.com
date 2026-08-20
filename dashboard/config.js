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
  //    {{fee_amount}}   {{payment_terms}}    {{start_date}}
  //    {{contract_number}}  {{contract_date}}
  //    {{ai_copyright_disclaimer_note}}  (optional, § 7 Abs. 2)
  //
  //  ARBEITSENTWURF, KEINE RECHTSBERATUNG. Vor dem ersten tatsächlichen
  //  Versand an einen Kunden anwaltlich prüfen lassen — insbesondere
  //  §9 (Gewährleistung/kein Erfolgsversprechen) und §10 (Haftung), weil
  //  dieser Vertrag als wiederverwendete Vorlage rechtlich als
  //  Allgemeine Geschäftsbedingungen (AGB, §305 ff. BGB) gilt und damit
  //  strengerer Inhaltskontrolle unterliegt als eine individuell
  //  verhandelte Klausel. Enthält KEINE Erfolgs-, Ergebnis- oder
  //  Rückerstattungsgarantie — bewusste Entscheidung, siehe §9.
  // ----------------------------------------------------------
  CONTRACT_TEMPLATE_HTML: `<p>zwischen</p>
<p><span class="invd-name">Pacific Origins LLC</span><br>
5830 E 2nd St, Ste 7000 #35505<br>
82609 Casper, Wyoming, U.S.A.<br>
vertreten durch Jason Martin<br>
— nachfolgend „Auftragnehmer" —</p>

<p>und</p>

<p><span class="invd-name">{{client_name}}</span><br>
{{client_address}}<br>
— nachfolgend „Auftraggeber" —</p>

<p>Vertragsnummer: {{contract_number}}<br>
Datum: {{contract_date}}</p>

<h3>§1 Vertragsgegenstand</h3>
<p>(1) Der Auftragnehmer erbringt für den Auftraggeber die nachfolgend beschriebene Dienst-/Werkleistung im Bereich Produktbild- und Produktgalerie-Erstellung unter Einsatz KI-gestützter Bildgenerierung:</p>
<p>{{scope_description}}</p>
<p>(2) Der vorstehend beschriebene Leistungsumfang ist abschließend. Änderungen oder Erweiterungen des Umfangs bedürfen der Textform (z. B. E-Mail) und werden gesondert vergütet, sofern nichts anderes vereinbart ist.</p>
<p>(3) Nicht Vertragsgegenstand sind insbesondere: Fotoproduktion vor Ort, Video-/Bewegtbildinhalte, Website- oder Shop-technische Umsetzung, laufende Kampagnensteuerung sowie jegliche Leistungen, die nicht ausdrücklich unter Absatz (1) benannt sind.</p>

<h3>§2 Mitwirkungspflichten des Auftraggebers</h3>
<p>(1) Der Auftraggeber stellt dem Auftragnehmer rechtzeitig alle für die Leistungserbringung erforderlichen Materialien zur Verfügung, insbesondere: Produktfotos/-referenzen in ausreichender Qualität, Markenrichtlinien (sofern vorhanden), sowie ggf. Zugang zu Shop-/Werbeplattform-Analysen, soweit für die Leistung erforderlich.</p>
<p>(2) Verzögert sich die Leistungserbringung durch verspätete oder unvollständige Mitwirkung des Auftraggebers, verschieben sich vereinbarte Termine entsprechend; hieraus resultierende Mehraufwände können gesondert in Rechnung gestellt werden.</p>
<p>(3) Der Auftraggeber sichert zu, dass die bereitgestellten Materialien frei von Rechten Dritter sind bzw. er zu deren Nutzung berechtigt ist, und stellt den Auftragnehmer insoweit von Ansprüchen Dritter frei.</p>

<h3>§3 Vergütung</h3>
<p>(1) Für die in §1 beschriebene Leistung vereinbaren die Parteien eine Pauschalvergütung in Höhe von <strong>{{fee_amount}}</strong> (netto, zzgl. etwaiger gesetzlich geschuldeter Steuern/Abgaben).</p>
<p>(2) Der Auftragnehmer ist ein Unternehmen mit Sitz in den USA (Wyoming). Die Leistung wird nach dem Reverse-Charge-Verfahren gemäß §13b UStG abgerechnet; die Steuerschuldnerschaft liegt beim Auftraggeber als Leistungsempfänger.</p>
<p>(3) Mit der Vergütung sind sämtliche in §1 beschriebenen Leistungen abgegolten. Zusätzliche, nicht vom Leistungsumfang umfasste Anfragen werden nach vorheriger Absprache gesondert vergütet.</p>

<h3>§4 Zahlungsbedingungen</h3>
<p>(1) {{payment_terms}}</p>
<p>(2) Zahlungen erfolgen auf das vom Auftragnehmer benannte Konto. Der Zahlungsanspruch entsteht mit Rechnungsstellung gemäß den vereinbarten Zahlungsbedingungen.</p>
<p>(3) Bei Zahlungsverzug gelten die gesetzlichen Regelungen (§§ 286 ff. BGB), insbesondere zu Verzugszinsen.</p>

<h3>§5 Laufzeit, Termine</h3>
<p>(1) Die Leistungserbringung beginnt am <strong>{{start_date}}</strong> und richtet sich im Übrigen nach dem in §1 beschriebenen Leistungsumfang bzw. einem gesondert vereinbarten Zeitplan.</p>
<p>(2) Liefertermine sind nur dann verbindlich, wenn sie ausdrücklich als "verbindlich" bezeichnet wurden. Im Übrigen handelt es sich um Planungstermine, die sich bei Vorliegen der in §2 genannten Umstände verschieben können.</p>

<h3>§6 Abnahme</h3>
<p>(1) Der Auftragnehmer liefert die vereinbarten Leistungen in digitaler Form (z. B. Bilddateien, Zugriffslinks). Der Auftraggeber prüft die gelieferten Ergebnisse unverzüglich, spätestens innerhalb von <strong>10 Werktagen</strong> nach Übergabe, auf Vertragsmäßigkeit.</p>
<p>(2) Erhebt der Auftraggeber innerhalb dieser Frist keine begründeten, konkret bezeichneten Einwände, gilt die Leistung als abgenommen.</p>
<p>(3) Berechtigte Einwände, die sich auf die in §1 beschriebene Leistungsbeschreibung beziehen (nicht auf subjektive Geschmacksfragen jenseits der vereinbarten Spezifikation), werden im Rahmen der im Leistungsumfang vorgesehenen Korrekturschleife(n) nachgebessert.</p>

<h3>§7 Nutzungsrechte</h3>
<p>(1) Der Auftragnehmer räumt dem Auftraggeber mit vollständiger Bezahlung der Vergütung ein einfaches, zeitlich und räumlich unbeschränktes Recht ein, die im Rahmen dieses Vertrags erstellten Bildwerke für die vereinbarten Zwecke (insbesondere Produktseiten, Marketing, Werbeanzeigen) zu nutzen, zu vervielfältigen und öffentlich zugänglich zu machen.</p>
<p>(2) Soweit die erstellten Inhalte ganz oder überwiegend durch KI-gestützte Generierung entstanden sind, weist der Auftragnehmer darauf hin, dass die urheberrechtliche Schutzfähigkeit rein KI-generierter Inhalte nach deutschem Recht derzeit rechtlich nicht abschließend geklärt ist{{ai_copyright_disclaimer_note}}. Unabhängig von der urheberrechtlichen Einordnung gilt die vorstehende Nutzungsrechtseinräumung als vertragliche Vereinbarung zwischen den Parteien.</p>
<p>(3) Der Auftragnehmer ist berechtigt, die erstellten Arbeiten (auch vor vollständiger Bezahlung, jedoch ohne Nennung vertraulicher Geschäftsdaten des Auftraggebers) zu eigenen Referenz- und Portfoliozwecken zu nutzen, sofern der Auftraggeber dem nicht ausdrücklich schriftlich widerspricht.</p>

<h3>§8 Änderungen und zusätzliche Leistungen</h3>
<p>Über den in §1 beschriebenen Umfang hinausgehende Wünsche (z. B. weitere Produkte, zusätzliche Bildvarianten, Sonderformate) werden auf Basis eines gesonderten Angebots vereinbart und sind nicht automatisch von diesem Vertrag umfasst.</p>

<h3>§9 Gewährleistung</h3>
<p>(1) Der Auftragnehmer erbringt die in §1 beschriebene Leistung mit der im Geschäftsverkehr üblichen Sorgfalt und nach dem vereinbarten Leistungsumfang.</p>
<p>(2) <strong>Geschuldet ist die vertragsgemäße Erstellung und Lieferung der in §1 beschriebenen Bildwerke. Eine bestimmte betriebswirtschaftliche Wirkung — insbesondere eine Steigerung der Conversion-Rate, des Umsatzes, des ROAS oder vergleichbarer Kennzahlen des Auftraggebers — wird ausdrücklich nicht geschuldet, nicht zugesichert und nicht garantiert.</strong> Der Erfolg des Einsatzes der gelieferten Inhalte hängt von zahlreichen Faktoren außerhalb des Einflussbereichs des Auftragnehmers ab (u. a. Traffic, Preisgestaltung, Saisonalität, Werbebudget, Wettbewerbsumfeld).</p>
<p>(3) Im Übrigen gelten die gesetzlichen Gewährleistungsregelungen für Werkverträge (§§ 631 ff. BGB) hinsichtlich der Mangelfreiheit der gelieferten Bildwerke selbst (z. B. technische Mängel, erhebliches Abweichen von der vereinbarten Leistungsbeschreibung).</p>

<h3>§10 Haftung</h3>
<p>(1) Der Auftragnehmer haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach den Vorschriften des Produkthaftungsgesetzes, bei Verletzung von Leben, Körper oder Gesundheit.</p>
<p>(2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht), deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Auftraggeber regelmäßig vertrauen darf, ist die Haftung des Auftragnehmers der Höhe nach auf den vorhersehbaren, vertragstypischen Schaden begrenzt, maximal jedoch auf die Höhe der für die betroffene Leistung nach §3 vereinbarten Vergütung.</p>
<p>(3) Für leicht fahrlässige Verletzung sonstiger, nicht wesentlicher Vertragspflichten haftet der Auftragnehmer nicht.</p>
<p>(4) Eine Haftung für entgangenen Gewinn, ausgebliebene Umsatz- oder Conversion-Steigerungen oder sonstige mittelbare Schäden des Auftraggebers ist ausgeschlossen, soweit gesetzlich zulässig.</p>

<h3>§11 Vertraulichkeit</h3>
<p>(1) Beide Parteien verpflichten sich, vertrauliche Informationen der jeweils anderen Partei, die ihnen im Rahmen dieses Vertrags bekannt werden (insbesondere Geschäftszahlen, Analytics-/Conversion-Daten, interne Strategien), streng vertraulich zu behandeln und nicht an Dritte weiterzugeben, soweit nicht gesetzlich zur Offenlegung verpflichtet.</p>
<p>(2) Diese Verpflichtung gilt auch nach Beendigung dieses Vertrags fort.</p>
<p>(3) §7 Abs. 3 (Referenznutzung) bleibt hiervon unberührt, soweit dabei keine vertraulichen Geschäftszahlen offengelegt werden.</p>

<h3>§12 Kündigung</h3>
<p>(1) Dieser Vertrag kann von beiden Parteien aus wichtigem Grund fristlos gekündigt werden.</p>
<p>(2) Im Übrigen richtet sich eine ordentliche Kündigung nach dem vereinbarten Leistungsumfang; bei projektbezogenen Einzelleistungen endet der Vertrag mit vollständiger Leistungserbringung und Abnahme.</p>
<p>(3) Bereits erbrachte Leistungen sind auch im Fall vorzeitiger Vertragsbeendigung anteilig zu vergüten.</p>

<h3>§13 Datenschutz</h3>
<p>Beide Parteien verarbeiten personenbezogene Daten im Rahmen dieses Vertrags im Einklang mit den geltenden Datenschutzvorschriften (insbesondere DSGVO). Soweit im Rahmen der Leistungserbringung eine Auftragsverarbeitung im Sinne von Art. 28 DSGVO erforderlich ist, schließen die Parteien hierzu eine gesonderte Vereinbarung.</p>

<h3>§14 Schlussbestimmungen</h3>
<p>(1) Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform (z. B. E-Mail), soweit nicht ausdrücklich anders geregelt.</p>
<p>(2) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</p>
<p>(3) Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist, soweit gesetzlich zulässig, der Sitz des Auftraggebers.</p>
<p>(4) Sollte eine Bestimmung dieses Vertrags unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung.</p>

<p><strong>Auftragnehmer:</strong> Pacific Origins LLC, vertreten durch Jason Martin<br>
<strong>Auftraggeber:</strong> {{client_name}}</p>

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

  // ----------------------------------------------------------
  //  LinkedIn OAuth (publishing drafts from the dashboard)
  //  1. www.linkedin.com/developers/apps → create an app.
  //  2. Products tab → request "Sign In with LinkedIn using OpenID
  //     Connect" and "Share on LinkedIn" (both self-serve, instant).
  //     For company-page posting also request "Community Management
  //     API" (needs LinkedIn review) and set LINKEDIN_ORGANIZATION_ID
  //     in Vercel to your page's numeric ID.
  //  3. Auth tab → add this exact redirect URL:
  //       https://dashboard.martinjason.com/linkedin-callback.html
  //     (and http://localhost:8080/linkedin-callback.html for local dev)
  //  4. Paste the Client ID below. The Client Secret goes server-side
  //     only, as LINKEDIN_CLIENT_SECRET in Vercel — see api/linkedin-token.js.
  // ----------------------------------------------------------
  LINKEDIN_CLIENT_ID: '77j7fnwt382p9k',

};
