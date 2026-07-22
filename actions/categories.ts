"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(data: {
  name: string;
  description?: string;
  sortOrder?: number;
  parentId?: string | null;
}) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    const category = await prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        parentId: data.parentId || null,
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "A category with this name already exists in this location." };
    }
    return { error: error.message };
  }
}

export async function updateCategory(
  id: string,
  data: { name?: string; description?: string; sortOrder?: number; parentId?: string | null }
) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    if (data.parentId === id) return { error: "A category cannot be its own parent." };

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.parentId !== undefined && { parentId: data.parentId || null }),
      },
    });
    revalidatePath("/dashboard/menu");
    return { success: true, category };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { error: "A category with this name already exists in this location." };
    }
    return { error: error.message };
  }
}

export async function deleteCategory(id: string) {
  const user = await requireAdmin();
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
