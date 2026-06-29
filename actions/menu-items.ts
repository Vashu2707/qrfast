"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getMenuItems() {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) throw new Error("Unauthorized");

  return prisma.menuItem.findMany({
    where: { restaurantId: user.restaurantId },
    include: {
      category: true,
      variants: true,
      addons: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMenuItem(data: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const menuItem = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          discountPrice: data.discountPrice ? parseFloat(data.discountPrice) : null,
          isVeg: data.isVeg,
          spicyLevel: parseInt(data.spicyLevel),
          preparationTime: parseInt(data.preparationTime),
          images: data.images || [],
          ingredients: data.ingredients || [],
          allergens: data.allergens || [],
          nutrition: data.nutrition || null,
          categoryId: data.categoryId,
          restaurantId: user.restaurantId!,
        },
      });

      if (data.variants && data.variants.length > 0) {
        await tx.variant.createMany({
          data: data.variants.map((v: any) => ({
            menuItemId: item.id,
            name: v.name,
            price: parseFloat(v.price),
          })),
        });
      }

      if (data.addons && data.addons.length > 0) {
        await tx.addon.createMany({
          data: data.addons.map((a: any) => ({
            menuItemId: item.id,
            name: a.name,
            price: parseFloat(a.price),
            isVeg: a.isVeg !== undefined ? a.isVeg : true,
          })),
        });
      }

      return item;
    });

    revalidatePath("/dashboard/menu");
    return { success: true, menuItem };
  } catch (error: any) {
    console.error("Create MenuItem Error:", error);
    return { error: error.message || "Failed to create menu item." };
  }
}

export async function updateMenuItem(id: string, data: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const menuItem = await prisma.$transaction(async (tx) => {
      // 1. Update the base item
      const item = await tx.menuItem.update({
        where: { id, restaurantId: user.restaurantId! },
        data: {
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          discountPrice: data.discountPrice ? parseFloat(data.discountPrice) : null,
          isVeg: data.isVeg,
          spicyLevel: parseInt(data.spicyLevel),
          preparationTime: parseInt(data.preparationTime),
          images: data.images || [],
          ingredients: data.ingredients || [],
          allergens: data.allergens || [],
          nutrition: data.nutrition || null,
          categoryId: data.categoryId,
        },
      });

      // 2. Clear old variants and addons
      await tx.variant.deleteMany({ where: { menuItemId: id } });
      await tx.addon.deleteMany({ where: { menuItemId: id } });

      // 3. Insert new variants and addons
      if (data.variants && data.variants.length > 0) {
        await tx.variant.createMany({
          data: data.variants.map((v: any) => ({
            menuItemId: id,
            name: v.name,
            price: parseFloat(v.price),
          })),
        });
      }

      if (data.addons && data.addons.length > 0) {
        await tx.addon.createMany({
          data: data.addons.map((a: any) => ({
            menuItemId: id,
            name: a.name,
            price: parseFloat(a.price),
            isVeg: a.isVeg !== undefined ? a.isVeg : true,
          })),
        });
      }

      return item;
    });

    revalidatePath("/dashboard/menu");
    return { success: true, menuItem };
  } catch (error: any) {
    console.error("Update MenuItem Error:", error);
    return { error: error.message || "Failed to update menu item." };
  }
}

export async function deleteMenuItem(id: string) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    await prisma.menuItem.delete({
      where: { id, restaurantId: user.restaurantId },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    return { error: "Failed to delete menu item: " + error.message };
  }
}

export async function toggleMenuItemAvailability(id: string, isAvailable: boolean) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    await prisma.menuItem.update({
      where: { id, restaurantId: user.restaurantId },
      data: { isAvailable },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
