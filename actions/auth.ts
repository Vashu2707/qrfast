"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/roles";

export async function signIn(data: { email: string; password: string }) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: any) {
    return { error: "Failed to initialize auth: " + error.message };
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
  } catch (error: any) {
    return { error: "Auth service error: " + error.message };
  }

  let user;
  try {
    user = await prisma.adminUser.findUnique({
      where: { id: authData.user.id },
    });

    if (!user) {
      return { error: "Staff account record not found in database." };
    }
  } catch (error: any) {
    return { error: "Failed to fetch account info: " + error.message };
  }

  return { success: true, role: user.role };
}

export async function signUp(data: { name: string; email: string; password: string }) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: any) {
    return { error: "Failed to initialize auth: " + error.message };
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
  } catch (error: any) {
    return { error: "Auth service error: " + error.message };
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
  } catch (error: any) {
    return { error: "Failed to create staff record: " + error.message };
  }

  return { success: true };
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
  } catch (error: any) {
    return { error: "Failed to initialize auth: " + error.message };
  }

  let host = "localhost:3000";
  try {
    host = (await headers()).get("host") || "localhost:3000";
  } catch {
    // Use default if headers unavailable
  }

  const protocol = process.env.NODE_ENV === "production" || host !== "localhost:3000" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    if (error) return { error: error.message };
  } catch (error: any) {
    return { error: "Failed to send reset email: " + error.message };
  }

  return { success: true };
}

export async function resetPassword(password: string) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error: any) {
    return { error: "Failed to initialize auth: " + error.message };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (error: any) {
    return { error: "Failed to reset password: " + error.message };
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
