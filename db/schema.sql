CREATE TABLE IF NOT EXISTS members (
  code text PRIMARY KEY CHECK (code ~ '^[a-f0-9]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS series (
  id text PRIMARY KEY, name text NOT NULL, max_extra integer NOT NULL DEFAULT 5 CHECK (max_extra = 5)
);
CREATE TABLE IF NOT EXISTS drops (
  id text PRIMARY KEY, series_id text NOT NULL REFERENCES series(id),
  title text NOT NULL, description text NOT NULL DEFAULT '', items integer NOT NULL CHECK (items BETWEEN 1 AND 300),
  opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('draft','open','closed','drawn','settled')),
  is_demo boolean NOT NULL DEFAULT false, is_setup boolean NOT NULL DEFAULT false,
  sui_drop_id text, draw_tx text, drawn_at timestamptz,
  CHECK (closes_at > opens_at)
);
CREATE TABLE IF NOT EXISTS entries (
  drop_id text NOT NULL REFERENCES drops(id), member_code text NOT NULL REFERENCES members(code),
  tickets integer NOT NULL CHECK (tickets BETWEEN 1 AND 6), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drop_id, member_code)
);
CREATE TABLE IF NOT EXISTS results (
  drop_id text NOT NULL, member_code text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('won','lost')), pick_order integer,
  losses_before integer NOT NULL CHECK (losses_before >= 0), losses_after integer NOT NULL CHECK (losses_after >= 0),
  PRIMARY KEY (drop_id, member_code), FOREIGN KEY (drop_id, member_code) REFERENCES entries(drop_id, member_code),
  UNIQUE (drop_id, pick_order), CHECK ((outcome = 'won') = (pick_order IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS pity (
  series_id text NOT NULL REFERENCES series(id), member_code text NOT NULL REFERENCES members(code),
  losses integer NOT NULL CHECK (losses >= 0), PRIMARY KEY (series_id, member_code)
);
CREATE TABLE IF NOT EXISTS pickups (
  drop_id text NOT NULL, member_code text NOT NULL, collected_at timestamptz NOT NULL DEFAULT now(),
  presence text NOT NULL CHECK (presence IN ('untested-staging','local-demo')),
  PRIMARY KEY (drop_id, member_code), FOREIGN KEY (drop_id, member_code) REFERENCES results(drop_id, member_code)
);
CREATE TABLE IF NOT EXISTS draw_records (
  drop_id text PRIMARY KEY REFERENCES drops(id), algorithm text NOT NULL,
  record jsonb NOT NULL, record_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS challenges (
  id text PRIMARY KEY, nonce text UNIQUE NOT NULL, drop_id text NOT NULL REFERENCES drops(id),
  purpose text NOT NULL CHECK (purpose IN ('enter','collect')), expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS proof_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  route text NOT NULL, outcome text NOT NULL, duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_member_idx ON entries(member_code);
CREATE INDEX IF NOT EXISTS drops_series_idx ON drops(series_id);
CREATE INDEX IF NOT EXISTS challenges_expiry_idx ON challenges(expires_at);
CREATE TABLE IF NOT EXISTS identity_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  fingerprint text NOT NULL
);
ALTER TABLE series ADD COLUMN IF NOT EXISTS sui_series_id text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS sui_package_id text;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS price_mist numeric(20,0) NOT NULL DEFAULT 0 CHECK (price_mist >= 0);
ALTER TABLE drops ADD COLUMN IF NOT EXISTS coin_type text;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS sui_network text;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS sui_create_tx text;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS settle_tx text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS sui_status text CHECK (sui_status IN ('pending','registered'));
ALTER TABLE entries ADD COLUMN IF NOT EXISTS sui_tx text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS payer text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS paid_mist numeric(20,0) NOT NULL DEFAULT 0 CHECK (paid_mist >= 0)
