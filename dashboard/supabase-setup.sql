-- ============================================================
--  martinjason.com — Business Intelligence Dashboard
--  Supabase SQL Migration  |  Run this once in the SQL Editor
--  supabase.com → your project → SQL Editor → New query
-- ============================================================


-- ============================================================
--  EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
--  HELPER: auto-update updated_at on any row change
-- ============================================================
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
--  TABLE: clients
--  Stores both leads (pipeline) and active clients in one place.
--  pipeline_stage is used for Kanban; is_active_client flips to
--  true when a lead converts.
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT        NOT NULL,
  email             TEXT,
  company           TEXT,
  phone             TEXT,
  website           TEXT,
  address           TEXT,                   -- postal address for invoices ("Billed to")
  vat_id            TEXT,                   -- optional VAT / USt-IdNr. for invoices
  pipeline_stage    TEXT        NOT NULL DEFAULT 'new_lead'
                    CHECK (pipeline_stage IN (
                      'new_lead', 'contacted', 'proposal',
                      'negotiation', 'won', 'closed', 'lost'
                    )),
  is_active_client  BOOLEAN     NOT NULL DEFAULT false,
  won_at            DATE,                   -- date the client was won (used for budget proration)
  notes             TEXT,
  next_followup_date DATE,
  tags              TEXT[]      DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Migration helper: add address + vat_id columns to clients if the table
-- already exists from an earlier setup (safe to run multiple times).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'address'
  ) THEN
    ALTER TABLE clients ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'vat_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN vat_id TEXT;
  END IF;
END $$;


-- ============================================================
--  TABLE: contacts_log
--  Activity history per client: calls, emails, meetings, notes.
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'note'
             CHECK (type IN ('call', 'email', 'meeting', 'note', 'other')),
  notes      TEXT        NOT NULL,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  TABLE: projects
--  Each project belongs to a client. Supports hourly + fixed
--  rate types. Hourly projects feed directly into time tracking
--  and invoice line-item generation.
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id           UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         TEXT           NOT NULL,
  description  TEXT,
  status       TEXT           NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  rate_type    TEXT           NOT NULL DEFAULT 'hourly'
               CHECK (rate_type IN ('hourly', 'fixed')),
  rate         DECIMAL(10,2),           -- €/hour or fixed project fee
  budget_hours DECIMAL(10,2),           -- optional hour cap
  budget_start_day SMALLINT             -- day-of-month (1-31) the recurring budget cycle starts on; NULL = calendar month
               CHECK (budget_start_day IS NULL OR (budget_start_day BETWEEN 1 AND 31)),
  color        TEXT,                    -- optional custom "#rrggbb" highlight color
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ============================================================
--  TABLE: time_entries
--  Each row is one logged work session. duration_minutes is
--  always stored so the app works even for manual entries
--  (where start_time / end_time may be NULL).
--  is_invoiced flips to true once included in a sent invoice.
-- ============================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES clients(id),
  description      TEXT,
  detail           TEXT,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  duration_minutes INTEGER     NOT NULL DEFAULT 0,
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_invoiced      BOOLEAN     NOT NULL DEFAULT false,
  time_logs        JSONB       NOT NULL DEFAULT '[]',
  rate_override    NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration helper: add time_logs column if table already exists
-- (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'time_logs'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN time_logs JSONB NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- Migration helper: add rate_override column (per-entry hourly rate that
-- overrides the project's default rate) if table already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'rate_override'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN rate_override NUMERIC;
  END IF;
END $$;

-- Migration helper: add detail column (the longer "Beschreibung" shown under
-- the "Titel"/description on the invoice) if table already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'detail'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN detail TEXT;
  END IF;
END $$;

-- Migration helper: add won_at column to clients if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'won_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN won_at DATE;
  END IF;
END $$;

-- Migration helper: add pdf_url column to invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN pdf_url TEXT;
  END IF;
END $$;

-- Migration helper: add color column to projects if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'color'
  ) THEN
    ALTER TABLE projects ADD COLUMN color TEXT;
  END IF;
END $$;

-- Migration helper: add budget_start_day column to projects if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'budget_start_day'
  ) THEN
    ALTER TABLE projects ADD COLUMN budget_start_day SMALLINT
      CHECK (budget_start_day IS NULL OR (budget_start_day BETWEEN 1 AND 31));
  END IF;
END $$;

