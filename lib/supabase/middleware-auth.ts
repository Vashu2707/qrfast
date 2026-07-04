import { NextRequest } from "next/server";

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const match = url.match(/https:\/\/(.+)\.supabase\.co/);
  return match ? match[1] : "";
}

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id: string; email?: string };
};

function parseSession(cookieValue: string): SupabaseSession | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue));
    if (parsed?.access_token) return parsed as SupabaseSession;
    return null;
  } catch {
    const payload = decodeJWTPayload(cookieValue);
    if (payload?.sub) {
      return {
        access_token: cookieValue,
        user: { id: payload.sub as string, email: payload.email as string },
        expires_at: payload.exp as number,
      };
    }
    return null;
  }
}

function isExpired(session: SupabaseSession): boolean {
  if (session.expires_at) {
    return session.expires_at * 1000 < Date.now();
  }
  const payload = decodeJWTPayload(session.access_token);
  if (payload?.exp) {
    return (payload.exp as number) * 1000 < Date.now();
  }
  return true;
}

export function getSupabaseSessionFromCookies(
  request: NextRequest
): SupabaseSession | null {
  const projectRef = getProjectRef();
  if (!projectRef) return null;

  const cookieName = `sb-${projectRef}-auth-token`;
  const cookie = request.cookies.get(cookieName);
  if (!cookie?.value) return null;

  const session = parseSession(cookie.value);
  if (!session) return null;
  if (isExpired(session)) return null;

  return session;
}
