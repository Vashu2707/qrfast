"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient, refundRazorpayPayment, refundRazorpayOrderPayments } from "@/lib/razorpay";
import { resend } from "@/lib/resend";
import { getCurrentUser } from "./auth";
import { requireAdmin, requireStaff } from "@/lib/roles";
import { validateOffer } from "./offers";
import { createOrderSchema, type CreateOrderInput } from "@/schemas";
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  NotificationType,
  TableStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toNumber } from "@/lib/decimal";
import { getOrderStatusLabel } from "@/lib/format";
import { verifyTableToken } from "@/lib/table-token";
import { checkRateLimit, getServerActionIp } from "@/lib/rate-limit";

// ─── Public ──────────────────────────────────────────────────────────────────

export type CheckoutErrorCode = "MENU_CHANGED" | "COUPON_INVALID";

/** A checkout rejected before anything is written — the client offers a fix. */
class CheckoutRejectedError extends Error {
  constructor(
    message: string,
    readonly code: CheckoutErrorCode
  ) {
    super(message);
  }
}

/**
 * Creates a new customer order.
 * Input is validated against a strict Zod schema — no `any` types.
 */
export async function createOrder(rawData: CreateOrderInput) {
  // 1. Validate and sanitize input
  const parsed = createOrderSchema.safeParse(rawData);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join(", ");
    return { error: `Invalid order data: ${message}` };
  }
  const data = parsed.data;

  // Table-token binding: the caller must present this table's HMAC-signed
  // QR token. Without it, anyone holding a leaked table UUID could append
  // unpaid items to that table's open bill or flood the kitchen.
  const tokenTableId = verifyTableToken(data.tableToken);
  if (!tokenTableId || tokenTableId !== data.tableId) {
    return { error: "Invalid table token. Please reopen the menu from your table's QR code." };
  }

  // Bound orders per table (token-verified scope, not client-spoofable IP)
  // so one party cannot flood kitchen notifications or occupy the table.
  const { allowed, retryAfterMs } = await checkRateLimit(`order:${data.tableId}`, 20, 5 * 60_000);
  if (!allowed) {
    return { error: `Too many order attempts. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds.` };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({ where: { id: data.tableId } });
      if (!table) throw new Error("Table not found.");

      const settings = await tx.settings.findUnique({ where: { id: "singleton" } });
      if (!settings) throw new Error("Restaurant settings not initialized.");

      const itemIds = data.items.map((i) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds }, isAvailable: true },
        include: { variants: true, addons: true },
      });

      let subtotal = 0;
      const MENU_CHANGED_MESSAGE =
        "Menu prices or options changed since you added these items. Please refresh your cart and try again.";
      // Prices are Decimal(10,2) snapshots — a sub-paise difference is noise.
      const priceChanged = (a: number, b: number) => Math.abs(a - b) > 0.001;

      const verifiedItems = data.items.map((cartItem) => {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (!menuItem) {
          throw new CheckoutRejectedError(
            "An item in your cart is no longer available. Please refresh your cart.",
            "MENU_CHANGED"
          );
        }

        let itemPrice = toNumber(menuItem.discountPrice) || toNumber(menuItem.price);

        const variantInput = cartItem.customizations?.variant;
        if (variantInput) {
          const v = menuItem.variants.find((x) => x.id === variantInput.id);
          // A stale variant ID previously fell through to the item's base
          // price: the cart showed the larger size's price while the order —
          // and the Razorpay charge — used the base price. Reject instead.
          if (!v || priceChanged(toNumber(v.price), variantInput.price)) {
            throw new CheckoutRejectedError(MENU_CHANGED_MESSAGE, "MENU_CHANGED");
          }
          itemPrice = toNumber(v.price);
        }

        // The item's own price snapshot (base / discountPrice) can also go
        // stale while its ID stays valid — same rejection before any write.
        if (
          cartItem.expectedUnitPrice != null &&
          priceChanged(itemPrice, cartItem.expectedUnitPrice)
        ) {
          throw new CheckoutRejectedError(MENU_CHANGED_MESSAGE, "MENU_CHANGED");
        }

        let addonsPrice = 0;
        const addonsDetails: { id: string; name: string; price: number }[] = [];
        if (cartItem.customizations?.addons) {
          for (const addonInput of cartItem.customizations.addons) {
            const add = menuItem.addons.find((a) => a.id === addonInput.id);
            if (!add) {
              throw new CheckoutRejectedError(MENU_CHANGED_MESSAGE, "MENU_CHANGED");
            }
            const addonPrice = toNumber(add.price);
            if (
              addonInput.price != null &&
              priceChanged(addonPrice, addonInput.price)
            ) {
              throw new CheckoutRejectedError(MENU_CHANGED_MESSAGE, "MENU_CHANGED");
            }
            addonsPrice += addonPrice;
            addonsDetails.push({ id: add.id, name: add.name, price: addonPrice });
          }
        }

        const totalUnitPrice = itemPrice + addonsPrice;
        subtotal += totalUnitPrice * cartItem.quantity;

        return {
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: cartItem.quantity,
          price: totalUnitPrice,
          notes: cartItem.notes ?? null,
          customizations: {
            variant: cartItem.customizations?.variant
              ? {
                  id: cartItem.customizations.variant.id,
                  name: cartItem.customizations.variant.name,
                  price: itemPrice,
                }
              : null,
            addons: addonsDetails,
          },
        };
      });

      // ── Append-to-open-order ──────────────────────────────────────────
      // If this table already has an open (in-progress) order, new items are
      // appended to it instead of starting a brand-new order. This keeps the
      // original order, its status timeline, and its payment history intact.
      const existingOrder =
        table.status === TableStatus.OCCUPIED
          ? await tx.order.findFirst({
              where: {
                tableId: table.id,
                status: {
                  in: [
                    OrderStatus.PLACED,
                    OrderStatus.PREPARING,
                    OrderStatus.PREPARED,
                    OrderStatus.READY,
                    OrderStatus.SERVED,
                  ],
                },
              },
              orderBy: { createdAt: "desc" },
              include: { payments: true },
            })
          : null;

      // Combined subtotal: previous order's subtotal + newly added items.
      const baseSubtotal = existingOrder
        ? toNumber(existingOrder.subtotal) + subtotal
        : subtotal;

      let discountAmount = 0;
      let offerCodeApplied: string | null = null;
      if (data.couponCode) {
        const offerVal = await validateOffer(data.couponCode, baseSubtotal);
        if (!offerVal.isValid || !offerVal.discountAmount) {
          // The cart validates against its own subtotal, but the server
          // validates against the combined open-order subtotal. Silently
          // dropping a code here made the charged total exceed the Grand
          // Total the customer saw — reject the whole checkout instead.
          const reason =
            "message" in offerVal && offerVal.message ? offerVal.message : undefined;
          throw new CheckoutRejectedError(
            `Coupon ${data.couponCode.toUpperCase().trim()} is no longer valid${reason ? `: ${reason}` : ""}. Please remove it and try again.`,
            "COUPON_INVALID"
          );
        }
        const claimedCode = offerVal.offer?.code ?? null;
        if (claimedCode && claimedCode !== existingOrder?.offerCode) {
          // Atomic claim: validateOffer's usageCount read happens on a
          // separate connection, so a plain increment let N concurrent
          // checkouts all pass `usageCount < usageLimit` and oversell the
          // offer. Re-check every condition AND increment in one statement —
          // exactly one caller wins the last redemption.
          const claimedRows = await tx.$queryRaw<Array<{ id: string }>>`
            UPDATE "Offer"
            SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
            WHERE "code" = ${claimedCode}
              AND "isActive" = true
              AND "expiryDate" >= NOW()
              AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
            RETURNING "id"
          `;
          if (claimedRows.length === 0) {
            throw new CheckoutRejectedError(
              `Coupon ${claimedCode} just ran out of redemptions. Please remove it and try again.`,
              "COUPON_INVALID"
            );
          }
        }
        discountAmount = offerVal.discountAmount;
        offerCodeApplied = claimedCode;
      } else if (existingOrder) {
        // No coupon in this checkout → carry over the existing order's discount.
        discountAmount = Math.min(
          toNumber(existingOrder.discountAmount),
          baseSubtotal
        );
        offerCodeApplied = existingOrder.offerCode;
      }

      const taxableAmount = Math.max(0, baseSubtotal - discountAmount);
      const gstPercentage = toNumber(settings.gstPercentage);
      const serviceChargePercentage = toNumber(settings.serviceChargePercentage);
      const gstAmount =
        Math.round(((taxableAmount * gstPercentage) / 100) * 100) / 100;
      const serviceChargeAmount =
        Math.round(
          ((taxableAmount * serviceChargePercentage) / 100) * 100
        ) / 100;
      const totalAmount =
        Math.round((taxableAmount + gstAmount + serviceChargeAmount) * 100) / 100;

      // Already-captured money on the existing order (e.g. a previous
      // Razorpay payment) — only the remainder is charged this time.
      // `let`: adjusted below when a PENDING row turns out to be paid already.
      let paidAmount = existingOrder
        ? existingOrder.payments
            .filter((p) => p.status === PaymentStatus.SUCCESS)
            .reduce((sum, p) => sum + toNumber(p.amount), 0)
        : 0;
      let amountDue = Math.max(
        0,
        Math.round((totalAmount - paidAmount) * 100) / 100
      );

      const isRazorpay = data.paymentMethod === PaymentMethod.RAZORPAY;

      let order: Awaited<ReturnType<typeof prisma.order.create>>;
      if (existingOrder) {
        // ── Append: same order keeps its id, status, and history ──
        order = existingOrder;

        await tx.orderItem.createMany({
          data: verifiedItems.map((item) => ({
            orderId: existingOrder.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            customizations: item.customizations,
          })),
        });

        await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            subtotal: baseSubtotal,
            discountAmount,
            gstAmount,
            serviceChargeAmount,
            totalAmount,
            offerCode: offerCodeApplied,
            notes: data.notes
              ? existingOrder.notes
                ? `${existingOrder.notes}\n${data.notes}`
                : data.notes
              : existingOrder.notes,
            // Keep original customer info; only refresh if empty.
            customerName: existingOrder.customerName || data.customerName,
            customerPhone: existingOrder.customerPhone || data.customerPhone || "",
            paymentMethod: data.paymentMethod as PaymentMethod,
          },
        });

        // A PENDING Razorpay row may already be paid — the capture can be in
        // flight while this append runs. Never delete rows that exist on
        // Razorpay's side, and count their captured amounts so the customer
        // is not charged twice for the same money.
        const pendingRzp: { id: string; rzpId: string }[] = [];
        for (const p of existingOrder.payments) {
          if (
            p.status === PaymentStatus.PENDING &&
            p.method === PaymentMethod.RAZORPAY &&
            p.transactionId
          ) {
            pendingRzp.push({ id: p.id, rzpId: p.transactionId });
          }
        }
        const keepIds: string[] = [];
        if (pendingRzp.length > 0) {
          try {
            const rzpClient = getRazorpayClient();
            for (const row of pendingRzp) {
              const res = await rzpClient.orders.fetchPayments(row.rzpId);
              // Keep any row with a live payment (created/authorized/captured)
              // so verify/webhook can still find it; only failed rows are stale.
              const live = res.items.filter((pay) => pay.status !== "failed");
              if (live.length > 0) {
                keepIds.push(row.id);
                const capturedRupees =
                  live
                    .filter((pay) => pay.status === "captured")
                    .reduce((sum, pay) => sum + Number(pay.amount), 0) / 100;
                if (capturedRupees > 0) {
                  paidAmount = Math.round((paidAmount + capturedRupees) * 100) / 100;
                }
              }
            }
          } catch (rzpError) {
            console.error("createOrder: Razorpay payment lookup failed:", rzpError);
            throw new Error(
              "Could not verify your previous payment. Please try again."
            );
          }
          amountDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
        }

        // Replace stale pending payments (rows with a live Razorpay payment
        // are kept so verify/webhook can still settle them).
        await tx.payment.deleteMany({
          where: {
            orderId: existingOrder.id,
            status: PaymentStatus.PENDING,
            id: { notIn: keepIds },
          },
        });
      } else {
        // ── New order (no open order on this table) ──
        order = await tx.order.create({
          data: {
            tableId: table.id,
            customerName: data.customerName,
            customerPhone: data.customerPhone ?? "",
            // For Razorpay: keep as CONFIRMED until payment is verified.
            // For Cash: immediate PLACED (customer pays at counter).
            status: isRazorpay ? OrderStatus.CONFIRMED : OrderStatus.PLACED,
            paymentStatus: PaymentStatus.PENDING,
            paymentMethod: data.paymentMethod as PaymentMethod,
            subtotal: baseSubtotal,
            discountAmount,
            gstAmount,
            serviceChargeAmount,
            totalAmount,
            offerCode: offerCodeApplied,
            notes: data.notes ?? null,
          },
        });

        await tx.orderItem.createMany({
          data: verifiedItems.map((item) => ({
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            customizations: item.customizations,
          })),
        });
      }

      // For Cash: occupy table and notify immediately.
      // For Razorpay: defer until payment is confirmed in /api/payments/verify.
      if (existingOrder) {
        // Appended items: the kitchen must know now, regardless of payment
        // method — the items stay on the order even if the payment modal is
        // dismissed (cancelUnpaidOrder never touches non-CONFIRMED orders).
        if (!isRazorpay) {
          await tx.table.update({
            where: { id: table.id },
            data: { status: TableStatus.OCCUPIED },
          });
        }

        await tx.notification.create({
          data: {
            title: `Additional Order! Table ${table.number}`,
            message: `${data.customerName} added items — order total ₹${totalAmount}`,
            type: NotificationType.NEW_ORDER,
          },
        });
      } else if (!isRazorpay) {
        await tx.table.update({
          where: { id: table.id },
          data: { status: TableStatus.OCCUPIED },
        });

        await tx.notification.create({
          data: {
            title: `New Order! Table ${table.number}`,
            message: `${data.customerName} placed an order for ₹${totalAmount}`,
            type: NotificationType.NEW_ORDER,
          },
        });
      }

      let razorpayOrder = null;
      // Charge only the remainder not already paid (full total for new orders,
      // since paidAmount is 0). New orders keep the legacy behaviour of always
      // creating a payment row.
      if (amountDue > 0 || !existingOrder) {
        if (isRazorpay) {
          try {
            console.log("[createOrder] Creating Razorpay order:", {
              orderId: order.id,
              amount: amountDue,
              currency: settings.currency || "INR",
            });

            const rzpOrder = await getRazorpayClient().orders.create({
              amount: Math.round(amountDue * 100),
              currency: settings.currency || "INR",
              receipt: `rcpt_${order.id.substring(0, 14)}`,
              notes: { orderId: order.id },
              payment: { capture: "automatic" },
            });

            const rzpOrderData = rzpOrder as unknown as { id: string; amount: number; currency: string };
            console.log("[createOrder] Razorpay order created:", rzpOrderData.id);

            razorpayOrder = {
              id: rzpOrderData.id,
              amount: rzpOrderData.amount,
              currency: rzpOrderData.currency,
            };

            await tx.payment.create({
              data: {
                orderId: order.id,
                amount: amountDue,
                method: PaymentMethod.RAZORPAY,
                transactionId: rzpOrder.id,
                status: PaymentStatus.PENDING,
              },
            });
          } catch (rzpError) {
            console.error("Razorpay order creation failed:", rzpError);
            throw new Error("Failed to initialize payment gateway.");
          }
        } else {
          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: amountDue,
              method: PaymentMethod.CASH,
              status: PaymentStatus.PENDING,
            },
          });
        }
      }

      // New money is owed on an appended order → reflect that until it's paid.
      if (existingOrder && amountDue > 0) {
        await tx.order.update({
          where: { id: existingOrder.id },
          data: { paymentStatus: PaymentStatus.PENDING },
        });
      }

      return { orderId: order.id, totalAmount, razorpayOrder, appended: !!existingOrder };
    });

    return { success: true, ...result };
  } catch (error: unknown) {
    if (error instanceof CheckoutRejectedError) {
      // Nothing was written (thrown inside the tx) — the client can offer a
      // targeted fix: refresh a stale cart or drop an invalid coupon.
      return { error: error.message, code: error.code };
    }
    const message = error instanceof Error ? error.message : "Checkout failed.";
    console.error("createOrder error:", error);
    return { error: message };
  }
}

