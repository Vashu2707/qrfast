import { notFound } from "next/navigation";
import { getPublicMenu } from "@/actions/public-menu";
import { MenuClient } from "@/components/features/menu/menu-client";

interface Props {
  params: Promise<{ slug: string; table: string }>;
}

export default async function MenuPage({ params }: Props) {
  const { slug, table } = await params;
  const data = await getPublicMenu(slug, table);

  if (!data) notFound();

  return <MenuClient data={data} slug={slug} tableParam={table} />;
}
