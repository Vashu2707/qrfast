import Razorpay from "razorpay";

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export type RefundResult = { ok: true } | { ok: false; message: string };

function isAlreadyRefunded(message: string): boolean {
  // A retry after a crash between the API call and our DB write lands here:
  // the money is already back, so treat it as success (also covers partial →
  // full completion attempts that exceed the refundable balance).
  return /already|exceed|refund_status/i.test(message);
}

/**
 * Refunds a captured Razorpay payment in full (or the remaining balance of a
 * partially-refunded one). Never throws — callers decide whether a failed
 * refund should block the surrounding operation.
 */
export async function refundRazorpayPayment(paymentId: string): Promise<RefundResult> {
  try {
    const rzp = getRazorpayClient();
    await rzp.payments.refund(paymentId, {});
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAlreadyRefunded(message)) {
      console.warn("refundRazorpayPayment: already refunded:", message);
      return { ok: true };
    }
    console.error("refundRazorpayPayment failed:", error);
    return { ok: false, message };
  }
}

/**
 * Fallback for payment rows that predate local `paymentId` storage (the
 * `order.paid` webhook can mark a payment SUCCESS before `payment.captured`
 * stores the id): refunds every not-yet-refunded captured payment on the
 * Razorpay order identified by the row's transactionId.
 */
export async function refundRazorpayOrderPayments(razorpayOrderId: string): Promise<RefundResult> {
  try {
    const rzp = getRazorpayClient();
    const { items } = await rzp.orders.fetchPayments(razorpayOrderId);
    const capturable = items.filter(
      (p) => p.status === "captured" && p.refund_status !== "full"
    );

    for (const payment of capturable) {
      const params =
        payment.refund_status === "partial"
          ? {
              amount:
                Number(payment.amount) - Number(payment.amount_refunded ?? 0),
            }
          : {};
      await rzp.payments.refund(payment.id, params);
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAlreadyRefunded(message)) return { ok: true };
    console.error("refundRazorpayOrderPayments failed:", error);
    return { ok: false, message };
  }
}
