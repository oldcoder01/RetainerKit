type CookieGetter = {
  get: (name: string) => { value: string } | undefined;
};

type CookieSetter = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax" | "strict" | "none";
      path: string;
      expires: Date;
      secure?: boolean;
    }
  ) => void;
};

type CookieResponseLike = {
  cookies: CookieSetter;
};

export function getSessionTokenFromCookies(cookieStore: CookieGetter): string | null {
  const secure = cookieStore.get("__Secure-next-auth.session-token")?.value;
  if (secure && secure.length > 0) {
    return secure;
  }

  const normal = cookieStore.get("next-auth.session-token")?.value;
  if (normal && normal.length > 0) {
    return normal;
  }

  return null;
}

export function clearSessionCookies(res: CookieResponseLike) {
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  };

  res.cookies.set("next-auth.session-token", "", opts);
  res.cookies.set("__Secure-next-auth.session-token", "", opts);
}
