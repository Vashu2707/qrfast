import { z } from "zod";

export const couponSchema = z.object({
  code: z
    .string()
    .min(3, "Coupon code must be at least 3 characters")
    .transform((val) => val.toUpperCase()),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.coerce.number().min(0.01, "Value must be greater than 0"),
  minOrderAmount: z.coerce.number().min(0, "Minimum order must be 0 or more"),
  expiryDate: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
});
