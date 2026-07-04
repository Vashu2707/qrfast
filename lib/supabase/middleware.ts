import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseSessionFromCookies } from "./middleware-auth";

const protectedPrefixes = ["/dashboard", "/kitchen", "/cashier"];
const authRoutes = ["/login", "/signup", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  const session = getSupabaseSessionFromCookies(request);
  const user = session?.user ?? null;
  const response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const isAuthRoute = authRoutes.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
