"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  if (!user) return 0;

  return prisma.notification.count({
    where: { isRead: false },
  });
}
