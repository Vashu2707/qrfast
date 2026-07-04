import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/kitchen", "/cashier"];
const authRoutes = ["/login", "/signup", "/forgot-password"];

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const match = url.match(/https:\/\/(.+)\.supabase\.co/);
  return match ? match[1] : "";
}

function hasSessionCookie(request: NextRequest): boolean {
  const projectRef = getProjectRef();
  if (!projectRef) return false;
  return request.cookies.has(`sb-${projectRef}-auth-token`);
}

export async function updateSession(request: NextRequest) {
  const hasSession = hasSessionCookie(request);
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const isAuthRoute = authRoutes.some((p) => pathname.startsWith(p));

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
