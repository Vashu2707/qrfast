"use server";

import prisma from "@/lib/prisma";

export async function getPublicMenu(slug: string, tableParam: string) {
  const tableNumber = tableParam.replace(/^table-/, "");

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
    include: {
      settings: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          menuItems: {
            where: { isAvailable: true },
            include: { variants: true, addons: true },
            orderBy: { name: "asc" },
          },
        },
      },
      menuItems: {
        where: { isAvailable: true },
        include: { variants: true, addons: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });

  if (!restaurant) return null;

  const table = await prisma.table.findUnique({
    where: {
      restaurantId_number: {
        restaurantId: restaurant.id,
        number: tableNumber,
      },
    },
  });

  if (!table) return null;

  const popularItems = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: { menuItem: { restaurantId: restaurant.id } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 8,
  });

  const popularIds = popularItems.map((p) => p.menuItemId);
  const bestsellers = popularIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: popularIds }, isAvailable: true },
        include: { variants: true, addons: true, category: true },
      })
    : [];

  const reviews = await prisma.review.findMany({
    where: { menuItem: { restaurantId: restaurant.id } },
    include: { menuItem: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    restaurant,
    table,
    bestsellers,
    newItems: restaurant.menuItems,
    reviews,
  };
}

export async function getPublicMenuItem(slug: string, itemId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isActive: true },
  });
  if (!restaurant) return null;

  return prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId: restaurant.id, isAvailable: true },
    include: { variants: true, addons: true, category: true, reviews: true },
  });
}
