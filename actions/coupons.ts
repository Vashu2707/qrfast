"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getCoupons() {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) throw new Error("Unauthorized");

  return prisma.coupon.findMany({
    where: { restaurantId: user.restaurantId },
    orderBy: { expiryDate: "asc" },
  });
}

export async function createCoupon(data: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase().trim(),
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        minOrderAmount: parseFloat(data.minOrderAmount || 0),
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        restaurantId: user.restaurantId,
      },
    });
    revalidatePath("/dashboard/coupons");
    return { success: true, coupon };
  } catch (error: any) {
    console.error("Coupon create failure:", error);
    return { error: "A coupon with this code already exists." };
  }
}

export async function updateCoupon(id: string, data: any) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const coupon = await prisma.coupon.update({
      where: { id, restaurantId: user.restaurantId },
      data: {
        code: data.code.toUpperCase().trim(),
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        minOrderAmount: parseFloat(data.minOrderAmount || 0),
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        isActive: data.isActive,
      },
    });
    revalidatePath("/dashboard/coupons");
    return { success: true, coupon };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteCoupon(id: string) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    await prisma.coupon.delete({
      where: { id, restaurantId: user.restaurantId },
    });
    revalidatePath("/dashboard/coupons");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function toggleCouponStatus(id: string) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  const coupon = await prisma.coupon.findUnique({ where: { id, restaurantId: user.restaurantId } });
  if (!coupon) return { error: "Not found" };

  await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
  });
  revalidatePath("/dashboard/coupons");
  return { success: true };
}

export async function validateCoupon(restaurantId: string, code: string, subtotal: number) {
  try {
    const coupon = await prisma.coupon.findFirst({
      where: {
        restaurantId,
        code: code.toUpperCase().trim(),
        isActive: true,
      },
    });

    if (!coupon) {
      return { isValid: false, message: "Invalid coupon code." };
    }

    if (new Date() > coupon.expiryDate) {
      return { isValid: false, message: "Coupon has expired." };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { isValid: false, message: "Coupon usage limit reached." };
    }

    if (subtotal < coupon.minOrderAmount) {
      return {
        isValid: false,
        message: `Minimum order amount of ${coupon.minOrderAmount} required.`,
      };
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discount = (subtotal * coupon.discountValue) / 100;
    } else {
      discount = coupon.discountValue;
    }

    // Cap discount at subtotal
    discount = Math.min(discount, subtotal);

    return {
      isValid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
      },
      discountAmount: discount,
    };
  } catch (error: any) {
    return { isValid: false, message: "Error validating coupon." };
  }
}
