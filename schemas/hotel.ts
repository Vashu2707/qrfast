import { z } from "zod";

// ─── Booking (public) ────────────────────────────────────────────────────────

const dateOnly = z
  .string()
  .min(1, "Date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (expected YYYY-MM-DD)");

export const createHotelBookingSchema = z
  .object({
    roomTypeId: z.string().min(1, "Room type is required"),
    guestName: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name too long")
      .transform((v) => v.trim()),
    guestEmail: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    guestPhone: z
      .string()
      .min(7, "Phone number is too short")
      .max(20, "Phone number is too long"),
    guestCount: z.coerce.number().int().min(1).max(20),
    checkInDate: dateOnly,
    checkOutDate: dateOnly,
    specialRequests: z.string().max(500).optional().or(z.literal("")),
  })
  .refine(
    (data) => data.checkOutDate > data.checkInDate,
    { message: "Check-out must be after check-in", path: ["checkOutDate"] }
  );

export type CreateHotelBookingInput = z.infer<typeof createHotelBookingSchema>;

// ─── Booking (staff edits) ───────────────────────────────────────────────────

export const hotelBookingUpdateSchema = z
  .object({
    guestName: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name too long")
      .transform((v) => v.trim()),
    guestEmail: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    guestPhone: z
      .string()
      .min(7, "Phone number is too short")
      .max(20, "Phone number is too long"),
    guestCount: z.coerce.number().int().min(1).max(20),
    checkInDate: dateOnly,
    checkOutDate: dateOnly,
    specialRequests: z.string().max(500).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine(
    (data) => data.checkOutDate > data.checkInDate,
    { message: "Check-out must be after check-in", path: ["checkOutDate"] }
  );

export type HotelBookingUpdateInput = z.infer<typeof hotelBookingUpdateSchema>;

export const hotelBookingStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"]),
});

export const hotelAssignRoomSchema = z.object({
  bookingId: z.string().min(1),
  roomId: z.string().min(1),
});

export const hotelPaymentUpdateSchema = z.object({
  id: z.string().min(1),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]),
  paymentMethod: z.string().max(20).optional().or(z.literal("")),
});

// ─── Room type ───────────────────────────────────────────────────────────────

export const hotelRoomTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  basePrice: z.coerce.number().nonnegative("Price must be ≥ 0"),
  maxGuests: z.coerce.number().int().min(1).max(20),
  amenities: z.array(z.string().max(100)).optional().default([]),
  images: z.array(z.string().url()).optional().default([]),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});

export type HotelRoomTypeInput = z.infer<typeof hotelRoomTypeSchema>;

// ─── Room ────────────────────────────────────────────────────────────────────

export const hotelRoomSchema = z.object({
  number: z
    .string()
    .min(1)
    .max(20)
    .regex(
      /^[A-Za-z0-9\-_]+$/,
      "Room number can only contain letters, numbers, hyphens, or underscores"
    ),
  floor: z.string().max(20).optional().or(z.literal("")),
  roomTypeId: z.string().min(1, "Room type is required"),
  status: z
    .enum(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"])
    .optional()
    .default("AVAILABLE"),
});

export type HotelRoomInput = z.infer<typeof hotelRoomSchema>;

export const hotelRoomStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"]),
});

// ─── Settings ────────────────────────────────────────────────────────────────

export const hotelSettingsSchema = z.object({
  hotelName: z.string().min(1, "Hotel name is required").max(200),
  logo: z.string().nullable().optional().or(z.literal("")),
  banner: z.string().nullable().optional().or(z.literal("")),
  description: z.string().max(2000).nullable().optional().or(z.literal("")),
  address: z.string().max(500).nullable().optional().or(z.literal("")),
  phone: z.string().max(20).nullable().optional().or(z.literal("")),
  email: z.string().email("Invalid email address").nullable().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional()
    .default("#0F172A"),
  currency: z.string().length(3).optional().default("INR"),
  timezone: z.string().max(100).optional().default("Asia/Kolkata"),
  gstPercentage: z.coerce.number().min(0).max(100),
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
    .default("14:00"),
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM format")
    .default("11:00"),
  openingHours: z.record(z.string(), z.unknown()).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

export type HotelSettingsInput = z.infer<typeof hotelSettingsSchema>;
