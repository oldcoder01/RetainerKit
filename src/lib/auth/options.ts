import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { getPool } from "@/lib/db";
import { PgAdapter } from "@/lib/auth/adapter";

function isNonEmpty(v: string | undefined): v is string {
  return Boolean(v && v.trim().length > 0);
}

export const authOptions: NextAuthOptions = {
  adapter: PgAdapter(getPool()),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(isNonEmpty(process.env.GITHUB_ID) && isNonEmpty(process.env.GITHUB_SECRET)
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            authorization: { params: { scope: "read:user user:email" } },
          }),
        ]
      : []),
    ...(isNonEmpty(process.env.GOOGLE_CLIENT_ID) && isNonEmpty(process.env.GOOGLE_CLIENT_SECRET)
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
