import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { LinkProviders } from "@/components/LinkProviders";
import { cookies } from "next/headers";
import { getSessionTokenFromCookies } from "@/lib/auth/session-cookie";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified: Date | null;
  image: string | null;
  created_at: Date;
  password_hash: string | null;
};

type AccountRow = {
  provider: string;
  provider_account_id: string;
  created_at: Date;
};

type SessionRow = {
  expires: Date;
  created_at: Date;
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const pool = getPool();

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  let user: UserRow | null = null;

  if (userId) {
    const res = await pool.query<UserRow>(
      `SELECT id, name, email, email_verified, image, created_at, password_hash FROM users WHERE id = $1`,
      [userId]
    );
    user = res.rowCount ? res.rows[0] : null;
  } else if (email) {
    const res = await pool.query<UserRow>(
      `SELECT id, name, email, email_verified, image, created_at, password_hash FROM users WHERE email = $1`,
      [email]
    );
    user = res.rowCount ? res.rows[0] : null;
  }

  const accountsRes = user
    ? await pool.query<AccountRow>(
        `SELECT provider, provider_account_id, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.id]
      )
    : { rows: [] as AccountRow[] };

  const cookieStore = await cookies();
  const token = getSessionTokenFromCookies(cookieStore);

  const sessRes = token
    ? await pool.query<SessionRow>(
        `SELECT expires, created_at FROM sessions WHERE session_token = $1`,
        [token]
      )
    : { rows: [] as SessionRow[] };

  const currentSession = sessRes.rows.length ? sessRes.rows[0] : null;

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Account</h2>
          <p className="text-sm text-base-content/70">
            Account summary, linked providers, and current session info.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <h3 className="font-semibold">User</h3>
            {user ? (
              <div className="rounded bg-base-200 p-4 font-mono text-sm">
                <div>id: {user.id}</div>
                <div>email: {user.email}</div>
                <div>name: {user.name ?? "n/a"}</div>
                <div>created_at: {new Date(user.created_at).toLocaleString()}</div>
                <div>email_verified: {user.email_verified ? new Date(user.email_verified).toLocaleString() : "n/a"}</div>
                <div>has_password: {user.password_hash ? "yes" : "no"}</div>
              </div>
            ) : (
              <p className="text-sm text-base-content/70">User record not found.</p>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <h3 className="font-semibold">Session</h3>
            {currentSession ? (
              <div className="rounded bg-base-200 p-4 font-mono text-sm">
                <div>expires: {new Date(currentSession.expires).toLocaleString()}</div>
                <div>created_at: {new Date(currentSession.created_at).toLocaleString()}</div>
              </div>
            ) : (
              <p className="text-sm text-base-content/70">No session row found for current cookie (unexpected).</p>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-3">
          <h3 className="font-semibold">Linked providers</h3>

          {accountsRes.rows.length === 0 ? (
            <p className="text-sm text-base-content/70">No providers linked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Provider account id</th>
                    <th>Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsRes.rows.map((a) => (
                    <tr key={`${a.provider}:${a.provider_account_id}`}>
                      <td className="font-medium">{a.provider}</td>
                      <td className="font-mono text-sm">{a.provider_account_id}</td>
                      <td className="text-sm text-base-content/70">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="divider">Link more</div>
          <LinkProviders />
        </div>
      </div>
    </div>
  );
}
