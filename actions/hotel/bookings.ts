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
  todayInTz,
} from "@/lib/hotel";
import { convertDecimalsDeep, toNumber } from "@/lib/decimal";
import { revalidatePath } from "next/cache";
import { BookingStatus, HotelPaymentStatus, Prisma } from "@prisma/client";

const bookingInclude = {
  roomType: true,
  room: true,
} satisfies Prisma.HotelBookingInclude;

async function countAvailableRooms(
  db: Prisma.TransactionClient,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
) {
  // Sequential (not Promise.all): this runs inside interactive transactions,
  // where queries share a single connection.
  // Only rooms assignHotelRoom would actually accept count toward supply:
  // MAINTENANCE rooms are rejected at assign time, so including them let a
  // booking be created for a type whose only room could never be assigned
  // (check-in then blocked with no recovery). CLEANING stays counted — it is
  // assignable once cleaned.
  const totalRooms = await db.hotelRoom.count({
    where: { roomTypeId, status: { not: "MAINTENANCE" } },
  });
  const bookedRooms = await db.hotelBooking.count({
    where: {
      roomTypeId,
      status: { in: [...BLOCKED_BOOKING_STATUSES] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
  return { totalRooms, bookedRooms, available: totalRooms - bookedRooms };
}

/** True when the error is a Prisma unique-constraint violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
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

  // "No past check-in" is judged against the HOTEL's calendar day — the
  // server may be hosted in another timezone than the property.
  const hotelSettings = await prisma.hotelSettings.findUnique({
    where: { id: "singleton" },
    select: { timezone: true },
  });
  if (data.checkInDate < todayInTz(hotelSettings?.timezone)) {
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

    const totalAmount = Math.round(nights * Number(roomType.basePrice) * 100) / 100;

    // Availability check and insert run in one transaction holding a lock on
    // the room-type row: without it, two concurrent creates both see
    // available >= 1 and overbook (check-then-insert race). A unique-code
    // collision (P2002) retries with a freshly generated reference.
    let booking;
    for (let attempt = 0; ; attempt++) {
      try {
        booking = await prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM "HotelRoomType" WHERE id = ${roomType.id} FOR UPDATE`;

            const { totalRooms, available } = await countAvailableRooms(
              tx,
              roomType.id,
              checkInDate,
              checkOutDate
            );
            if (totalRooms === 0) {
              throw new Error("This room type has no rooms available right now.");
            }
            if (available <= 0) {
              throw new Error("No rooms available for the selected dates.");
            }

            return tx.hotelBooking.create({
              data: {
                referenceCode: generateBookingReference(),
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
          },
          { timeout: 10_000 }
        );
        break;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 2) continue;
        throw error;
      }
    }

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
    // Edits could raise guestCount above the room type's capacity even though
    // createHotelBooking enforces it — keep the invariant on both paths.
    if (data.guestCount > existing.roomType.maxGuests) {
      return {
        error: `This room type allows a maximum of ${existing.roomType.maxGuests} guest(s).`,
      };
    }

    const checkInDate = parseDateOnly(data.checkInDate);
    const checkOutDate = parseDateOnly(data.checkOutDate);
    const nights = nightsBetween(checkInDate, checkOutDate);
    if (nights < 1) return { error: "Stay must be at least 1 night." };

    const datesChanged =
      existing.checkInDate.getTime() !== checkInDate.getTime() ||
      existing.checkOutDate.getTime() !== checkOutDate.getTime();

    if (datesChanged && existing.status !== BookingStatus.CANCELLED) {
      const { available } = await countAvailableRooms(
        prisma,
        existing.roomTypeId,
        checkInDate,
        checkOutDate,
        bookingId
      );
      if (available <= 0) {
        return { error: "No rooms available for the selected dates." };
      }

      // Type-level availability isn't enough when a room is already
      // assigned — re-check that specific room for overlaps, or editing
      // dates can double-book the same room for the same nights.
      if (existing.roomId) {
        const clash = await prisma.hotelBooking.findFirst({
          where: {
            roomId: existing.roomId,
            id: { not: bookingId },
            status: { in: [...BLOCKED_BOOKING_STATUSES] },
            checkInDate: { lt: checkOutDate },
            checkOutDate: { gt: checkInDate },
          },
          select: { referenceCode: true },
        });
        if (clash) {
          return {
            error:
              "The assigned room is already booked for the new dates. Change the room or pick different dates.",
          };
        }
      }
    }

    // Reprice ONLY when the dates change: recomputing on every edit silently
    // rewrote already-PAID totals after any basePrice change (e.g. renaming
    // a guest repriced the stay at tonight's rate).
    const totalAmount = datesChanged
      ? Math.round(nights * Number(existing.roomType.basePrice) * 100) / 100
      : toNumber(existing.totalAmount);

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

    await prisma.$transaction(
      async (tx) => {
        // Lock the room row so two concurrent assigns of different bookings
        // to the same room serialize — otherwise both pass the clash check
        // and the room ends up double-booked.
        await tx.$queryRaw`SELECT id FROM "HotelRoom" WHERE id = ${roomId} FOR UPDATE`;

        const clash = await tx.hotelBooking.findFirst({
          where: {
            roomId,
            id: { not: bookingId },
            status: { in: [...BLOCKED_BOOKING_STATUSES] },
            checkInDate: { lt: booking.checkOutDate },
            checkOutDate: { gt: booking.checkInDate },
          },
          select: { id: true },
        });
        if (clash) {
          throw new Error(`Room ${room.number} is already booked for these dates.`);
        }

        await tx.hotelBooking.update({
          where: { id: bookingId },
          data: { roomId },
        });

        // Moving a checked-in guest: free the old room and occupy the new
        // one, or the old room stays OCCUPIED forever and a later checkout
        // only frees the new one (occupancy stats drift with no recovery).
        if (booking.status === BookingStatus.CHECKED_IN) {
          if (booking.roomId && booking.roomId !== roomId) {
            await tx.hotelRoom.update({
              where: { id: booking.roomId },
              data: { status: "AVAILABLE" },
            });
          }
          await tx.hotelRoom.update({
            where: { id: roomId },
            data: { status: "OCCUPIED" },
          });
        }
      },
      { timeout: 10_000 }
    );

    revalidatePath("/hotel/dashboard/bookings");
    revalidatePath("/hotel/dashboard/rooms");
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
