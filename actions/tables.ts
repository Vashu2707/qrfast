"use server";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";
import { createTableSchema } from "@/schemas";
import QRCode from "qrcode";
import { generateTableToken } from "@/lib/table-token";

export async function getTables() {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    return prisma.table.findMany({
      orderBy: { number: "asc" },
    });
  } catch {
    return [];
  }
}

export async function createTable(data: { number: string }) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = createTableSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

  if (!appUrl) {
    return { error: "NEXT_PUBLIC_APP_URL is not configured." };
  }

  try {
    const tableId = randomUUID();
    const token = generateTableToken(tableId);
    const qrTargetUrl = `${appUrl}/menu/${token}`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    const table = await prisma.table.create({
      data: {
        id: tableId,
        number: parsed.data.number,
        qrCodeUrl: qrCodeDataUrl,
      },
    });

    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    console.error("Table create failure:", error);
    return { error: "A table with this number already exists." };
  }
}

export async function deleteTable(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.table.delete({ where: { id } });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return { error: msg };
  }
}

export async function updateTableStatus(id: string, status: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const table = await prisma.table.update({
      where: { id },
      data: { status: status as any },
    });
    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
