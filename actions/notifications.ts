"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user?.restaurantId) throw new Error("Unauthorized");

  return prisma.notification.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user?.restaurantId) return { error: "Unauthorized" };

  await prisma.notification.update({
    where: { id, restaurantId: user.restaurantId },
    data: { isRead: true },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user?.restaurantId) return { error: "Unauthorized" };

  await prisma.notification.updateMany({
    where: { restaurantId: user.restaurantId, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getUnreadNotificationCount() {
  const user = await getCurrentUser();
  if (!user?.restaurantId) return 0;

  return prisma.notification.count({
    where: { restaurantId: user.restaurantId, isRead: false },
  });
}