-- Storage bucket for invoice PDFs (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: ONLY the owner account may touch invoice PDFs.
-- Idempotent — safe to re-run; replaces the older "Authenticated …" policies.
DROP POLICY IF EXISTS "Authenticated upload invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read invoice PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner upload invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner read invoice PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete invoice PDFs" ON storage.objects;

CREATE POLICY "Owner upload invoice PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner read invoice PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

-- upsert:true re-uploads need UPDATE as well as INSERT
CREATE POLICY "Owner update invoice PDFs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoice-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK (bucket_id = 'invoice-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner delete invoice PDFs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');


-- ============================================================
--  TABLE: invoice_reminders
--  Reminders for upcoming invoice creation. Optionally linked
--  to a Google Calendar event for notifications.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  remind_at        TIMESTAMPTZ NOT NULL,
  note             TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;
-- policy: see the "OWNER LOCKDOWN" block below (covers this table too)


-- ============================================================
--  TABLE: invoices
--  One invoice per client billing cycle. Line items live in
--  invoice_items. No tax / MwSt (Kleinunternehmer §19 UStG).
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      UUID           NOT NULL REFERENCES clients(id),
  invoice_number TEXT           NOT NULL UNIQUE,
  invoice_date   DATE           NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  status         TEXT           NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  tax_rate       DECIMAL(5,2)   NOT NULL DEFAULT 0,
  tax_amount     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  total          DECIMAL(10,2)  NOT NULL DEFAULT 0,
  notes          TEXT,
  pdf_url        TEXT,
  sent_at        TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ============================================================
--  TABLE: invoice_items
--  Line items for each invoice. When generated from time
--  entries, time_entry_ids stores the UUIDs so those entries
--  can be marked is_invoiced = true after sending.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id      UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT          NOT NULL,
  detail          TEXT,
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  time_entry_ids  UUID[]        DEFAULT '{}',
  sort_order      INTEGER       NOT NULL DEFAULT 0
);

-- Migration helper: add detail column (the longer "Beschreibung" shown under
-- the line-item title on the invoice) if invoice_items already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_items' AND column_name = 'detail'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN detail TEXT;
  END IF;
END $$;


-- ============================================================
--  ROW LEVEL SECURITY — OWNER LOCKDOWN
--  All tables are locked down to exactly ONE account
--  (jasonmartinde@gmail.com). Every other authenticated user —
--  and of course every anonymous request — gets nothing.
--
--  This block is idempotent: it drops the older, wider
--  "Authenticated full access" policies and (re)creates the
--  owner-only ones, so it is safe to re-run on an existing DB.
--
--  IMPORTANT — do this once in the Supabase UI as well:
--  Authentication → Sign In / Providers → disable
--  "Allow new users to sign up", so nobody else can even
--  create an account.
-- ============================================================
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'contacts_log', 'projects',
    'time_entries', 'invoices', 'invoice_items', 'invoice_reminders'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner only" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "Owner only" ON %I FOR ALL TO authenticated '
      || 'USING ((auth.jwt() ->> ''email'') = ''jasonmartinde@gmail.com'') '
      || 'WITH CHECK ((auth.jwt() ->> ''email'') = ''jasonmartinde@gmail.com'')', t);
  END LOOP;
END $$;


