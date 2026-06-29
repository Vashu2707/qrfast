import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Variant name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
});

export const addonSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Addon name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  isVeg: z.boolean().default(true),
});

export const menuItemSchema = z.object({
  name: z.string().min(2, "Item name must be at least 2 characters"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  discountPrice: z.coerce.number().min(0, "Discount price must be 0 or more").optional().nullable(),
  isVeg: z.boolean().default(true),
  spicyLevel: z.coerce.number().int().min(0).max(3).default(0),
  preparationTime: z.coerce.number().int().min(1).default(15),
  images: z.array(z.string()).default([]),
  isAvailable: z.boolean().default(true),
  ingredients: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  nutrition: z
    .object({
      calories: z.coerce.number().optional().nullable(),
      protein: z.coerce.number().optional().nullable(),
      carbs: z.coerce.number().optional().nullable(),
      fat: z.coerce.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Category is required"),
  variants: z.array(variantSchema).default([]),
  addons: z.array(addonSchema).default([]),
});
