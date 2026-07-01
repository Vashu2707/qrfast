import { Role } from "@prisma/client";

export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case Role.KITCHEN:
      return "/kitchen";
    case Role.CASHIER:
      return "/cashier";
    case Role.ADMIN:
    default:
      return "/dashboard";
  }
}

export function canAccessDashboard(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canAccessKitchen(role: Role): boolean {
  return role === Role.KITCHEN || role === Role.ADMIN;
}

export function canAccessCashier(role: Role): boolean {
  return role === Role.CASHIER || role === Role.ADMIN;
}
