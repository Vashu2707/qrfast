"use server";

import prisma from "@/lib/prisma";
import { verifyTableToken } from "@/lib/table-token";
import { convertDecimalsDeep } from "@/lib/decimal";

const categoryInclude = {
  menuItems: {
    where: { isAvailable: true },
    include: { variants: true, addons: true },
    orderBy: { name: "asc" as const },
  },
  children: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      menuItems: {
        where: { isAvailable: true },
        include: { variants: true, addons: true },
        orderBy: { name: "asc" as const },
      },
    },
  },
};

export async function getPublicMenu(tableParam: string) {
  const tableId = verifyTableToken(tableParam);
  if (!tableId) return null;

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) return null;

  // Food menu — always returned. Cocktail categories are a completely separate
  // tree and are only exposed when the restaurant enables the bar section.
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    where: { parentId: null, section: "FOOD" },
    include: categoryInclude,
  });

  const cocktailCategories = settings.cocktailsEnabled
    ? await prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        where: { parentId: null, section: "COCKTAIL" },
        include: categoryInclude,
      })
    : [];

  const table = await prisma.table.findUnique({
    where: { id: tableId },
  });

  if (!table) return null;

  const popularItems = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });

  const popularIds = popularItems.map((p) => p.menuItemId);
  const bestsellers = popularIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: popularIds }, isAvailable: true, category: { section: "FOOD" } },
        include: { variants: true, addons: true, category: true },
      })
    : [];

  const newItems = await prisma.menuItem.findMany({
    where: { isAvailable: true, category: { section: "FOOD" } },
    include: { variants: true, addons: true, category: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const reviews = await prisma.review.findMany({
    include: { menuItem: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return convertDecimalsDeep({
    restaurant: settings,
    table,
    categories,
    cocktailCategories,
    bestsellers,
    newItems,
    reviews,
  }) as any;
}

export async function getPublicMenuItem(itemId: string) {
  return prisma.menuItem.findFirst({
    where: { id: itemId, isAvailable: true },
    include: { variants: true, addons: true, category: true, reviews: true },
  });
}
