"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import { resend } from "@/lib/resend";
import { validateCoupon } from "./coupons";
import { getCurrentUser } from "./auth";
import { OrderStatus, PaymentStatus, PaymentMethod, NotificationType, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createOrder(data: any) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get Table and Restaurant config
      const table = await tx.table.findUnique({
        where: { id: data.tableId },
        include: { restaurant: { include: { settings: true } } },
      });

      if (!table) throw new Error("Table not found.");
      const restaurant = table.restaurant;
      const settings = restaurant.settings;
      if (!settings) throw new Error("Restaurant settings not initialized.");

      // 2. Fetch all menu items in cart to calculate prices securely on the server
      const itemIds = data.items.map((i: any) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds }, restaurantId: restaurant.id },
        include: { variants: true, addons: true },
      });

      // 3. Compute Cart Subtotal
      let subtotal = 0;
      const verifiedItems = data.items.map((cartItem: any) => {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (!menuItem) throw new Error(`Menu item ${cartItem.menuItemId} not found.`);

        // Determine price
        let itemPrice = menuItem.price;
        if (menuItem.discountPrice) {
          itemPrice = menuItem.discountPrice;
        }

        // Adjust for variant
        if (cartItem.customizations?.variant) {
          const v = menuItem.variants.find((x) => x.id === cartItem.customizations.variant.id);
          if (v) itemPrice = v.price;
        }

        // Adjust for addons
        let addonsPrice = 0;
        const addonsDetails: any[] = [];
        if (cartItem.customizations?.addons) {
          cartItem.customizations.addons.forEach((addonInput: any) => {
            const add = menuItem.addons.find((a) => a.id === addonInput.id);
            if (add) {
              addonsPrice += add.price;
              addonsDetails.push({ id: add.id, name: add.name, price: add.price });
            }
          });
        }

        const totalUnitItemPrice = itemPrice + addonsPrice;
        subtotal += totalUnitItemPrice * cartItem.quantity;

        return {
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: cartItem.quantity,
          price: totalUnitItemPrice,
          notes: cartItem.notes || null,
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

      // 4. Verify & Apply Coupon
      let discountAmount = 0;
      let couponCodeApplied = null;
      if (data.couponCode) {
        const couponVal = await validateCoupon(restaurant.id, data.couponCode, subtotal);
        if (couponVal.isValid && couponVal.discountAmount) {
          discountAmount = couponVal.discountAmount;
          couponCodeApplied = couponVal.coupon?.code;

          // Increment coupon usage
          await tx.coupon.update({
            where: { restaurantId_code: { restaurantId: restaurant.id, code: couponCodeApplied! } },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // 5. Calculate GST & Service Charge
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const gstAmount = Math.round(((taxableAmount * settings.gstPercentage) / 100) * 100) / 100;
      const serviceChargeAmount = Math.round(((taxableAmount * settings.serviceChargePercentage) / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + gstAmount + serviceChargeAmount) * 100) / 100;

      // 6. Create Order
      const order = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          tableId: table.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          status: OrderStatus.PLACED,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: data.paymentMethod,
          subtotal,
          discountAmount,
          gstAmount,
          serviceChargeAmount,
          totalAmount,
          couponCode: couponCodeApplied,
          notes: data.notes || null,
        },
      });

      // Create OrderItems
      for (const item of verifiedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            customizations: item.customizations,
          },
        });
      }

      // Mark Table as OCCUPIED
      await tx.table.update({
        where: { id: table.id },
        data: { status: TableStatus.OCCUPIED },
      });

      // Create staff notification
      await tx.notification.create({
        data: {
          restaurantId: restaurant.id,
          title: `New Order! Table ${table.number}`,
          message: `${data.customerName} placed an order for ₹${totalAmount}`,
          type: NotificationType.NEW_ORDER,
        },
      });

      // 7. Handle Razorpay Payment Generation
      let razorpayOrder = null;
      if (data.paymentMethod === PaymentMethod.RAZORPAY) {
        try {
          const razorpayInstance = await getRazorpayClient().orders.create({
            amount: Math.round(totalAmount * 100), // amount in paise
            currency: settings.currency || "INR",
            receipt: `rcpt_${order.id.substring(0, 14)}`,
            notes: {
              orderId: order.id,
              restaurantId: restaurant.id,
            },
          });

          razorpayOrder = {
            id: razorpayInstance.id,
            amount: razorpayInstance.amount,
            currency: razorpayInstance.currency,
          };

          // Save payment details (pending)
          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: totalAmount,
              method: PaymentMethod.RAZORPAY,
              transactionId: razorpayInstance.id,
              status: PaymentStatus.PENDING,
            },
          });
        } catch (rzpError) {
          console.error("Razorpay Order Creation Failed:", rzpError);
          throw new Error("Failed to initialize Razorpay payment gateway.");
        }
      } else {
        // Cash payment record
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: totalAmount,
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          },
        });
      }

      return { orderId: order.id, totalAmount, razorpayOrder };
    });

    return { success: true, ...result };
  } catch (error: any) {
    console.error("Checkout server action error:", error);
    return { error: error.message || "Something went wrong during checkout." };
  }
}

