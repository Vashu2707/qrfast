import { z } from "zod";

export const orderItemInputSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1),
  notes: z.string().optional().nullable(),
  customizations: z
    .object({
      variant: z
        .object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
        })
        .optional()
        .nullable(),
      addons: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            price: z.number(),
          })
        )
        .default([]),
    })
    .optional()
    .nullable(),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().min(10, "Phone number must be at least 10 digits"),
  tableId: z.string().min(1, "Table is required"),
  paymentMethod: z.enum(["RAZORPAY", "CASH"]),
  couponCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1, "Your cart cannot be empty"),
});
