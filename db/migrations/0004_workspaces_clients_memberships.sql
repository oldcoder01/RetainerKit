BEGIN;

-- ----
-- Workspaces (tenant boundary)
-- ----
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'contractor', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_id_idx ON workspace_members(workspace_id);

-- ----
-- Clients (business entities inside a workspace)
-- ----
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_workspace_id_idx ON clients(workspace_id);

CREATE TABLE IF NOT EXISTS client_members (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_role TEXT NOT NULL CHECK (client_role IN ('client_admin', 'client_user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, user_id)
);

CREATE INDEX IF NOT EXISTS client_members_user_id_idx ON client_members(user_id);
CREATE INDEX IF NOT EXISTS client_members_client_id_idx ON client_members(client_id);

-- ----
-- Projects: add workspace scope (keep existing user_id for now)
-- ----
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ----
-- Backfill: create a default workspace per existing user (1 workspace per owner)
-- ----
INSERT INTO workspaces (owner_user_id, name)
SELECT
  u.id,
  (COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) || '''s Workspace') AS name
FROM users u
ON CONFLICT (owner_user_id) DO UPDATE
SET name = workspaces.name;

-- Ensure every workspace has an owner membership row
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_user_id, 'owner'
FROM workspaces w
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Backfill projects to workspace + created_by
UPDATE projects p
SET
  workspace_id = w.id,
  created_by_user_id = p.user_id
FROM workspaces w
WHERE w.owner_user_id = p.user_id
  AND p.workspace_id IS NULL;

-- Enforce NOT NULL now that backfill is done
ALTER TABLE projects
  ALTER COLUMN workspace_id SET NOT NULL,
  ALTER COLUMN created_by_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON projects(workspace_id);

COMMIT;
