import { OrderTrackingClient } from "@/components/features/order/order-tracking";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;

  // Fetch the order to get the table number (so we can build the "Order More" link)
  const order = await prisma.order.findUnique({
    where: { id },
    select: { table: { select: { number: true } } },
  });

  // Fetch restaurant settings for primary color
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { primaryColor: true },
  });

  const tableParam = order ? `table-${order.table.number}` : undefined;
  const primaryColor = settings?.primaryColor ?? "#E11D48";

  return (
    <OrderTrackingClient
      orderId={id}
      tableParam={tableParam}
      primaryColor={primaryColor}
    />
  );
}
