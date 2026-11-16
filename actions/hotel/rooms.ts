"use server";

import prisma from "@/lib/prisma";
import { requireHotelStaff } from "@/lib/hotel-roles";
import {
  hotelRoomSchema,
  hotelRoomStatusSchema,
  hotelRoomTypeSchema,
  type HotelRoomInput,
  type HotelRoomTypeInput,
} from "@/schemas/hotel";
import { convertDecimalsDeep } from "@/lib/decimal";
import { revalidatePath } from "next/cache";
import { RoomStatus } from "@prisma/client";

// ─── Room types ──────────────────────────────────────────────────────────────

export async function getHotelRoomTypes() {
  const user = await requireHotelStaff();
  if (!user) return [];

  try {
    const types = await prisma.hotelRoomType.findMany({
      include: { _count: { select: { rooms: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return convertDecimalsDeep(types);
  } catch {
    return [];
  }
}

export async function createHotelRoomType(rawData: HotelRoomTypeInput) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelRoomTypeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const roomType = await prisma.hotelRoomType.create({ data: parsed.data });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true, roomType: convertDecimalsDeep(roomType) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return { error: "A room type with this name already exists." };
    }
    return { error: `Failed to create room type: ${msg}` };
  }
}

export async function updateHotelRoomType(id: string, rawData: HotelRoomTypeInput) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelRoomTypeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const roomType = await prisma.hotelRoomType.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true, roomType: convertDecimalsDeep(roomType) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return { error: "A room type with this name already exists." };
    }
    return { error: `Failed to update room type: ${msg}` };
  }
}

export async function deleteHotelRoomType(id: string) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.hotelRoomType.delete({ where: { id } });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    if (msg.includes("Foreign key") || msg.includes("constraint")) {
      return {
        error: "Cannot delete: this room type still has rooms or bookings. Remove them first.",
      };
    }
    return { error: msg };
  }
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export async function getHotelRooms() {
  const user = await requireHotelStaff();
  if (!user) return [];

  try {
    const rooms = await prisma.hotelRoom.findMany({
      include: { roomType: true },
      orderBy: { number: "asc" },
    });
    return convertDecimalsDeep(rooms);
  } catch {
    return [];
  }
}

export async function createHotelRoom(rawData: HotelRoomInput) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelRoomSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const room = await prisma.hotelRoom.create({
      data: {
        number: parsed.data.number,
        floor: parsed.data.floor || null,
        roomTypeId: parsed.data.roomTypeId,
        status: parsed.data.status as RoomStatus,
      },
      include: { roomType: true },
    });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true, room: convertDecimalsDeep(room) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return { error: "A room with this number already exists." };
    }
    return { error: `Failed to create room: ${msg}` };
  }
}

export async function updateHotelRoom(id: string, rawData: HotelRoomInput) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelRoomSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const room = await prisma.hotelRoom.update({
      where: { id },
      data: {
        number: parsed.data.number,
        floor: parsed.data.floor || null,
        roomTypeId: parsed.data.roomTypeId,
        status: parsed.data.status as RoomStatus,
      },
      include: { roomType: true },
    });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true, room: convertDecimalsDeep(room) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return { error: "A room with this number already exists." };
    }
    return { error: `Failed to update room: ${msg}` };
  }
}

export async function deleteHotelRoom(id: string) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.hotelRoom.delete({ where: { id } });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    if (msg.includes("Foreign key") || msg.includes("constraint")) {
      return {
        error: "Cannot delete: this room has bookings. Cancel or reassign them first.",
      };
    }
    return { error: msg };
  }
}

export async function updateHotelRoomStatus(rawData: unknown) {
  const user = await requireHotelStaff();
  if (!user) return { error: "Unauthorized" };

  const parsed = hotelRoomStatusSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const room = await prisma.hotelRoom.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status as RoomStatus },
      include: { roomType: true },
    });
    revalidatePath("/hotel/dashboard/rooms");
    return { success: true, room: convertDecimalsDeep(room) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}
