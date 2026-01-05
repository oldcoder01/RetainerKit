BEGIN;

-- For composite FK (workspace_id, contract_id) -> contracts(workspace_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS contracts_workspace_id_id_uidx
  ON contracts (workspace_id, id);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0 AND amount_cents <= 1000000000),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),

  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'void')) DEFAULT 'draft',

  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (period_start <= period_end)
);

ALTER TABLE invoices
  ADD CONSTRAINT invoices_contract_fk
  FOREIGN KEY (workspace_id, contract_id)
  REFERENCES contracts(workspace_id, id)
  ON DELETE CASCADE;

CREATE INDEX invoices_workspace_id_idx ON invoices(workspace_id);
CREATE INDEX invoices_contract_id_idx ON invoices(contract_id);
CREATE INDEX invoices_period_start_idx ON invoices(period_start);
CREATE INDEX invoices_status_idx ON invoices(status);

COMMIT;
