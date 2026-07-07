import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

// Never cache webhook endpoints
export const dynamic = "force-dynamic";

const WEBHOOK_NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Webhook signature header missing." },
        { status: 400, headers: WEBHOOK_NO_CACHE_HEADERS }
      );
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured.");
      return NextResponse.json(
        { error: "Webhook endpoint is not configured." },
        { status: 500, headers: WEBHOOK_NO_CACHE_HEADERS }
      );
    }

    // Verify webhook HMAC signature against the raw request body
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.warn("Razorpay webhook: signature mismatch.");
      return NextResponse.json(
        { error: "Webhook verification failed." },
        { status: 400, headers: WEBHOOK_NO_CACHE_HEADERS }
      );
    }

    const payload = JSON.parse(rawBody);
    const event: string = payload.event;

    if (event === "payment.captured") {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return NextResponse.json({ status: "ignored" }, { headers: WEBHOOK_NO_CACHE_HEADERS });
      }

      const razorpayOrderId: string = paymentEntity.order_id;
      const razorpayPaymentId: string = paymentEntity.id;

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { paymentId: razorpayPaymentId, status: PaymentStatus.SUCCESS },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: PaymentStatus.SUCCESS },
          });
        }
      });
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payload?.payment?.entity;
      if (!paymentEntity) {
        return NextResponse.json({ status: "ignored" }, { headers: WEBHOOK_NO_CACHE_HEADERS });
      }

      const razorpayOrderId: string = paymentEntity.order_id;

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { transactionId: razorpayOrderId },
        });

        if (payment && payment.status !== PaymentStatus.SUCCESS) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
          await tx.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        }
      });
    }

    return NextResponse.json(
      { status: "success" },
      { headers: WEBHOOK_NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    console.error("Razorpay webhook exception:", error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: WEBHOOK_NO_CACHE_HEADERS }
    );
  }
}
