BEGIN;

-- For composite FK (workspace_id, client_id) -> clients(workspace_id, id),
-- Postgres needs (workspace_id, id) to be UNIQUE via a unique index or constraint.
CREATE UNIQUE INDEX IF NOT EXISTS clients_workspace_id_id_uidx
  ON clients (workspace_id, id);

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,

  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'closed')) DEFAULT 'active',

  hourly_rate_cents INT,
  monthly_retainer_cents INT,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite FK guarantees client_id is in the same workspace_id
ALTER TABLE contracts
  ADD CONSTRAINT contracts_client_fk
  FOREIGN KEY (workspace_id, client_id)
  REFERENCES clients(workspace_id, id)
  ON DELETE CASCADE;

CREATE INDEX contracts_workspace_id_idx ON contracts(workspace_id);
CREATE INDEX contracts_client_id_idx ON contracts(client_id);

COMMIT;
