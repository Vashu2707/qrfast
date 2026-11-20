import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPrefixes = ["/dashboard", "/kitchen", "/hotel/dashboard"];
const authRoutes = [
  "/login",
  "/forgot-password",
  "/hotel/login",
  "/hotel/forgot-password",
];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const isAuthRoute = authRoutes.some((p) => pathname.startsWith(p));

  // Which space does this path belong to (hotel space lives under /hotel)?
  const isHotelPath = pathname.startsWith("/hotel");
  // Which space did the current session sign in to? Set by signIn/hotelSignIn.
  const space = request.cookies.get("space")?.value;

  // Only run Supabase session check when the route requires it
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() is the only method that validates the JWT with Supabase Auth server.
  // Do NOT use getSession() here — it only reads the local cookie without verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = isHotelPath ? "/hotel/login" : "/login";
    // Only allow same-origin redirect targets
    const redirect = pathname;
    url.searchParams.set("redirect", redirect);
    return NextResponse.redirect(url);
  }

  if (isProtected && user) {
    // A session signed in to one space must not reach the other space's
    // protected routes (missing space cookie = legacy restaurant session).
    const pathSpace = isHotelPath ? "hotel" : "restaurant";
    const sessionSpace = space === "hotel" ? "hotel" : "restaurant";
    if (pathSpace !== sessionSpace) {
      const url = request.nextUrl.clone();
      url.pathname =
        sessionSpace === "hotel" ? "/hotel/dashboard" : "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (isAuthRoute && user) {
    // Only bounce authenticated users into the space they signed in to.
    // This keeps a restaurant session off /hotel/dashboard (and vice versa)
    // without redirect-looping between a section's login and dashboard.
    const target = isHotelPath
      ? space === "hotel"
        ? "/hotel/dashboard"
        : null
      : space === "hotel"
        ? null
        : "/dashboard";
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
  }

  return response;
}
