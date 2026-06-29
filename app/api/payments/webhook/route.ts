import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Webhook signature header missing." },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Razorpay webhook secret is not configured." },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.warn("Razorpay Webhook signature verification failed.");
      return NextResponse.json(
        { error: "Webhook verification failed. Signature mismatch." },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    console.log(`Razorpay Webhook received event: ${event}`);

    if (event === "payment.captured") {
      const paymentEntity = payload.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              paymentId: razorpayPaymentId,
              status: PaymentStatus.SUCCESS,
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: PaymentStatus.SUCCESS,
            },
          });
        }
      });
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: PaymentStatus.FAILED,
            },
          });
        }
      });
    }

    return NextResponse.json({ status: "success" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error("Razorpay webhook handler exception:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
