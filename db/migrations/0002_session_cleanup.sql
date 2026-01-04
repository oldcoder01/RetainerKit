BEGIN;

CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires);

-- Optional helper view for debugging
CREATE OR REPLACE VIEW active_sessions AS
SELECT *
FROM sessions
WHERE expires > now();

COMMIT;
