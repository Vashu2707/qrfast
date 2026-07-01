"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  return settings;
}

export async function updateRestaurantSettings(data: any) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const settings = await prisma.settings.update({
      where: { id: "singleton" },
      data: {
        restaurantName: data.restaurantName,
        logo: data.logo || null,
        banner: data.banner || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        primaryColor: data.primaryColor || "#E11D48",
        currency: data.currency || "INR",
        timezone: data.timezone || "Asia/Kolkata",
        gstNumber: data.gstNumber || null,
        gstPercentage: parseFloat(data.gstPercentage || 0),
        serviceChargePercentage: parseFloat(data.serviceChargePercentage || 0),
        openingHours: data.openingHours || null,
        socialLinks: data.socialLinks || null,
      },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, settings };
  } catch (error: any) {
    console.error("Settings update failure:", error);
    return { error: error.message || "Failed to update settings." };
  }
}
