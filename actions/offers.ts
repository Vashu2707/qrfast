"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getOffers() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  return prisma.offer.findMany({
    orderBy: { expiryDate: "asc" },
  });
}

export async function createOffer(data: any) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const offer = await prisma.offer.create({
      data: {
        code: data.code.toUpperCase().trim(),
        title: data.title || null,
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        minOrderAmount: parseFloat(data.minOrderAmount || 0),
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
      },
    });
    revalidatePath("/dashboard/offers");
    return { success: true, offer };
  } catch (error: any) {
    console.error("Offer create failure:", error);
    return { error: "An offer with this code already exists." };
  }
}

export async function updateOffer(id: string, data: any) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const offer = await prisma.offer.update({
      where: { id },
      data: {
        code: data.code.toUpperCase().trim(),
        title: data.title || null,
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        minOrderAmount: parseFloat(data.minOrderAmount || 0),
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        isActive: data.isActive,
      },
    });
    revalidatePath("/dashboard/offers");
    return { success: true, offer };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteOffer(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.offer.delete({
      where: { id },
    });
    revalidatePath("/dashboard/offers");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function toggleOfferStatus(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return { error: "Not found" };

  await prisma.offer.update({
    where: { id },
    data: { isActive: !offer.isActive },
  });
  revalidatePath("/dashboard/offers");
  return { success: true };
}

export async function validateOffer(code: string, subtotal: number) {
  try {
    const offer = await prisma.offer.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        isActive: true,
      },
    });

    if (!offer) {
      return { isValid: false, message: "Invalid offer code." };
    }

    if (new Date() > offer.expiryDate) {
      return { isValid: false, message: "Offer has expired." };
    }

    if (offer.usageLimit && offer.usageCount >= offer.usageLimit) {
      return { isValid: false, message: "Offer usage limit reached." };
    }

    if (subtotal < offer.minOrderAmount) {
      return {
        isValid: false,
        message: `Minimum order amount of ${offer.minOrderAmount} required.`,
      };
    }

    let discount = 0;
    if (offer.discountType === "PERCENTAGE") {
      discount = (subtotal * offer.discountValue) / 100;
    } else {
      discount = offer.discountValue;
    }

    discount = Math.min(discount, subtotal);

    return {
      isValid: true,
      offer: {
        code: offer.code,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        minOrderAmount: offer.minOrderAmount,
      },
      discountAmount: discount,
    };
  } catch (error: any) {
    return { isValid: false, message: "Error validating offer." };
  }
}
