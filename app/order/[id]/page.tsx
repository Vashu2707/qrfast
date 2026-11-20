import { OrderTrackingClient } from "@/components/features/order/order-tracking";
import prisma from "@/lib/prisma";
import { generateTableToken } from "@/lib/table-token";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { table: { select: { id: true, tokenGeneration: true } } },
  });

  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { primaryColor: true },
  });

  // Scoped to this order so the token can download this bill but cannot be
  // used as a table QR to read other orders' bills. Regenerated per request,
  // so it always carries the table's current generation.
  const tableParam = order
    ? generateTableToken(order.table.id, {
        generation: order.table.tokenGeneration,
        orderId: id,
      })
    : undefined;
  const primaryColor = settings?.primaryColor ?? "#E11D48";

  return (
    <OrderTrackingClient
      orderId={id}
      tableParam={tableParam}
      primaryColor={primaryColor}
    />
  );
}
