"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/roles";
import { checkRateLimit, getServerActionIp } from "@/lib/rate-limit";
import { touchSession, clearSession, isSessionFresh } from "@/lib/session";
import { setSpace, clearSpace } from "@/lib/space";

export async function signIn(data: { email: string; password: string }) {
  const ip = await getServerActionIp();
  const { allowed, retryAfterMs } = checkRateLimit(`signin:${ip}`, 5, 60_000);
  if (!allowed) {
    return { error: "Too many login attempts. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  let authData;
  try {
    const result = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    authData = result.data;
    if (result.error || !authData.user) {
      return { error: result.error?.message || "Invalid credentials." };
    }
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  let user;
  try {
    user = await prisma.adminUser.findUnique({
      where: { id: authData.user.id },
    });
    if (!user) {
      // Not a restaurant credential — drop the session so a stray Supabase
      // login can't loop between /dashboard and /login.
      await supabase.auth.signOut();
      return { error: "Staff account not found." };
    }
  } catch {
    return { error: "Failed to load account information. Please try again." };
  }

  await touchSession();
  await setSpace("restaurant");
  return { success: true, role: user.role };
}

export async function signUp(data: {
  name: string;
  email: string;
  password: string;
}) {
  // Staff accounts must be provisioned by an existing administrator or
  // through Supabase administration; public signup must not grant admin access.
  return { error: "Public staff registration is disabled." };

  /*
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  let authData;
  try {
    const result = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { name: data.name } },
    });
    authData = result.data;
    if (result.error || !authData.user) {
      return { error: result.error?.message || "Failed to create account." };
    }
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  try {
    await prisma.adminUser.create({
      data: {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: "ADMIN",
      },
    });
  } catch {
    return { error: "Failed to create staff record. Please try again." };
  }

  return { success: true };
  */
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("signOut error:", error);
    return { error: "Failed to sign out. Please try again." };
  }
  await clearSession();
  await clearSpace();
  revalidatePath("/");
  return { success: true };
}

export async function forgotPassword(email: string) {
  const ip = await getServerActionIp();
  const { allowed, retryAfterMs } = checkRateLimit(`forgot:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reset requests. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  // Use the configured app URL — never derive from the Host header to prevent
  // host header injection attacks.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? undefined // force configuration in production
      : "http://localhost:3000");

  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set in production.");
    return { error: "Server configuration error. Please contact support." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (error) return { error: error.message };
  } catch {
    return { error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}

export async function resetPassword(password: string, code?: string) {
  const ip = await getServerActionIp();
  const { allowed } = checkRateLimit(`reset:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reset attempts. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

  if (code) {
    // The email link lands on the reset page with ?code= (PKCE). Exchange it
    // here — no browser Supabase client exists to consume it — so the recovery
    // session is written to the same cookie jar signIn() uses.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Retrying resends the same, now-redeemed code. Fall back to the session
      // the first exchange created, but only when it is fresh (touchSession
      // below marks it so) — never to a stale pre-existing session.
      const fresh = await isSessionFresh();
      if (!fresh.fresh) {
        return {
          error:
            error.code === "pkce_code_verifier_not_found"
              ? "This reset link only works in the browser it was requested from. Please request a new link and open it here."
              : "This reset link has expired or was already used. Please request a new one.",
        };
      }
    } else {
      await touchSession();
    }
  } else {
    // No recovery code in the URL (expired or invalid link): allow only
    // callers that already proved a fresh session.
    const fresh = await isSessionFresh();
    if (!fresh.fresh) {
      return {
        error: "This reset link is invalid or has expired. Please request a new one.",
      };
    }
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch {
    return { error: "Failed to reset password. Please try again." };
  }

  // End the recovery session: the new password applies at the next sign-in,
  // and a session-less form on /login can't bounce against the activity gate.
  try {
    await supabase.auth.signOut();
    await clearSession();
  } catch (error) {
    // signOut() removes the local session on every path it returns from; if
    // it throws instead, keep the activity cookie fresh so the surviving
    // session can't loop between /login and /dashboard.
    console.error("resetPassword signOut error:", error);
    await touchSession();
  }
  await clearSpace();
  revalidatePath("/");
  return { success: true };
}

const getDbUser = cache(async (userId: string) => {
  return prismaWithRetry(() =>
    prisma.adminUser.findUnique({ where: { id: userId } })
  );
});

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    const dbUser = await getDbUser(authUser.id);
    return dbUser;
  } catch (err) {
    unstable_rethrow(err);
    console.error("getCurrentUser error:", err);
    return null;
  }
}
