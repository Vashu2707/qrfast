"use server";

import prisma from "@/lib/prisma";
import { requireHotelStaff } from "@/lib/hotel-roles";
import { BLOCKED_BOOKING_STATUSES, parseDateOnly, todayInTz } from "@/lib/hotel";
import { money } from "@/lib/decimal";
import { BookingStatus, HotelPaymentStatus } from "@prisma/client";

export interface HotelUpcomingBooking {
  id: string;
  referenceCode: string;
  guestName: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  totalAmount: number;
}

interface HotelStats {
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  pendingBookings: number;
  monthRevenue: number;
  statusCounts: {
    PENDING: number;
    CONFIRMED: number;
    CHECKED_IN: number;
    CHECKED_OUT: number;
    CANCELLED: number;
    NO_SHOW: number;
  };
  upcomingBookings: HotelUpcomingBooking[];
}

const emptyStats: HotelStats = {
  arrivalsToday: 0,
  departuresToday: 0,
  inHouse: 0,
  totalRooms: 0,
  occupiedRooms: 0,
  occupancyRate: 0,
  pendingBookings: 0,
  monthRevenue: 0,
  statusCounts: {
    PENDING: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
    CHECKED_OUT: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  },
  upcomingBookings: [],
};

export async function getHotelDashboardStats() {
  const user = await requireHotelStaff();
  if (!user) return { ...emptyStats };

  // Arrivals/departures/upcoming/month-start target the HOTEL's calendar day,
  // not the server's (server tz may differ from the property's).
  const hotelSettings = await prisma.hotelSettings.findUnique({
    where: { id: "singleton" },
    select: { timezone: true },
  });
  const today = todayInTz(hotelSettings?.timezone);
  const todayStart = parseDateOnly(today);
  const monthStart = new Date(
    Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1)
  );

  try {
    const [
      totalRooms,
      occupiedRooms,
      arrivalsToday,
      departuresToday,
      inHouse,
      pendingBookings,
      monthRevenueAgg,
      statusGroups,
      upcoming,
    ] = await Promise.all([
      prisma.hotelRoom.count(),
      prisma.hotelRoom.count({ where: { status: "OCCUPIED" } }),
      prisma.hotelBooking.count({
        where: {
          checkInDate: todayStart,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      }),
      prisma.hotelBooking.count({
        where: {
          checkOutDate: todayStart,
          status: BookingStatus.CHECKED_IN,
        },
      }),
      prisma.hotelBooking.count({
        where: { status: BookingStatus.CHECKED_IN },
      }),
      prisma.hotelBooking.count({
        where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
      }),
      prisma.hotelBooking.aggregate({
        where: {
          paymentStatus: HotelPaymentStatus.PAID,
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      prisma.hotelBooking.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.hotelBooking.findMany({
        where: {
          status: { in: [...BLOCKED_BOOKING_STATUSES] },
          checkInDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 7 * 86_400_000) },
        },
        include: { roomType: true, room: true },
        orderBy: { checkInDate: "asc" },
        take: 8,
      }),
    ]);

    const statusCounts = { ...emptyStats.statusCounts };
    for (const g of statusGroups) {
      statusCounts[g.status as keyof typeof statusCounts] = g._count._all;
    }

    return {
      arrivalsToday,
      departuresToday,
      inHouse,
      totalRooms,
      occupiedRooms,
      occupancyRate:
        totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      pendingBookings,
      monthRevenue: money(monthRevenueAgg._sum.totalAmount),
      statusCounts,
      upcomingBookings: upcoming.map((b) => ({
        id: b.id,
        referenceCode: b.referenceCode,
        guestName: b.guestName,
        roomTypeName: b.roomType.name,
        roomNumber: b.room?.number ?? null,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        status: b.status,
        totalAmount: money(b.totalAmount),
      })),
    };
  } catch (error) {
    console.error("getHotelDashboardStats error:", error);
    return { ...emptyStats };
  }
}
