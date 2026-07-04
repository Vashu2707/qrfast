"use server";

import prisma from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import { resend } from "@/lib/resend";
import { getCurrentUser } from "./auth";
import { validateOffer } from "./offers";
import { OrderStatus, PaymentStatus, PaymentMethod, NotificationType, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createOrder(data: any) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({
        where: { id: data.tableId },
      });

      if (!table) throw new Error("Table not found.");

      const settings = await tx.settings.findUnique({
        where: { id: "singleton" },
      });
      if (!settings) throw new Error("Restaurant settings not initialized.");

      const itemIds = data.items.map((i: any) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds } },
        include: { variants: true, addons: true },
      });

      let subtotal = 0;
      const verifiedItems = data.items.map((cartItem: any) => {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (!menuItem) throw new Error(`Menu item ${cartItem.menuItemId} not found.`);

        let itemPrice = menuItem.price;
        if (menuItem.discountPrice) {
          itemPrice = menuItem.discountPrice;
        }

        if (cartItem.customizations?.variant) {
          const v = menuItem.variants.find((x) => x.id === cartItem.customizations.variant.id);
          if (v) itemPrice = v.price;
        }

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

      let discountAmount = 0;
      let offerCodeApplied = null;
      if (data.couponCode) {
        const offerVal = await validateOffer(data.couponCode, subtotal);
        if (offerVal.isValid && offerVal.discountAmount) {
          discountAmount = offerVal.discountAmount;
          offerCodeApplied = offerVal.offer?.code;

          await tx.offer.update({
            where: { code: offerCodeApplied! },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const gstAmount = Math.round(((taxableAmount * settings.gstPercentage) / 100) * 100) / 100;
      const serviceChargeAmount = Math.round(((taxableAmount * settings.serviceChargePercentage) / 100) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + gstAmount + serviceChargeAmount) * 100) / 100;

      const order = await tx.order.create({
        data: {
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
          offerCode: offerCodeApplied,
          notes: data.notes || null,
        },
      });

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

      let razorpayOrder = null;
      if (data.paymentMethod === PaymentMethod.RAZORPAY) {
        try {
          const razorpayInstance = await getRazorpayClient().orders.create({
            amount: Math.round(totalAmount * 100),
            currency: settings.currency || "INR",
            receipt: `rcpt_${order.id.substring(0, 14)}`,
            notes: {
              orderId: order.id,
            },
          });

          razorpayOrder = {
            id: razorpayInstance.id,
            amount: razorpayInstance.amount,
            currency: razorpayInstance.currency,
          };

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
      orderItems: { include: { menuItem: true } },
      payments: true,
    },
  });
}

export async function getOrders() {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.order.findMany({
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
  if (!user) return { error: "Unauthorized" };

  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { status },
        include: { table: true },
      });

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

        const count = await tx.invoice.count();
        const invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;

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

        try {
          if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || "receipts@resend.dev",
              to: order.customerName,
              subject: `Invoice ${invoiceNumber} | Your Restaurant`,
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
  if (!user) return { error: "Unauthorized" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { paymentStatus },
      });

      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: paymentStatus },
      });

      await tx.notification.create({
        data: {
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

export async function requestService(tableId: string, type: "CALL_WAITER" | "REQUEST_BILL") {
  try {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
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
