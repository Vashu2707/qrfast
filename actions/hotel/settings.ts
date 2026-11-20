"use server";

import prisma from "@/lib/prisma";
import { requireHotelAdmin, requireHotelStaff } from "@/lib/hotel-roles";
import { hotelSettingsSchema, type HotelSettingsInput } from "@/schemas/hotel";
import { convertDecimalsDeep } from "@/lib/decimal";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { requireTenant } from "@/lib/tenant";

export async function getHotelSettings() {
  const user = await requireHotelStaff();
  if (!user) return null;
  const { id: tenantId } = await requireTenant("HOTEL");

  try {
    let settings = await prisma.hotelSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await prisma.hotelSettings.upsert({
        where: { tenantId },
        update: {},
        create: { id: randomUUID(), tenantId },
      });
    }
    return convertDecimalsDeep(settings);
  } catch {
    return null;
  }
}

export async function updateHotelSettings(rawData: HotelSettingsInput) {
  const user = await requireHotelAdmin();
  if (!user) return { error: "Unauthorized" };
  const { id: tenantId } = await requireTenant("HOTEL");

  const parsed = hotelSettingsSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const jsonFields = {
      openingHours:
        parsed.data.openingHours != null
          ? (parsed.data.openingHours as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      socialLinks:
        parsed.data.socialLinks != null
          ? (parsed.data.socialLinks as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    };
    const settings = await prisma.hotelSettings.upsert({
      where: { tenantId },
      update: { ...parsed.data, ...jsonFields },
      create: { id: randomUUID(), tenantId, ...parsed.data, ...jsonFields },
    });
    revalidatePath("/hotel/dashboard/settings");
    return { success: true, settings: convertDecimalsDeep(settings) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
