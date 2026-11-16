import { redirect } from "next/navigation";
import { getCurrentHotelUser } from "@/actions/hotel/auth";
import { canAccessHotelDashboard } from "@/lib/hotel-roles";
import { HotelShell } from "@/components/layout/hotel-shell";

export const dynamic = "force-dynamic";

export default async function HotelDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentHotelUser().catch(() => null);

  if (!user) redirect("/hotel/login?redirect=/hotel/dashboard");
  if (!canAccessHotelDashboard(user.role)) redirect("/hotel/login");

  return <HotelShell user={user}>{children}</HotelShell>;
}
