import { NextResponse } from "next/server";
import { generateBillHtml } from "@/lib/bill-generator";
import { getCurrentUser } from "@/actions/auth";
import prisma from "@/lib/prisma";
import { verifyActiveTableToken } from "@/lib/table-token";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const user = await getCurrentUser();
  let authorized = Boolean(user);

  if (!authorized) {
    const tableToken = new URL(_request.url).searchParams.get("table");
    if (tableToken) {
      const token = await verifyActiveTableToken(tableToken);
      if (token) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { tableId: true },
        });
        // A table's QR token proves only "this table" — it must not unlock
        // every historical bill at that table. The order-tracking page issues
        // a token scoped to that one orderId; require the exact match here.
        authorized =
          order?.tableId === token.tableId && token.orderId === orderId;
      }
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