/**
 * Cancels an unpaid Razorpay order when the customer dismisses the payment modal.
 * Only affects orders still in CONFIRMED status with PENDING payment.
 */
export async function cancelUnpaidOrder(orderId: string, tableId: string) {
  if (!orderId || typeof orderId !== "string") return;
  if (!tableId || typeof tableId !== "string") return;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, paymentStatus: true, tableId: true, offerCode: true },
      });

      if (!order) return;
      if (order.tableId !== tableId) return;
      if (order.status !== OrderStatus.CONFIRMED) return;
      if (order.paymentStatus !== PaymentStatus.PENDING) return;

      // The modal can be dismissed while a Razorpay capture is still in
      // flight — deleting the order here would erase the record of money
      // already taken. Ask Razorpay first; only delete when we're sure no
      // payment exists (or the check fails → keep the order, fail safe).
      const rzpRows = await tx.payment.findMany({
        where: { orderId, method: PaymentMethod.RAZORPAY },
        select: { transactionId: true },
      });
      const rzpOrderIds = rzpRows
        .map((p) => p.transactionId)
        .filter((id): id is string => !!id);
      if (rzpOrderIds.length > 0) {
        try {
          const rzpClient = getRazorpayClient();
          for (const rzpId of rzpOrderIds) {
            const res = await rzpClient.orders.fetchPayments(rzpId);
            if (res.items.some((pay) => pay.status !== "failed")) {
              // A live payment exists (or is being captured) — leave the
              // order alone so verify/webhook can still settle it.
              return;
            }
          }
        } catch (rzpError) {
          console.error("cancelUnpaidOrder: Razorpay lookup failed:", rzpError);
          return; // fail safe — keep the order rather than risk deleting paid records
        }
      }

      // The order is deleted outright (not just marked CANCELLED) — return
      // its coupon redemption, otherwise every dismissed payment modal
      // permanently consumes a redemption of an offer that was never used.
      if (order.offerCode) {
        await tx.offer.updateMany({
          where: { code: order.offerCode, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
      }

      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    });
  } catch (error: unknown) {
    console.error("cancelUnpaidOrder error:", error);
  }
}

