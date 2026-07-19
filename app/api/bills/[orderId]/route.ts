import { NextResponse } from "next/server";
import { generateBillHtml } from "@/lib/bill-generator";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const html = await generateBillHtml(orderId);
  if (!html) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
