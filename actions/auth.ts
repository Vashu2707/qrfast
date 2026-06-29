"use server";

import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

export async function signUpRestaurant(data: any) {
  const supabase = await createClient();

  // 1. Register in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        name: data.name,
      },
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Failed to create authentication user." };
  }

  const userId = authData.user.id;

  try {
    // 2. Insert records inside a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const slug = data.restaurantSlug.toLowerCase().trim();
      
      const existingRestaurant = await tx.restaurant.findUnique({
        where: { slug },
      });

      if (existingRestaurant) {
        throw new Error("This URL slug is already taken. Please choose another.");
      }

      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug,
          email: data.email,
        },
      });

      await tx.settings.create({
        data: {
          restaurantId: restaurant.id,
          primaryColor: "#E11D48", // Default Rose theme
        },
      });

      const user = await tx.user.create({
        data: {
          id: userId,
          email: data.email,
          name: data.name,
          role: Role.ADMIN,
          restaurantId: restaurant.id,
        },
      });

      // Seed a default Table 1
      await tx.table.create({
        data: {
          number: "1",
          restaurantId: restaurant.id,
          qrCodeUrl: `/menu/${slug}/table-1`,
        },
      });

      return { restaurant, user };
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error("Signup Database Transaction Failure:", error);
    return { error: error.message || "Failed to finalize database registration." };
  }
}

export async function signIn(data: any) {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

  if (authError || !authData.user) {
    return { error: authError?.message || "Invalid credentials." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authData.user.id },
      include: {
        restaurant: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!user) {
      return { error: "Staff account record not found in database." };
    }

    return { success: true, user };
  } catch (error: any) {
    return { error: "Failed to fetch account info: " + error.message };
  }
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

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        restaurant: {
          include: {
            settings: true,
          },
        },
      },
    });

    return dbUser;
  } catch (err) {
    unstable_rethrow(err);
    console.error("getCurrentUser error:", err);
    return null;
  }
}
