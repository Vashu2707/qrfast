import { cookies } from "next/headers";

export type Space = "restaurant" | "hotel";

const COOKIE_NAME = "space";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Marks which space (restaurant or hotel) the current Supabase session
 * signed in to. Read by the Supabase middleware to keep auth redirects
 * inside the same space and prevent cross-space redirect loops.
 */
export async function setSpace(space: Space) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, space, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSpace() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