-- ============================================================
--  TABLE: app_tokens
--  Server-side secrets (e.g. the Google Analytics OAuth refresh
--  token used by /api/ga-token, and the LinkedIn token used by
--  /api/linkedin-token + /api/linkedin-publish, stored as JSON
--  under id='linkedin'). RLS is enabled with NO policies on
--  purpose: neither anon nor authenticated clients can read this
--  table — only the service role key used by the Vercel API
--  functions has access.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_tokens (
  id         TEXT        PRIMARY KEY,
  token      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_tokens ENABLE ROW LEVEL SECURITY;
-- no CREATE POLICY here — service-role access only

-- The "posts" table itself is provisioned outside this file (by the
-- external content-engine automation that inserts drafts). This only
-- adds the columns the LinkedIn publish/cron/media/recurring features
-- need — safe to run even if some of them already exist.
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS linkedin_post_urn TEXT;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS first_comment TEXT;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS recurring_rule JSONB;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS recurring_parent_id UUID;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

-- Storage bucket for images/videos attached to LinkedIn drafts. Private —
-- the dashboard owner uploads/reads via their authenticated session, and
-- /api/linkedin-publish (service role) downloads the bytes at publish time
-- to hand them to LinkedIn's asset-upload API.
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owner upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Owner read post media"   ON storage.objects;
DROP POLICY IF EXISTS "Owner delete post media" ON storage.objects;

CREATE POLICY "Owner upload post media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner read post media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-media' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner delete post media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');


-- ============================================================
--  SAMPLE DATA (optional — delete this block if you want a
--  clean start, or run it to test the dashboard right away)
-- ============================================================

-- Sample client (lead in pipeline)
INSERT INTO clients (name, email, company, pipeline_stage, notes, next_followup_date)
VALUES (
  'Max Müller',
  'max@example.com',
  'Müller GmbH',
  'proposal',
  'Met at Berlin Design Week. Interested in a full brand refresh + landing page.',
  CURRENT_DATE + INTERVAL '3 days'
);

-- Sample active client with a project
WITH new_client AS (
  INSERT INTO clients (name, email, company, pipeline_stage, is_active_client)
  VALUES ('Sophie Bauer', 'sophie@shopify-store.de', 'Bauer Naturkosmetik', 'won', true)
  RETURNING id
),
new_project AS (
  INSERT INTO projects (client_id, name, rate_type, rate, status)
  SELECT id, 'Shopify Store Redesign', 'hourly', 95.00, 'active'
  FROM new_client
  RETURNING id, client_id
)
INSERT INTO time_entries (project_id, client_id, description, duration_minutes, date)
SELECT id, client_id, 'Initial wireframes & design system setup', 180, CURRENT_DATE - 2
FROM new_project;


-- ============================================================
--  TABLE: quotes
--  One quote (Angebot) per client. On acceptance it can be
--  converted into an invoice from the dashboard (see
--  converted_invoice_id) — items are copied 1:1 so amounts on
--  the quote and the resulting invoice always match.
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id                    UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID           NOT NULL REFERENCES clients(id),
  quote_number          TEXT           NOT NULL UNIQUE,
  quote_date            DATE           NOT NULL DEFAULT CURRENT_DATE,
  valid_until           DATE           NOT NULL,
  status                TEXT           NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','sent','accepted','declined','expired','converted')),
  subtotal              DECIMAL(10,2)  NOT NULL DEFAULT 0,
  tax_rate              DECIMAL(5,2)   NOT NULL DEFAULT 0,
  tax_amount            DECIMAL(10,2)  NOT NULL DEFAULT 0,
  total                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
  payment_terms         TEXT,
  notes                 TEXT,
  pdf_url               TEXT,
  sent_at               TIMESTAMPTZ,
  decided_at            TIMESTAMPTZ,
  converted_invoice_id  UUID REFERENCES invoices(id),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ============================================================
--  TABLE: quote_items
--  Line items for each quote — same shape as invoice_items so
--  a quote's positions convert 1:1 into invoice_items.
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id      UUID          NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description   TEXT          NOT NULL,
  detail        TEXT,
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order    INTEGER       NOT NULL DEFAULT 0
);

ALTER TABLE quotes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items  ENABLE ROW LEVEL SECURITY;

-- Owner-only lockdown, same pattern as every other table (see the
-- "OWNER LOCKDOWN" block above) — added here as its own idempotent
-- statement so this segment can be run standalone against an existing DB.
DROP POLICY IF EXISTS "Authenticated full access" ON quotes;
DROP POLICY IF EXISTS "Owner only" ON quotes;
CREATE POLICY "Owner only" ON quotes FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

DROP POLICY IF EXISTS "Authenticated full access" ON quote_items;
DROP POLICY IF EXISTS "Owner only" ON quote_items;
CREATE POLICY "Owner only" ON quote_items FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

-- Storage bucket for manually attached quote PDFs (same pattern as
-- invoice-pdfs — run once).
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owner upload quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner read quote PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete quote PDFs" ON storage.objects;

CREATE POLICY "Owner upload quote PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner read quote PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quote-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner update quote PDFs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK (bucket_id = 'quote-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner delete quote PDFs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');


