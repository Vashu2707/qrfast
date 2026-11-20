/**
 * Active tenant for the current request.
 *
 * Set at sign-in from AdminUser/HotelUser and stored in an HMAC-signed cookie
 * so it survives reloads without an extra DB lookup. Public routes (QR menus,
 * bills, payments) get their tenant from the signed table token instead —
 * see Phase 4.
 */
import { cookies } from "next/headers";
import { signValue, signaturesMatch } from "@/lib/signing-key";

export type TenantKind = "RESTAURANT" | "HOTEL";

export interface TenantContext {
  id: string;
  kind: TenantKind;
}

export const PRIMARY_RESTAURANT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const PRIMARY_HOTEL_TENANT_ID = "22222222-2222-2222-2222-222222222222";

const COOKIE_NAME = "qrfast_tenant";
/** Longer than the 30-minute activity window; cleared explicitly on sign-out. */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function setTenantCookie(tenant: TenantContext): Promise<void> {
  const payload = `${tenant.kind}:${tenant.id}`;
  const value = `${payload}.${signValue(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearTenantCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getTenant(): Promise<TenantContext | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = raw.slice(0, dot);
  if (!signaturesMatch(signValue(payload), raw.slice(dot + 1))) return null;

  const separator = payload.indexOf(":");
  if (separator === -1) return null;
  const kind = payload.slice(0, separator);
  const id = payload.slice(separator + 1);
  if ((kind !== "RESTAURANT" && kind !== "HOTEL") || !id) return null;

  return { id, kind };
}

export async function requireTenant(kind?: TenantKind): Promise<TenantContext> {
  const tenant = await getTenant();
  if (!tenant) {
    throw new Error("No active tenant. Please sign in again.");
  }
  if (kind && tenant.kind !== kind) {
    throw new Error(`This action is only available in the ${kind.toLowerCase()} space.`);
  }
  return tenant;
}

/**
 * Temporary bridge for anonymous pages until the tenant is read from the
 * signed QR token (Phase 4). A signed-in restaurant admin gets their own
 * tenant; everyone else still sees the original restaurant.
 */
export async function getPublicRestaurantTenantId(): Promise<string> {
  const tenant = await getTenant();
  return tenant?.kind === "RESTAURANT" ? tenant.id : PRIMARY_RESTAURANT_TENANT_ID;
}

export async function getPublicHotelTenantId(): Promise<string> {
  const tenant = await getTenant();
  return tenant?.kind === "HOTEL" ? tenant.id : PRIMARY_HOTEL_TENANT_ID;
}
