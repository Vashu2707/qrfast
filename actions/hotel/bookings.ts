"use server";

import prisma from "@/lib/prisma";
import { requireHotelStaff } from "@/lib/hotel-roles";
import {
  createHotelBookingSchema,
  hotelBookingUpdateSchema,
  hotelBookingStatusSchema,
  hotelAssignRoomSchema,
  hotelPaymentUpdateSchema,
  type CreateHotelBookingInput,
  type HotelBookingUpdateInput,
} from "@/schemas/hotel";
import {
  BLOCKED_BOOKING_STATUSES,
  generateBookingReference,
  nightsBetween,
  parseDateOnly,
  todayISO,
} from "@/lib/hotel";
import { convertDecimalsDeep } from "@/lib/decimal";
import { revalidatePath } from "next/cache";
import { BookingStatus, HotelPaymentStatus, Prisma } from "@prisma/client";

const bookingInclude = {
  roomType: true,
  room: true,
} satisfies Prisma.HotelBookingInclude;

async function countAvailableRooms(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
) {
  const [totalRooms, bookedRooms] = await Promise.all([
    prisma.hotelRoom.count({ where: { roomTypeId } }),
    prisma.hotelBooking.count({
      where: {
        roomTypeId,
        status: { in: [...BLOCKED_BOOKING_STATUSES] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    }),
  ]);
  return { totalRooms, bookedRooms, available: totalRooms - bookedRooms };
}

export async function createHotelBooking(rawData: CreateHotelBookingInput) {
  const staff = await requireHotelStaff();
  if (!staff) return { error: "Unauthorized" };

  const parsed = createHotelBookingSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  const checkInDate = parseDateOnly(data.checkInDate);
  const checkOutDate = parseDateOnly(data.checkOutDate);

  if (data.checkInDate < todayISO()) {
    return { error: "Check-in date cannot be in the past." };
  }

  try {
    const roomType = await prisma.hotelRoomType.findUnique({
      where: { id: data.roomTypeId },
    });
    if (!roomType) {
      return { error: "Room type not found." };
    }
    if (data.guestCount > roomType.maxGuests) {
      return {
        error: `This room type allows a maximum of ${roomType.maxGuests} guest(s).`,
      };
    }

    const nights = nightsBetween(checkInDate, checkOutDate);
    if (nights < 1) {
      return { error: "Stay must be at least 1 night." };
    }

    const { totalRooms, available } = await countAvailableRooms(
      roomType.id,
      checkInDate,
      checkOutDate
    );
    if (totalRooms === 0) {
      return { error: "This room type has no rooms available right now." };
    }
    if (available <= 0) {
      return { error: "No rooms available for the selected dates." };
    }

    const totalAmount = Math.round(nights * Number(roomType.basePrice) * 100) / 100;

    let referenceCode = generateBookingReference();
    // Extremely unlikely collision — retry a couple of times.
    for (let i = 0; i < 3; i++) {
      const exists = await prisma.hotelBooking.findUnique({
        where: { referenceCode },
      });
      if (!exists) break;
      referenceCode = generateBookingReference();
    }

    const booking = await prisma.hotelBooking.create({
      data: {
        referenceCode,
        guestName: data.guestName,
        guestEmail: data.guestEmail || null,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        roomTypeId: roomType.id,
        checkInDate,
        checkOutDate,
        totalAmount,
        specialRequests: data.specialRequests || null,
        status: BookingStatus.CONFIRMED,
        paymentStatus: HotelPaymentStatus.PENDING,
      },
      include: bookingInclude,
    });

    revalidatePath("/hotel/dashboard/bookings");
    return {
      success: true,
      referenceCode: booking.referenceCode,
      booking: convertDecimalsDeep(booking),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create booking.";
    console.error("Hotel booking create failure:", msg);
    return { error: msg };
  }
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export async function getHotelBookings(filter?: { status?: string; search?: string }) {
  const user = await requireHotelStaff();
  if (!user) return [];

  const status = filter?.status;
  const search = filter?.search?.trim();

  const where: Prisma.HotelBookingWhereInput = {
    ...(status && status !== "ALL"
      ? { status: status as BookingStatus }
      : {}),
    ...(search
      ? {
          OR: [
            { referenceCode: { contains: search, mode: "insensitive" as const } },
            { guestName: { contains: search, mode: "insensitive" as const } },
            { guestPhone: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const bookings = await prisma.hotelBooking.findMany({
      where,
      include: bookingInclude,
      orderBy: { checkInDate: "desc" },
      take: 300,
    });
    return convertDecimalsDeep(bookings);
  } catch {
    return [];
  }
}

export async function updateHotelBooking(bookingId: string, rawData: HotelBookingUpdateInput) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelBookingUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const existing = await prisma.hotelBooking.findUnique({
      where: { id: bookingId },
      include: { roomType: true },
    });
    if (!existing) return { error: "Booking not found." };

    const checkInDate = parseDateOnly(data.checkInDate);
    const checkOutDate = parseDateOnly(data.checkOutDate);
    const nights = nightsBetween(checkInDate, checkOutDate);
    if (nights < 1) return { error: "Stay must be at least 1 night." };

    const datesChanged =
      existing.checkInDate.getTime() !== checkInDate.getTime() ||
      existing.checkOutDate.getTime() !== checkOutDate.getTime();

    if (datesChanged && existing.status !== BookingStatus.CANCELLED) {
      const { available } = await countAvailableRooms(
        existing.roomTypeId,
        checkInDate,
        checkOutDate,
        bookingId
      );
      if (available <= 0) {
        return { error: "No rooms available for the selected dates." };
      }
    }

    const totalAmount =
      Math.round(nights * Number(existing.roomType.basePrice) * 100) / 100;

    const booking = await prisma.hotelBooking.update({
      where: { id: bookingId },
      data: {
        guestName: data.guestName,
        guestEmail: data.guestEmail || null,
        guestPhone: data.guestPhone,
        guestCount: data.guestCount,
        checkInDate,
        checkOutDate,
        specialRequests: data.specialRequests || null,
        notes: data.notes || null,
        totalAmount,
      },
      include: bookingInclude,
    });

    revalidatePath("/hotel/dashboard/bookings");
    return { success: true, booking: convertDecimalsDeep(booking) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}

export async function updateHotelBookingStatus(rawData: unknown) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelBookingStatusSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const { id, status } = parsed.data;

  try {
    const existing = await prisma.hotelBooking.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!existing) return { error: "Booking not found." };

    if (status === BookingStatus.CHECKED_IN && !existing.roomId) {
      return { error: "Assign a room before checking in." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.hotelBooking.update({
        where: { id },
        data: { status: status as BookingStatus },
      });

      // Keep room status in sync with the guest's stay.
      if (existing.roomId) {
        if (status === BookingStatus.CHECKED_IN) {
          await tx.hotelRoom.update({
            where: { id: existing.roomId },
            data: { status: "OCCUPIED" },
          });
        } else if (existing.status === BookingStatus.CHECKED_IN) {
          await tx.hotelRoom.update({
            where: { id: existing.roomId },
            data: { status: "AVAILABLE" },
          });
        }
      }
    });

    revalidatePath("/hotel/dashboard/bookings");
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}

export async function assignHotelRoom(rawData: unknown) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelAssignRoomSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const { bookingId, roomId } = parsed.data;

  try {
    const [booking, room] = await Promise.all([
      prisma.hotelBooking.findUnique({ where: { id: bookingId } }),
      prisma.hotelRoom.findUnique({ where: { id: roomId } }),
    ]);
    if (!booking) return { error: "Booking not found." };
    if (!room) return { error: "Room not found." };
    if (room.roomTypeId !== booking.roomTypeId) {
      return { error: "Room does not belong to this booking's room type." };
    }
    if (room.status === "MAINTENANCE") {
      return { error: "Room is under maintenance." };
    }

    const clash = await prisma.hotelBooking.findFirst({
      where: {
        roomId,
        id: { not: bookingId },
        status: { in: [...BLOCKED_BOOKING_STATUSES] },
        checkInDate: { lt: booking.checkOutDate },
        checkOutDate: { gt: booking.checkInDate },
      },
    });
    if (clash) {
      return { error: `Room ${room.number} is already booked for these dates.` };
    }

    await prisma.hotelBooking.update({
      where: { id: bookingId },
      data: { roomId },
    });

    revalidatePath("/hotel/dashboard/bookings");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Assign failed.";
    return { error: msg };
  }
}

export async function updateHotelBookingPayment(rawData: unknown) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelPaymentUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const { id, paymentStatus, paymentMethod } = parsed.data;

  try {
    await prisma.hotelBooking.update({
      where: { id },
      data: {
        paymentStatus: paymentStatus as HotelPaymentStatus,
        paymentMethod:
          paymentStatus === "PENDING" ? null : paymentMethod || "CASH",
      },
    });
    revalidatePath("/hotel/dashboard/bookings");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
