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
  pipeline_stage    TEXT        NOT NULL DEFAULT 'new_lead'
                    CHECK (pipeline_stage IN (
                      'new_lead', 'contacted', 'proposal',
                      'negotiation', 'won', 'lost'
                    )),
  is_active_client  BOOLEAN     NOT NULL DEFAULT false,
  notes             TEXT,
  next_followup_date DATE,
  tags              TEXT[]      DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


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
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  duration_minutes INTEGER     NOT NULL DEFAULT 0,
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_invoiced      BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  TABLE: invoices
--  One invoice per client billing cycle. Line items live in
--  invoice_items. tax_rate defaults to 19% (German MwSt) but
--  can be changed per invoice (e.g. 0% for EU B2B / Kleinunternehmer).
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
  tax_rate       DECIMAL(5,2)   NOT NULL DEFAULT 19.00,
  tax_amount     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  total          DECIMAL(10,2)  NOT NULL DEFAULT 0,
  notes          TEXT,
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
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  time_entry_ids  UUID[]        DEFAULT '{}',
  sort_order      INTEGER       NOT NULL DEFAULT 0
);


-- ============================================================
--  ROW LEVEL SECURITY
--  All tables are locked down. Only authenticated users
--  (i.e. you, logged in through Supabase Auth) can read
--  or write anything. Anonymous requests get nothing.
-- ============================================================
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated user has full access to all tables
CREATE POLICY "Authenticated full access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON contacts_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON time_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


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
--  DONE.
--  Next: copy your Supabase Project URL and anon key from
--  Settings → API and keep them ready for the dashboard config.
-- ============================================================
