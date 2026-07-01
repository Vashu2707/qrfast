"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(data: {
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    return { error: "A category with this name already exists." };
  }
}

export async function updateCategory(
  id: string,
  data: { name: string; description?: string; sortOrder?: number }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteCategory(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    return { error: "Failed to delete category: " + error.message };
  }
}
