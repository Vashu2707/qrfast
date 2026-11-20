"use server";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTableSchema } from "@/schemas";
import QRCode from "qrcode";
import { generateTableToken } from "@/lib/table-token";
import { TableStatus } from "@prisma/client";

export async function getTables() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  try {
    return prisma.table.findMany({
      orderBy: { number: "asc" },
    });
  } catch (error) {
    console.error("getTables failed:", error);
    throw new Error("Could not load tables. Please try again.");
  }
}

function getQrConfig(): { appUrl: string } | { error: string } {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");
  if (!appUrl) return { error: "NEXT_PUBLIC_APP_URL is not configured." };
  if (!process.env.TABLE_TOKEN_SECRET || process.env.TABLE_TOKEN_SECRET.length < 16) {
    return {
      error:
        "TABLE_TOKEN_SECRET is not configured on the server. Please add it to your environment variables.",
    };
  }
  return { appUrl };
}

async function buildTableQr(tableId: string, generation: number, appUrl: string) {
  const token = generateTableToken(tableId, { generation });
  return QRCode.toDataURL(`${appUrl}/menu/${token}`, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function createTable(data: { number: string }) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = createTableSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  const config = getQrConfig();
  if ("error" in config) return { error: config.error };

  try {
    const tableId = randomUUID();
    // New tables start at generation 1 (the schema default).
    const qrCodeDataUrl = await buildTableQr(tableId, 1, config.appUrl);

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Table create failure:", msg);
    if (msg.includes("Unique constraint")) {
      return { error: "A table with this number already exists." };
    }
    return { error: `Failed to create table: ${msg}` };
  }
}

/**
 * Invalidate a table's printed QR (e.g. after it was photographed) without
 * disrupting other tables. Bump the generation first, then print a token for
 * that exact generation; old tokens fail verifyActiveTableToken immediately.
 */
export async function rotateTableToken(tableId: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  // Check config before incrementing — a misconfigured server must not leave
  // the table with an invalid QR and no replacement.
  const config = getQrConfig();
  if ("error" in config) return { error: config.error };

  try {
    const updated = await prisma.table.update({
      where: { id: tableId },
      data: { tokenGeneration: { increment: 1 } },
      select: { tokenGeneration: true },
    });
    const qrCodeDataUrl = await buildTableQr(tableId, updated.tokenGeneration, config.appUrl);
    await prisma.table.update({
      where: { id: tableId },
      data: { qrCodeUrl: qrCodeDataUrl },
    });

    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Table QR rotation failure:", msg);
    return { error: `Failed to regenerate QR code: ${msg}` };
  }
}

export async function deleteTable(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    // Order.tableId is ON DELETE RESTRICT — refuse here with a clear message
    // instead of a raw FK error. Deleting a table would otherwise wipe its
    // entire order/payment/invoice history.
    const orderCount = await prisma.order.count({ where: { tableId: id } });
    if (orderCount > 0) {
      return {
        error: `Cannot delete: this table has ${orderCount} order${orderCount > 1 ? "s" : ""} in its history. Order history is preserved.`,
      };
    }

    await prisma.table.delete({ where: { id } });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return { error: msg };
  }
}

export async function updateTableStatus(id: string, status: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  if (!Object.values(TableStatus).includes(status as TableStatus)) {
    return { error: "Invalid table status." };
  }

  try {
    const table = await prisma.table.update({
      where: { id },
      data: { status: status as TableStatus },
    });
    revalidatePath("/dashboard/tables");
    return { success: true, table };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
