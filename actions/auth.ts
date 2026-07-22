"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/roles";

export async function signIn(data: { email: string; password: string }) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to initialize auth: " + msg };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Auth service error: " + msg };
  }

  let user;
  try {
    user = await prisma.adminUser.findUnique({
      where: { id: authData.user.id },
    });
    if (!user) {
      return { error: "Staff account record not found in database." };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to fetch account info: " + msg };
  }

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to initialize auth: " + msg };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Auth service error: " + msg };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to create staff record: " + msg };
  }

  return { success: true };
  */
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Proceed with sign-out even if Supabase call fails
  }
  revalidatePath("/");
  return { success: true };
}

export async function forgotPassword(email: string) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to initialize auth: " + msg };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to send reset email: " + msg };
  }

  return { success: true };
}

export async function resetPassword(password: string) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to initialize auth: " + msg };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: "Failed to reset password: " + msg };
  }

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
