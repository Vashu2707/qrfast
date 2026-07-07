import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

// Never cache payment endpoints
export const dynamic = "force-dynamic";

const PAYMENT_NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required verification parameters." },
        { status: 400, headers: PAYMENT_NO_CACHE_HEADERS }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Payment verification is not configured." },
        { status: 500, headers: PAYMENT_NO_CACHE_HEADERS }
      );
    }

    // Verify Razorpay HMAC signature
    const hash = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hash !== razorpay_signature) {
      console.warn("Razorpay verification failed: signature mismatch.");
      return NextResponse.json(
        { error: "Payment verification failed. Invalid signature." },
        { status: 400, headers: PAYMENT_NO_CACHE_HEADERS }
      );
    }

    // Transactionally update Payment and Order to SUCCESS
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { transactionId: razorpay_order_id },
      });

      if (!payment) throw new Error("Local payment record not found.");

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
        data: { paymentStatus: PaymentStatus.SUCCESS },
      });
    });

    return NextResponse.json(
      { success: true, message: "Payment verified successfully." },
      { headers: PAYMENT_NO_CACHE_HEADERS }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    console.error("Razorpay verify exception:", error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: PAYMENT_NO_CACHE_HEADERS }
    );
  }
}
