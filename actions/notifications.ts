"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    return prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  } catch {
    return { error: "Failed to mark notification as read." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function clearAllNotifications() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.notification.deleteMany({});
  } catch {
    return { error: "Failed to clear notifications." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  if (!user) return 0;

  try {
    return prisma.notification.count({
      where: { isRead: false },
    });
  } catch {
    return 0;
  }
}
