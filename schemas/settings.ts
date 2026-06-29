import { z } from "zod";

export const dayHoursSchema = z.object({
  open: z.string().default("09:00"),
  close: z.string().default("22:00"),
  closed: z.boolean().default(false),
});

export const businessHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

export const settingsSchema = z.object({
  restaurantName: z.string().min(2, "Restaurant name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email address"),
  logo: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid HEX color (e.g. #E11D48)"),
  currency: z.string().min(1, "Currency is required"),
  timezone: z.string().min(1, "Timezone is required"),
  gstNumber: z.string().optional().nullable(),
  gstPercentage: z.coerce.number().min(0).max(100).default(5.0),
  serviceChargePercentage: z.coerce.number().min(0).max(100).default(0.0),
  businessHours: businessHoursSchema.optional().nullable(),
});
