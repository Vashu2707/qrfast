"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

export async function getTables() {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) throw new Error("Unauthorized");

  return prisma.table.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: { number: "asc" },
  });
}

export async function createTable(data: { number: string }) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId || !user.restaurant) {
    return { error: "Unauthorized" };
  }

  try {
    const slug = user.restaurant.slug;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrTargetUrl = `${appUrl}/menu/${slug}/table-${data.number}`;

    // Generate high-quality QR code data URL (Base64 PNG)
    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const table = await prisma.table.create({
      data: {
        number: data.number,
        restaurantId: user.restaurantId,
        qrCodeUrl: qrCodeDataUrl,
      },
    });

    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: any) {
    console.error("Table create failure:", error);
    return { error: "A table with this number already exists in this restaurant." };
  }
}

export async function deleteTable(id: string) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    await prisma.table.delete({
      where: { id, restaurantId: user.restaurantId },
    });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateTableStatus(id: string, status: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const table = await prisma.table.update({
      where: { id, restaurantId: user.restaurantId },
      data: { status },
    });
    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: any) {
    return { error: error.message };
  }
}
