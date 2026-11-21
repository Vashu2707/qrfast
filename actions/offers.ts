"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/roles";
import { offerSchema, type OfferInput } from "@/schemas";
import { revalidatePath } from "next/cache";
import { toNumber } from "@/lib/decimal";
import { verifyActiveTableToken } from "@/lib/table-token";

export async function getOffers() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  return prisma.offer.findMany({
    orderBy: { expiryDate: "asc" },
  });
}

export async function createOffer(rawData: OfferInput) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = offerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const offer = await prisma.offer.create({
      data: {
        code: data.code.toUpperCase().trim(),
        title: data.title || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount ?? 0,
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ?? null,
      },
    });
    revalidatePath("/dashboard/offers");
    return { success: true, offer };
  } catch (error: unknown) {
    console.error("createOffer error:", error);
    return { error: "An offer with this code already exists." };
  }
}

export async function updateOffer(id: string, rawData: OfferInput) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const parsed = offerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    const offer = await prisma.offer.update({
      where: { id },
      data: {
        code: data.code.toUpperCase().trim(),
        title: data.title || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount ?? 0,
        expiryDate: new Date(data.expiryDate),
        usageLimit: data.usageLimit ?? null,
        isActive: data.isActive ?? true,
      },
    });
    revalidatePath("/dashboard/offers");
    return { success: true, offer };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed.";
    return { error: msg };
  }
}

export async function deleteOffer(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.offer.delete({ where: { id } });
    revalidatePath("/dashboard/offers");
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return { error: msg };
  }
}

export async function toggleOfferStatus(id: string) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return { error: "Offer not found." };

  await prisma.offer.update({
    where: { id },
    data: { isActive: !offer.isActive },
  });
  revalidatePath("/dashboard/offers");
  return { success: true };
}

export async function validateOffer(code: string, subtotal: number, tableToken?: string) {
  if (!code || typeof code !== "string") {
    return { isValid: false, message: "Invalid offer code." };
  }

  // Cart validation comes from an anonymous client. The signed QR token is
  // the only trustworthy tenant source; verifyActiveTableToken sets it.
  if (tableToken) {
    const token = await verifyActiveTableToken(tableToken);
    if (!token) return { isValid: false, message: "Invalid table token." };
  }

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

    const minOrderAmount = toNumber(offer.minOrderAmount);
    const discountValue = toNumber(offer.discountValue);

    if (subtotal < minOrderAmount) {
      return {
        isValid: false,
        message: `Minimum order amount of ₹${minOrderAmount} required.`,
      };
    }

    let discount =
      offer.discountType === "PERCENTAGE"
        ? (subtotal * discountValue) / 100
        : discountValue;

    discount = Math.min(discount, subtotal);
    // Round to paise BEFORE the tax/total math and the Decimal(10,2) write:
    // the DB rounds discountAmount independently, so an unrounded value made
    // gst/total (computed from it) disagree with the stored discount line by
    // ₹0.01. The client cart already rounds this way (use-cart getDiscountAmount).
    discount = Math.round(discount * 100) / 100;

    return {
      isValid: true,
      offer: {
        code: offer.code,
        discountType: offer.discountType,
        discountValue,
        minOrderAmount,
      },
      discountAmount: discount,
    };
  } catch {
    return { isValid: false, message: "Error validating offer." };
  }
}
