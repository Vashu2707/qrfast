import { HotelRole } from "@prisma/client";
import { getCurrentHotelUser } from "@/actions/hotel/auth";

export function canAccessHotelDashboard(role: HotelRole): boolean {
  return role === HotelRole.ADMIN || role === HotelRole.STAFF;
}

export function isHotelAdmin(role: HotelRole): boolean {
  return role === HotelRole.ADMIN;
}

/**
 * Returns the current user if authenticated AND has a hotel profile row.
 * Returns null otherwise. Use in hotel server actions.
 */
export async function requireHotelStaff() {
  const user = await getCurrentHotelUser();
  if (!user) return null;
  if (!canAccessHotelDashboard(user.role)) return null;
  return user;
}

/**
 * Returns the current user if authenticated AND is a hotel ADMIN.
 * Use in hotel server actions restricted to admins (e.g. settings).
 */
export async function requireHotelAdmin() {
  const user = await getCurrentHotelUser();
  if (!user) return null;
  if (user.role !== HotelRole.ADMIN) return null;
  return user;
}