-- ============================================================
--  TABLE: contracts
--  One service contract per client. Signing is manual — the
--  generated PDF is sent out, the client signs it on paper (or
--  in a PDF viewer) and sends it back, and the signed copy is
--  uploaded here. No e-signature flow, no public route, no
--  token: contract-pdfs is a private, owner-only bucket like
--  invoice-pdfs / quote-pdfs.
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id             UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      UUID           NOT NULL REFERENCES clients(id),
  quote_id       UUID           REFERENCES quotes(id),
  contract_number TEXT          NOT NULL UNIQUE,
  title          TEXT           NOT NULL DEFAULT 'Dienstleistungsvertrag',
  content_html   TEXT           NOT NULL,
  fee_amount     DECIMAL(10,2),
  payment_terms  TEXT,
  start_date     DATE,
  status         TEXT           NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','signed','declined','void')),
  signer_name    TEXT,
  signer_email   TEXT,
  pdf_url        TEXT,
  sent_at        TIMESTAMPTZ,
  signed_at      TIMESTAMPTZ,
  declined_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Owner-only lockdown, same pattern as every other table (see the
-- "OWNER LOCKDOWN" block above) — added here as its own idempotent
-- statement so this segment can be run standalone against an existing DB.
-- No anon/public policy exists anywhere for this table on purpose: there
-- is no public route that needs to read or write a contract.
DROP POLICY IF EXISTS "Authenticated full access" ON contracts;
DROP POLICY IF EXISTS "Owner only" ON contracts;
CREATE POLICY "Owner only" ON contracts FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

-- Storage bucket for contract PDFs (system-generated outgoing copy and the
-- client's signed-and-scanned return copy) — same pattern as invoice-pdfs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-pdfs', 'contract-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owner upload contract PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner read contract PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update contract PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete contract PDFs" ON storage.objects;

CREATE POLICY "Owner upload contract PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner read contract PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner update contract PDFs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK (bucket_id = 'contract-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

CREATE POLICY "Owner delete contract PDFs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-pdfs' AND (auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');


-- ============================================================
--  TABLE: seo_dismissed_opportunities
--  Dismissed SEO opportunity cards from the SEO panel (Search
--  Console) — a card's dismissed state is keyed by a deterministic
--  string like "quickwin:shopify conversion optimization" so it
--  reliably stays hidden across reloads/devices. Same owner-only
--  RLS pattern as every other table — run standalone, safe to
--  re-run.
-- ============================================================
CREATE TABLE IF NOT EXISTS seo_dismissed_opportunities (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_key  TEXT        NOT NULL UNIQUE,
  dismissed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_dismissed_opportunities_key ON seo_dismissed_opportunities(opportunity_key);

ALTER TABLE seo_dismissed_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only" ON seo_dismissed_opportunities;
CREATE POLICY "Owner only" ON seo_dismissed_opportunities FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

-- ============================================================
--  LINKEDIN POST CATEGORIES
--  User-defined tags (name + a color picked from a preset rainbow
--  palette) that can be attached to a post from the dashboard.
--  Deleting a category clears it from any posts that used it.
-- ============================================================
CREATE TABLE IF NOT EXISTS post_categories (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  color      TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO post_categories (name, color, sort_order) VALUES
  ('Persönlich',   '#F04438', 0),
  ('Value',        '#3B82F6', 1),
  ('Portfolio',    '#22C55E', 2),
  ('These',        '#A855F7', 3),
  ('Marktkontext', '#F79009', 4)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES post_categories(id) ON DELETE SET NULL;

ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only" ON post_categories;
CREATE POLICY "Owner only" ON post_categories FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jasonmartinde@gmail.com');

-- ============================================================
--  SEED-30 EXPERIMENT FIELDS
--  posts.category/experiment_batch/media_brief/seed_ref are added by
--  the content-engine automation, same as the rest of this file's
--  posts columns. `category` is a fixed five-value enum used to tag
--  the seed-30 batch for measurement — separate from the freeform,
--  user-colored post_categories/category_id tagging above.
--  posts_seed_ref_uidx keeps the import script idempotent: a second
--  run upserts onto the same row instead of duplicating it.
-- ============================================================
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS experiment_batch TEXT;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS media_brief TEXT;
ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS seed_ref TEXT;

DO $$ BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_category_check
    CHECK (category IS NULL OR category IN ('persoenlich','value','portfolio','these','markt'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS posts_category_idx ON public.posts (category);
CREATE INDEX IF NOT EXISTS posts_experiment_batch_idx ON public.posts (experiment_batch);
CREATE UNIQUE INDEX IF NOT EXISTS posts_seed_ref_uidx ON public.posts (seed_ref) WHERE seed_ref IS NOT NULL;


-- ============================================================
--  DONE.
--  Next: copy your Supabase Project URL and anon key from
--  Settings → API and keep them ready for the dashboard config.
-- ============================================================