/**
 * Fetches a customer-facing order by ID.
 * This is a public action — no authentication required by design (customers need
 * to track their own order after paying). No sensitive staff data is exposed.
 */
export async function getCustomerOrder(id: string) {
  if (!id || typeof id !== "string") return null;
  try {
    return prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        subtotal: true,
        discountAmount: true,
        gstAmount: true,
        serviceChargeAmount: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        table: { select: { number: true } },
        orderItems: {
          select: {
            id: true,
            quantity: true,
            price: true,
            notes: true,
            customizations: true,
            menuItem: { select: { id: true, name: true, images: true } },
          },
        },
        payments: {
          select: { id: true, status: true, method: true, amount: true, createdAt: true },
        },
        invoices: {
          select: { id: true, invoiceNumber: true, amount: true, createdAt: true },
        },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Creates a waiter-call or bill-request notification.
 * Public action — no auth required (customer-facing). Table existence is
 * validated from the database, not from user input.
 */
export async function requestService(
  tableId: string,
  type: "CALL_WAITER" | "REQUEST_BILL",
  tableToken: string
) {
  if (!tableId || typeof tableId !== "string") return { error: "Invalid table." };

  // Same table-token binding as createOrder — a leaked table UUID can't
  // spam notifications for a table the caller never opened.
  if (typeof tableToken !== "string" || verifyTableToken(tableToken) !== tableId) {
    return { error: "Invalid table token. Please reopen the menu from your table's QR code." };
  }

  // Bound per table so a single party can't flood the waiter/board.
  const { allowed } = await checkRateLimit(`service:${tableId}`, 10, 5 * 60_000);
  if (!allowed) {
    return { error: "Please wait a moment before making another request." };
  }

  try {
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new Error("Table not found.");

    const notificationType =
      type === "CALL_WAITER"
        ? NotificationType.CALL_WAITER
        : NotificationType.REQUEST_BILL;

    await prisma.notification.create({
      data: {
        title: type === "CALL_WAITER" ? "Waiter Requested!" : "Bill Requested!",
        message:
          type === "CALL_WAITER"
            ? `Table ${table.number} has called the waiter.`
            : `Table ${table.number} has requested their final bill.`,
        type: notificationType,
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Service request failed.";
    return { error: message };
  }
}

/**
 * Submits a post-meal review.
 * Public action — no auth required (customer-facing).
 * Input is sanitized — customerName is trimmed, rating is clamped.
 */
export async function submitReview(data: {
  orderId?: string;
  menuItemId?: string;
  customerName: string;
  rating: number;
  comment?: string;
  images?: string[];
}) {
  const customerName = String(data.customerName ?? "").trim().slice(0, 100);
  const rating = Math.max(1, Math.min(5, Math.round(Number(data.rating))));
  const comment = data.comment ? String(data.comment).slice(0, 2000) : null;

  // Public endpoint with no auth and no table context — cap per client IP
  // so it can't be used to flood the review list with junk.
  const ip = await getServerActionIp();
  const { allowed } = await checkRateLimit(`review:${ip}`, 10, 60 * 60_000);
  if (!allowed) {
    return { error: "Too many reviews. Please try again later." };
  }

  try {
    const review = await prisma.review.create({
      data: {
        orderId: data.orderId ?? null,
        menuItemId: data.menuItemId ?? null,
        customerName,
        rating,
        comment,
        images: data.images ?? [],
      },
    });
    return { success: true, review };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit review.";
    return { error: message };
  }
}

// ─── Staff (authenticated) ────────────────────────────────────────────────────

export async function getOrders() {
  const user = await requireStaff();
  // An expired session is not "no orders" — send the operator to sign in
  // instead of showing a silently empty dashboard.
  if (!user) redirect("/login");

  try {
    return prisma.order.findMany({
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
        payments: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("getOrders failed:", error);
    // Let React Query surface a real error rather than rendering ₹0 / "no
    // orders found" as if the database were simply empty.
    throw new Error("Could not load orders. Please try again.");
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const user = await requireStaff();
  if (!user) return { error: "Unauthorized" };

  try {
    // Refund pass — runs BEFORE the transaction: Razorpay is a network call
    // and must not hold a DB transaction open. Every captured RAZORPAY payment
    // is actually returned first; only then may the tx mark anything
    // REFUNDED. Only SUCCESS rows are attempted, so retrying after a partial
    // failure refunds exactly the remaining ones.
    if (status === OrderStatus.CANCELLED) {
      const refundTargets = await prisma.order.findUnique({
        where: { id },
        select: {
          paymentStatus: true,
          payments: {
            where: { method: PaymentMethod.RAZORPAY, status: PaymentStatus.SUCCESS },
            select: { id: true, paymentId: true, transactionId: true },
          },
        },
      });

      if (
        refundTargets?.paymentStatus === PaymentStatus.SUCCESS &&
        refundTargets.payments.length > 0
      ) {
        const refundedRowIds: string[] = [];
        const failures: string[] = [];

        for (const payment of refundTargets.payments) {
          const result = payment.paymentId
            ? await refundRazorpayPayment(payment.paymentId)
            : payment.transactionId
              ? await refundRazorpayOrderPayments(payment.transactionId)
              : { ok: false as const, message: "payment row has no Razorpay reference" };

          if (result.ok) refundedRowIds.push(payment.id);
          else failures.push(result.message);
        }

        // Persist successes even when others failed — a retry then only
        // attempts the payments still marked SUCCESS.
        if (refundedRowIds.length > 0) {
          await prisma.payment.updateMany({
            where: { id: { in: refundedRowIds } },
            data: { status: PaymentStatus.REFUNDED },
          });
        }

        if (failures.length > 0) {
          return {
            error:
              `Refund failed for ${failures.length} payment(s), so the order was NOT cancelled. ` +
              `Retry cancelling — only not-yet-refunded payments will be attempted. (${failures[0]})`,
          };
        }
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Read the pre-transition status first: the guarded update below
      // writes the new status, and "leaving CONFIRMED" must be judged
      // against the old value.
      const before = await tx.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!before) throw new Error("Order not found.");

      // Atomic guard: COMPLETED and CANCELLED are terminal — once an order is
      // there, no later transition may re-enter (double table-free, false
      // REFUNDED, duplicate-invoice crash). updateMany is atomic, so two
      // concurrent requests can't both pass.
      const guarded = await tx.order.updateMany({
        where: {
          id,
          status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
        },
        data: { status },
      });

      if (guarded.count === 0) {
        const current = await tx.order.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!current) throw new Error("Order not found.");
        throw new Error(
          `Order is already ${getOrderStatusLabel(current.status)} — its status cannot be changed.`
        );
      }

      const order = await tx.order.findUnique({
        where: { id },
        include: { table: true },
      });
      if (!order) throw new Error("Order not found.");

      // Manually advancing a paid order out of CONFIRMED (its verify/webhook
      // transition never ran): occupy the table and notify, mirroring
      // /api/payments/verify — both were previously skipped, so the table
      // stayed AVAILABLE while food was being prepared for it.
      if (
        before.status === OrderStatus.CONFIRMED &&
        status !== OrderStatus.CONFIRMED &&
        status !== OrderStatus.CANCELLED
      ) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
        await tx.notification.create({
          data: {
            title: `New Order! Table ${order.table.number}`,
            message: `${order.customerName} placed an order for ₹${toNumber(order.totalAmount)}`,
            type: NotificationType.NEW_ORDER,
          },
        });
      }

      if (status === OrderStatus.READY) {
        await tx.notification.create({
          data: {
            title: `Order Ready! Table ${order.table.number}`,
            message: `Order for ${order.customerName} is prepared and ready to serve.`,
            type: NotificationType.KITCHEN_READY,
          },
        });
      } else if (status === OrderStatus.COMPLETED) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });

        // Collision-free invoice numbering: count()+1 let two concurrent
        // completions derive the same number, and the loser's insert aborted
        // the ENTIRE completion tx (table-free + cash-SUCCESS + status rolled
        // back too) on invoiceNumber @unique. nextval is atomic — no lock
        // held for the rest of the tx, no retry loop needed.
        const invoiceSeq = await tx.$queryRaw<Array<{ nextval: unknown }>>`
          SELECT nextval('"InvoiceInvoiceNumberSeq"') AS nextval
        `;
        const invoiceNumber = `INV-${String(invoiceSeq[0]?.nextval ?? 1).padStart(4, "0")}`;

        await tx.invoice.create({
          data: {
            orderId: order.id,
            invoiceNumber,
            amount: order.totalAmount,
            taxAmount: order.gstAmount,
            discountAmount: order.discountAmount,
          },
        });

        if (order.paymentMethod === PaymentMethod.CASH) {
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.SUCCESS },
          });
          await tx.payment.updateMany({
            where: { orderId: id, method: PaymentMethod.CASH },
            data: { status: PaymentStatus.SUCCESS },
          });
        }

        // Send email receipt only if Resend is configured and a valid email exists
        if (resend) {
          const customerEmail = order.customerName.includes("@")
            ? order.customerName // legacy: email stored in customerName field
            : null;

          // In production, you should store customerEmail in its own column.
          // Until then we only send if the name looks like an email.
          if (customerEmail) {
            try {
              await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || "receipts@resend.dev",
                to: customerEmail,
                subject: `Invoice ${invoiceNumber} | QRFast`,
                html: `<p>Dear Customer,</p><p>Thank you for dining with us! Here is your bill summary:</p><ul><li>Invoice: ${invoiceNumber}</li><li>Subtotal: ₹${toNumber(order.subtotal)}</li><li>Discount: ₹${toNumber(order.discountAmount)}</li><li>GST: ₹${toNumber(order.gstAmount)}</li><li>Service Charge: ₹${toNumber(order.serviceChargeAmount)}</li><li><strong>Grand Total: ₹${toNumber(order.totalAmount)}</strong></li></ul><p>We hope to see you again soon!</p>`,
              });
            } catch (resendError) {
              console.error("Email send failed:", resendError);
              // Non-fatal — order is still completed
            }
          }
        }
      } else if (status === OrderStatus.CANCELLED) {
        // Return this order's coupon redemption. The guarded updateMany above
        // guarantees at most one transition into CANCELLED per order, so this
        // can't double-decrement (gated on usageCount > 0 regardless).
        if (order.offerCode) {
          await tx.offer.updateMany({
            where: { code: order.offerCode, usageCount: { gt: 0 } },
            data: { usageCount: { decrement: 1 } },
          });
        }

        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });

        if (order.paymentStatus === PaymentStatus.SUCCESS) {
          // A RAZORPAY payment still SUCCESS here settled AFTER the pre-tx
          // refund pass (webhook race) — marking it REFUNDED would claim money
          // back that was never returned. Abort the cancel; the retry re-runs
          // the refund pass. Cash rows are unaffected (bookkeeping refund).
          const unsettledRazorpay = await tx.payment.count({
            where: {
              orderId: id,
              method: PaymentMethod.RAZORPAY,
              status: PaymentStatus.SUCCESS,
            },
          });
          if (unsettledRazorpay > 0) {
            throw new Error(
              "A payment settled while cancelling — please retry (it will be refunded first)."
            );
          }

          await tx.payment.updateMany({
            where: { orderId: id },
            data: { status: PaymentStatus.REFUNDED },
          });
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          });
        } else {
          await tx.payment.updateMany({
            where: { orderId: id },
            data: { status: PaymentStatus.FAILED },
          });
          await tx.order.update({
            where: { id },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        }
      }

      return order;
    });

    revalidatePath("/dashboard/orders");
    return { success: true, order: updatedOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus
) {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  if (paymentStatus === PaymentStatus.REFUNDED) {
    // Claiming REFUNDED here would state money was returned without ever
    // calling the refund API — cancellations do that properly (updateOrderStatus
    // refunds first, then marks). The orders UI never offers this value.
    return { error: "Use the order's Cancel action to refund a paid order." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          status: true,
          tableId: true,
          customerName: true,
          totalAmount: true,
          table: { select: { number: true } },
        },
      });
      if (!order) throw new Error("Order not found.");

      await tx.order.update({ where: { id }, data: { paymentStatus } });
      await tx.payment.updateMany({ where: { orderId: id }, data: { status: paymentStatus } });

      // Marking a paid order SUCCESS must finalize it exactly like
      // /api/payments/verify does: without CONFIRMED → PLACED the order
      // never reaches the kitchen board (CONFIRMED isn't shown there) and
      // the table is never occupied.
      if (
        paymentStatus === PaymentStatus.SUCCESS &&
        order.status === OrderStatus.CONFIRMED
      ) {
        await tx.order.update({
          where: { id },
          data: { status: OrderStatus.PLACED },
        });
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
        await tx.notification.create({
          data: {
            title: `New Order! Table ${order.table.number}`,
            message: `${order.customerName} placed an order for ₹${toNumber(order.totalAmount)}`,
            type: NotificationType.NEW_ORDER,
          },
        });
      }

      await tx.notification.create({
        data: {
          title: "Payment Updated",
          message: `Order payment status changed to ${paymentStatus}.`,
          type: NotificationType.PAYMENT,
        },
      });
    });

    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return { error: message };
  }
}
