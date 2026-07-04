"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getDefaultRouteForRole } from "@/lib/roles";

export async function signIn(data: { email: string; password: string }) {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

  if (authError || !authData.user) {
    return { error: authError?.message || "Invalid credentials." };
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
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { name: data.name } },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Failed to create account." };
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
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  return { success: true };
}

export async function forgotPassword(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function resetPassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
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
