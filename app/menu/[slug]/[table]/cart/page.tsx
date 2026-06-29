import { notFound } from "next/navigation";
import { getPublicMenu } from "@/actions/public-menu";
import { CartClient } from "@/components/features/menu/cart-client";

interface Props {
  params: Promise<{ slug: string; table: string }>;
}

export default async function CartPage({ params }: Props) {
  const { slug, table } = await params;
  const data = await getPublicMenu(slug, table);
  if (!data) notFound();

  const settings = data.restaurant.settings!;

  return (
    <CartClient
      slug={slug}
      tableParam={table}
      gstPercentage={settings.gstPercentage}
      serviceChargePercentage={settings.serviceChargePercentage}
      primaryColor={settings.primaryColor}
      restaurantName={data.restaurant.name}
    />
  );
}
