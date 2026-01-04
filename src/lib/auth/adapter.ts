import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import type { Pool } from "pg";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified: Date | null;
  image: string | null;
};

type SessionRow = {
  session_token: string;
  user_id: string;
  expires: Date;
};

type SessionAndUserRow = {
  session_token: string;
  user_id: string;
  expires: Date;
  u_id: string;
  u_name: string | null;
  u_email: string;
  u_email_verified: Date | null;
  u_image: string | null;
};

function mapUserRow(row: UserRow): AdapterUser {
  return {
    id: String(row.id),
    name: row.name ?? null,
    email: row.email,
    emailVerified: row.email_verified ?? null,
    image: row.image ?? null,
  };
}

function mapSessionRow(row: SessionRow): AdapterSession {
  return {
    sessionToken: row.session_token,
    userId: String(row.user_id),
    expires: row.expires,
  };
}

type SessionStateCapableAccount = AdapterAccount & { session_state?: string };

function mapAccountRowToInsert(account: AdapterAccount): Array<string | number | null> {
  const a: SessionStateCapableAccount = account as SessionStateCapableAccount;

  return [
    account.userId,
    account.type,
    account.provider,
    account.providerAccountId,
    account.refresh_token ?? null,
    account.access_token ?? null,
    account.expires_at ?? null,
    account.token_type ?? null,
    account.scope ?? null,
    account.id_token ?? null,
    a.session_state ?? null,
  ];
}

export function PgAdapter(pool: Pool): Adapter {
  return {
    async createUser(user): Promise<AdapterUser> {
      const res = await pool.query<UserRow>(
        `
          INSERT INTO users (name, email, email_verified, image)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, email, email_verified, image
        `,
        [user.name ?? null, user.email, user.emailVerified ?? null, user.image ?? null]
      );
      return mapUserRow(res.rows[0]);
    },

    async getUser(id): Promise<AdapterUser | null> {
      const res = await pool.query<UserRow>(
        `SELECT id, name, email, email_verified, image FROM users WHERE id = $1`,
        [id]
      );
      if (res.rowCount === 0) {
        return null;
      }
      return mapUserRow(res.rows[0]);
    },

    async getUserByEmail(email): Promise<AdapterUser | null> {
      const res = await pool.query<UserRow>(
        `SELECT id, name, email, email_verified, image FROM users WHERE email = $1`,
        [email]
      );
      if (res.rowCount === 0) {
        return null;
      }
      return mapUserRow(res.rows[0]);
    },

    async getUserByAccount(params): Promise<AdapterUser | null> {
      const res = await pool.query<UserRow>(
        `
          SELECT u.id, u.name, u.email, u.email_verified, u.image
          FROM accounts a
          JOIN users u ON u.id = a.user_id
          WHERE a.provider = $1 AND a.provider_account_id = $2
        `,
        [params.provider, params.providerAccountId]
      );
      if (res.rowCount === 0) {
        return null;
      }
      return mapUserRow(res.rows[0]);
    },

    async updateUser(user): Promise<AdapterUser> {
      if (!user.id) {
        throw new Error("updateUser requires user.id");
      }

      const res = await pool.query<UserRow>(
        `
          UPDATE users
          SET
            name = COALESCE($2, name),
            email = COALESCE($3, email),
            email_verified = COALESCE($4, email_verified),
            image = COALESCE($5, image)
          WHERE id = $1
          RETURNING id, name, email, email_verified, image
        `,
        [user.id, user.name ?? null, user.email ?? null, user.emailVerified ?? null, user.image ?? null]
      );

      return mapUserRow(res.rows[0]);
    },

    async deleteUser(userId): Promise<void> {
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    },

    async linkAccount(account): Promise<void> {
      await pool.query(
        `
          INSERT INTO accounts (
            user_id, type, provider, provider_account_id,
            refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (provider, provider_account_id) DO NOTHING
        `,
        mapAccountRowToInsert(account)
      );
    },

    async unlinkAccount(params): Promise<void> {
      await pool.query(
        `DELETE FROM accounts WHERE provider = $1 AND provider_account_id = $2`,
        [params.provider, params.providerAccountId]
      );
    },

    async createSession(session): Promise<AdapterSession> {
      const res = await pool.query<SessionRow>(
        `
          INSERT INTO sessions (session_token, user_id, expires)
          VALUES ($1, $2, $3)
          RETURNING session_token, user_id, expires
        `,
        [session.sessionToken, session.userId, session.expires]
      );
      return mapSessionRow(res.rows[0]);
    },

    async getSessionAndUser(sessionToken): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const res = await pool.query<SessionAndUserRow>(
        `
          SELECT
            s.session_token, s.user_id, s.expires,
            u.id as u_id, u.name as u_name, u.email as u_email, u.email_verified as u_email_verified, u.image as u_image
          FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.session_token = $1
        `,
        [sessionToken]
      );

      if (res.rowCount === 0) {
        return null;
      }

      const row = res.rows[0];

      const sessionOut: AdapterSession = {
        sessionToken: row.session_token,
        userId: String(row.user_id),
        expires: row.expires,
      };

      const userOut: AdapterUser = {
        id: String(row.u_id),
        name: row.u_name ?? null,
        email: row.u_email,
        emailVerified: row.u_email_verified ?? null,
        image: row.u_image ?? null,
      };

      return { session: sessionOut, user: userOut };
    },

    async updateSession(session): Promise<AdapterSession | null> {
      const res = await pool.query<SessionRow>(
        `
          UPDATE sessions
          SET
            expires = COALESCE($2, expires),
            user_id = COALESCE($3, user_id)
          WHERE session_token = $1
          RETURNING session_token, user_id, expires
        `,
        [session.sessionToken, session.expires ?? null, session.userId ?? null]
      );

      if (res.rowCount === 0) {
        return null;
      }
      return mapSessionRow(res.rows[0]);
    },

    async deleteSession(sessionToken): Promise<void> {
      await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [sessionToken]);
    },

    async createVerificationToken(token): Promise<VerificationToken> {
      const res = await pool.query(
        `
          INSERT INTO verification_tokens (identifier, token, expires)
          VALUES ($1, $2, $3)
          RETURNING identifier, token, expires
        `,
        [token.identifier, token.token, token.expires]
      );
      return res.rows[0] as VerificationToken;
    },

    async useVerificationToken(params): Promise<VerificationToken | null> {
      const res = await pool.query(
        `
          DELETE FROM verification_tokens
          WHERE identifier = $1 AND token = $2
          RETURNING identifier, token, expires
        `,
        [params.identifier, params.token]
      );

      if (res.rowCount === 0) {
        return null;
      }
      return res.rows[0] as VerificationToken;
    },
  };
}
