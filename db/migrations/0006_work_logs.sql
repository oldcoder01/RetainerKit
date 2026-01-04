BEGIN;

-- Allow composite FK (workspace_id, contract_id) -> contracts(workspace_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS contracts_workspace_id_id_uidx
  ON contracts (workspace_id, id);

CREATE TABLE work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL,

  work_date DATE NOT NULL,
  minutes INT NOT NULL CHECK (minutes > 0 AND minutes <= 24 * 60),

  description TEXT NOT NULL,

  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE work_logs
  ADD CONSTRAINT work_logs_contract_fk
  FOREIGN KEY (workspace_id, contract_id)
  REFERENCES contracts(workspace_id, id)
  ON DELETE CASCADE;

CREATE INDEX work_logs_workspace_id_idx ON work_logs(workspace_id);
CREATE INDEX work_logs_contract_id_idx ON work_logs(contract_id);
CREATE INDEX work_logs_work_date_idx ON work_logs(work_date);

COMMIT;