export async function getCustomerOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      table: true,
      restaurant: { include: { settings: true } },
      orderItems: { include: { menuItem: true } },
      payments: true,
    },
  });
}

export async function getOrders() {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) throw new Error("Unauthorized");

  return prisma.order.findMany({
    where: { restaurantId: user.restaurantId },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id, restaurantId: user.restaurantId! },
        data: { status },
        include: { table: true, restaurant: true },
      });

      // Realtime actions based on status progression
      if (status === OrderStatus.READY) {
        // Notify customer or table
        await tx.notification.create({
          data: {
            restaurantId: user.restaurantId!,
            title: `Order Ready! Table ${order.table.number}`,
            message: `Order for ${order.customerName} is prepared and ready to serve.`,
            type: NotificationType.KITCHEN_READY,
          },
        });
      } else if (status === OrderStatus.COMPLETED) {
        // Mark table as AVAILABLE
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });

        // Auto-generate invoice
        const count = await tx.invoice.count();
        const invoiceNumber = `INV-${order.restaurant.slug.toUpperCase()}-${String(count + 1).padStart(4, "0")}`;

        await tx.invoice.create({
          data: {
            orderId: order.id,
            invoiceNumber,
            amount: order.totalAmount,
            taxAmount: order.gstAmount,
            discountAmount: order.discountAmount,
          },
        });

        // If Cash, auto-mark payment as SUCCESS when completed
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

        // Send email notification via Resend (Safely)
        try {
          if (process.env.RESEND_API_KEY && order.restaurant.email) {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || "receipts@resend.dev",
              to: order.restaurant.email,
              subject: `Invoice ${invoiceNumber} | The Bistro`,
              html: `<p>Dear ${order.customerName},</p><p>Thank you for dining with us! Here is your bill summary:</p><ul><li>Invoice Number: ${invoiceNumber}</li><li>Subtotal: ₹${order.subtotal}</li><li>Discount: ₹${order.discountAmount}</li><li>GST (Tax): ₹${order.gstAmount}</li><li>Service Charge: ₹${order.serviceChargeAmount}</li><li><strong>Grand Total: ₹${order.totalAmount}</strong></li></ul><p>We hope to see you again soon!</p>`,
            });
          }
        } catch (resendError) {
          console.error("Resend Email Send Error:", resendError);
        }
      }

      return order;
    });

    revalidatePath("/dashboard/orders");
    return { success: true, order: updatedOrder };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateOrderPaymentStatus(id: string, paymentStatus: PaymentStatus) {
  const user = await getCurrentUser();
  if (!user || !user.restaurantId) return { error: "Unauthorized" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id, restaurantId: user.restaurantId! },
        data: { paymentStatus },
      });

      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: paymentStatus },
      });

      // Log invoice or notify
      await tx.notification.create({
        data: {
          restaurantId: user.restaurantId!,
          title: `Payment Updated`,
          message: `Order payment status changed to ${paymentStatus} for Table.`,
          type: NotificationType.PAYMENT,
        },
      });
    });

    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Request Bill or Call Waiter
export async function requestService(tableId: string, type: "CALL_WAITER" | "REQUEST_BILL") {
  try {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { restaurant: true },
    });

    if (!table) throw new Error("Table not found.");

    const notificationType =
      type === "CALL_WAITER" ? NotificationType.CALL_WAITER : NotificationType.REQUEST_BILL;

    const title = type === "CALL_WAITER" ? "Waiter Requested!" : "Bill Requested!";
    const message =
      type === "CALL_WAITER"
        ? `Table ${table.number} has called the waiter.`
        : `Table ${table.number} has requested their final bill.`;

    await prisma.notification.create({
      data: {
        restaurantId: table.restaurantId,
        title,
        message,
        type: notificationType,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Submit Item/Order Review
export async function submitReview(data: {
  orderId?: string;
  menuItemId?: string;
  customerName: string;
  rating: number;
  comment?: string;
  images?: string[];
}) {
  try {
    const review = await prisma.review.create({
      data: {
        orderId: data.orderId || null,
        menuItemId: data.menuItemId || null,
        customerName: data.customerName,
        rating: data.rating,
        comment: data.comment || null,
        images: data.images || [],
      },
    });

    return { success: true, review };
  } catch (error: any) {
    return { error: error.message };
  }
}
