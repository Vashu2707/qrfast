"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { toNumber } from "@/lib/decimal";
import { dateKeyInTz, startOfDayInTz, todayInTz } from "@/lib/timezone";

const emptyStats = { todayOrders: 0, pendingOrders: 0, completedToday: 0, todayRevenue: 0, totalTables: 0, occupiedTables: 0, topItems: [] as { item: any; quantity: number }[], chartData: [] as { date: string; revenue: number }[], totalRevenue: 0, avgOrderValue: 0 };

export async function getDashboardStats() {
  const user = await requireAdmin();
  if (!user) return { ...emptyStats };

  try {
    // Every "today" figure and every chart bucket must use the restaurant's
    // calendar day — not the server's local day or UTC — or the cards and
    // chart disagree for the hours around midnight.
    const settings = await prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { timezone: true },
    });
    const tz = settings?.timezone;
    const todayStart = startOfDayInTz(todayInTz(tz), tz);

    const [
      todayOrders,
      pendingOrders,
      completedToday,
      todayRevenue,
      paidOrdersToday,
      totalTables,
      occupiedTables,
      allOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.PREPARED, OrderStatus.READY] },
        },
      }),
      prisma.order.count({
        where: { status: OrderStatus.COMPLETED, createdAt: { gte: todayStart } },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
      }),
      // Average order value must use the same paid population as the revenue
      // above — including unpaid/cancelled orders deflated it.
      prisma.order.count({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          createdAt: { gte: todayStart },
        },
      }),
      prisma.table.count(),
      prisma.table.count({ where: { status: "OCCUPIED" } }),
      prisma.order.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { totalAmount: true, createdAt: true, paymentStatus: true },
      }),
    ]);

    const popularItems = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const menuItemIds = popularItems.map((p) => p.menuItemId);
    const menuItems = menuItemIds.length
      ? await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } })
      : [];

    const topItems = popularItems.map((p) => ({
      item: menuItems.find((m) => m.id === p.menuItemId),
      quantity: p._sum.quantity || 0,
    }));

    const salesByDay: Record<string, { label: string; revenue: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart.getTime() - i * 86_400_000);
      const key = dateKeyInTz(dayStart, tz);
      salesByDay[key] = {
        label: dayStart.toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: tz || undefined,
        }),
        revenue: 0,
      };
    }
    allOrders
      .filter((o) => o.paymentStatus === PaymentStatus.SUCCESS)
      .forEach((o) => {
        const key = dateKeyInTz(o.createdAt, tz);
        if (salesByDay[key] !== undefined) {
          salesByDay[key].revenue += toNumber(o.totalAmount);
        }
      });

    const chartData = Object.entries(salesByDay).map(([, day]) => ({
      date: day.label,
      revenue: day.revenue,
    }));

    const totalRevenue = allOrders
      .filter((o) => o.paymentStatus === PaymentStatus.SUCCESS)
      .reduce((s, o) => s + toNumber(o.totalAmount), 0);

    // Paid revenue / paid orders — dividing by all orders (unpaid, cancelled)
    // made "average order value" meaningless.
    const avgOrderValue =
      paidOrdersToday > 0
        ? toNumber(todayRevenue._sum.totalAmount) / paidOrdersToday
        : 0;

    return {
      todayOrders,
      pendingOrders,
      completedToday,
      todayRevenue: toNumber(todayRevenue._sum.totalAmount),
      totalTables,
      occupiedTables,
      topItems,
      chartData,
      totalRevenue,
      avgOrderValue,
    };
  } catch {
    return { ...emptyStats };
  }
}

function csvSafeField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : `"${escaped}"`;
}

export async function exportOrdersCSV() {
  const user = await requireAdmin();
  if (!user) return "";

  try {
    const orders = await prisma.order.findMany({
      include: { table: true },
      orderBy: { createdAt: "desc" },
    });

    const header = "Order ID,Table,Customer,Phone,Status,Payment,Total,Date\n";
    const rows = orders
      .map(
        (o) =>
          `${o.id},${o.table.number},${csvSafeField(o.customerName)},${o.customerPhone},${o.status},${o.paymentStatus},${o.totalAmount},${o.createdAt.toISOString()}`
      )
      .join("\n");

    return header + rows;
  } catch {
    return "";
  }
}
