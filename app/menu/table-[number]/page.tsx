import { notFound } from "next/navigation";
import { getPublicMenu } from "@/actions/public-menu";
import { MenuClient } from "@/components/features/menu/menu-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ number: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { number } = await params;
  const tableParam = `table-${number}`;
  const data = await getPublicMenu(tableParam);

  if (!data) notFound();

  return <MenuClient data={data} tableParam={tableParam} />;
}
