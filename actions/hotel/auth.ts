"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma, { prismaWithRetry } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { checkRateLimit, getServerActionIp } from "@/lib/rate-limit";
import { touchSession, clearSession } from "@/lib/session";
import { setSpace, clearSpace } from "@/lib/space";
import { setTenantCookie, clearTenantCookie } from "@/lib/tenant";
import { setActiveTenant } from "@/lib/request-tenant";
import { HotelRole, type HotelUser } from "@prisma/client";

export async function hotelSignIn(data: { email: string; password: string }) {
  const ip = await getServerActionIp();
  const { allowed } = await checkRateLimit(`hotel-signin:${ip}`, 5, 60_000);
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

  let role: HotelRole;
  let tenantId: string;
  try {
    const hotelUser = await prisma.hotelUser.findUnique({
      where: { id: authData.user.id },
    });
    if (!hotelUser) {
      // A restaurant credential must never grant access to a hotel tenant.
      await supabase.auth.signOut();
      return { error: "Hotel account not found." };
    }
    role = hotelUser.role;
    tenantId = hotelUser.tenantId;
  } catch {
    return { error: "Failed to load account information. Please try again." };
  }

  await touchSession();
  await setSpace("hotel");
  await setTenantCookie({ id: tenantId, kind: "HOTEL" });
  return { success: true, role };
}

export async function hotelSignOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("hotelSignOut error:", error);
    return { error: "Failed to sign out. Please try again." };
  }
  await clearSession();
  await clearSpace();
  await clearTenantCookie();
  revalidatePath("/");
  return { success: true };
}

export async function hotelForgotPassword(email: string) {
  const ip = await getServerActionIp();
  const { allowed } = await checkRateLimit(`hotel-forgot:${ip}`, 3, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reset requests. Please try again later." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication service is unavailable. Please try again." };
  }

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
      redirectTo: `${appUrl}/hotel/reset-password`,
    });
    if (error) return { error: error.message };
  } catch {
    return { error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}

const getHotelDbUser = cache(async (userId: string) => {
  return prismaWithRetry(() =>
    prisma.hotelUser.findUnique({ where: { id: userId } })
  );
});

export async function getCurrentHotelUser(): Promise<HotelUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    // Only a HotelUser is authorized in the hotel space. A restaurant
    // credential must never inherit a hotel tenant.
    const dbUser = await getHotelDbUser(authUser.id);
    if (dbUser) {
      await setActiveTenant({ id: dbUser.tenantId, kind: "HOTEL" });
    }
    return dbUser;
  } catch (err) {
    unstable_rethrow(err);
    console.error("getCurrentHotelUser error:", err);
    return null;
  }
}
