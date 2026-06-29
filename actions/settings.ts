"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) throw new Error("Unauthorized");

  const settings = await prisma.settings.findUnique({
    where: { restaurantId: user.restaurantId },
  });

  return settings;
}

export async function updateRestaurantSettings(data: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Restaurant base details
      const restaurant = await tx.restaurant.update({
        where: { id: user.restaurantId! },
        data: {
          name: data.restaurantName,
          address: data.address,
          phone: data.phone,
          email: data.email,
          logo: data.logo || null,
          banner: data.banner || null,
        },
      });

      // 2. Update settings details
      const settings = await tx.settings.update({
        where: { restaurantId: user.restaurantId! },
        data: {
          primaryColor: data.primaryColor || "#E11D48",
          currency: data.currency || "INR",
          timezone: data.timezone || "Asia/Kolkata",
          gstNumber: data.gstNumber || null,
          gstPercentage: parseFloat(data.gstPercentage || 0),
          serviceChargePercentage: parseFloat(data.serviceChargePercentage || 0),
          businessHours: data.businessHours || null,
        },
      });

      return { restaurant, settings };
    });

    revalidatePath("/dashboard/settings");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Settings update failure:", error);
    return { error: error.message || "Failed to update settings." };
  }
}
