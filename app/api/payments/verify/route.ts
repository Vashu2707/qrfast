import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required verification parameters." },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Razorpay verification secret is not configured." },
        { status: 500 }
      );
    }

    // 1. Verify Razorpay Signature
    const hash = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hash !== razorpay_signature) {
      console.warn("Razorpay verification failed: Signature mismatch.");
      return NextResponse.json(
        { error: "Payment verification failed. Invalid signature." },
        { status: 400 }
      );
    }

    // 2. Transactionally update Payment and Order statuses to SUCCESS
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { transactionId: razorpay_order_id },
      });

      if (!payment) {
        throw new Error("Local payment record not found.");
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          status: PaymentStatus.SUCCESS,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Payment verified successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error("Razorpay verification handler exception:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
