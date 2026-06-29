import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { canAccessCashier } from "@/lib/roles";
import { getDefaultRouteForRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/cashier");
  if (!canAccessCashier(user.role)) redirect(getDefaultRouteForRole(user.role));
  return <>{children}</>;
}
