/**
 * Convert a Prisma Decimal value to a JavaScript number.
 * Handles null/undefined gracefully.
 */
export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  // Prisma.Decimal has a .toNumber() method
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

/**
 * Round a number to 2 decimal places (for monetary values).
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convert a Prisma Decimal to a rounded number.
 */
export function money(value: unknown): number {
  return roundMoney(toNumber(value));
}

type DecimalFields = Record<string, unknown>;

/**
 * Convert all numeric-looking fields in an object from Prisma.Decimal to number.
 * Useful for converting entire query results before returning from server actions.
 */
export function convertDecimals<T extends DecimalFields>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val != null && typeof val === "object" && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
      (result as Record<string, unknown>)[key] = (val as { toNumber: () => number }).toNumber();
    }
  }
  return result;
}

/**
 * Convert Decimal fields in an array of objects.
 */
export function convertDecimalsArray<T extends DecimalFields>(arr: T[]): T[] {
  return arr.map(convertDecimals);
}
