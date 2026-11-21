import { createHmac, timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { scopeToTenant } from "@/lib/tenant";

const SECRET = process.env.TABLE_TOKEN_SECRET;
/** Legacy QR codes (signed raw tableId, no payload) are generation 1. */
const DEFAULT_GENERATION = 1;

function getSecret(): string {
  if (!SECRET || SECRET.length < 16) {
    throw new Error(
      "TABLE_TOKEN_SECRET must be set and at least 16 characters."
    );
  }
  return SECRET;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(data: string): string {
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf-8");
}

/** HMAC over an arbitrary string: the legacy raw tableId or an encoded payload. */
function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export interface TableTokenOptions {
  /** Table.tokenGeneration at the time the QR was printed. */
  generation?: number;
  /** Bill tokens are scoped to one order; table QR tokens have none. */
  orderId?: string;
  /** Tenant that owns the table; new QR codes carry it explicitly. */
  tenantId?: string;
}

export interface VerifiedTableToken {
  tableId: string;
  generation: number;
  orderId: string | null;
  /** Missing on legacy tokens; verifyActiveTableToken fills it from the table. */
  tenantId?: string;
}

export function generateTableToken(
  tableId: string,
  options: TableTokenOptions = {}
): string {
  const payload = {
    tableId,
    generation: options.generation ?? DEFAULT_GENERATION,
    ...(options.orderId ? { orderId: options.orderId } : {}),
    ...(options.tenantId ? { tenantId: options.tenantId } : {}),
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  // Sign the encoded payload, not the decoded string: the signature must
  // cover the exact bytes presented in the token.
  return `${encoded}.${sign(encoded)}`;
}

/** Stateless verification — HMAC only, no database read. */
export function verifyTableTokenDetails(token: string): VerifiedTableToken | null {
  if (typeof token !== "string") return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const payloadPart = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  try {
    const decoded = base64urlDecode(payloadPart);
    const isPayload = decoded.startsWith("{");
    let payload: VerifiedTableToken;

    if (isPayload) {
      const parsed = JSON.parse(decoded) as {
        tableId?: unknown;
        generation?: unknown;
        orderId?: unknown;
        tenantId?: unknown;
      };
      if (typeof parsed.tableId !== "string" || !parsed.tableId) return null;
      payload = {
        tableId: parsed.tableId,
        generation:
          typeof parsed.generation === "number" &&
          Number.isInteger(parsed.generation) &&
          parsed.generation > 0
            ? parsed.generation
            : DEFAULT_GENERATION,
        orderId: typeof parsed.orderId === "string" ? parsed.orderId : null,
        ...(typeof parsed.tenantId === "string" && parsed.tenantId
          ? { tenantId: parsed.tenantId }
          : {}),
      };
    } else {
      // Tokens printed before the payload format existed: raw tableId,
      // signed the old way, implicitly generation 1.
      payload = {
        tableId: decoded,
        generation: DEFAULT_GENERATION,
        orderId: null,
      };
    }

    const expectedSig = sign(isPayload ? payloadPart : decoded);
    const providedBuf = Buffer.from(providedSig, "utf-8");
    const expectedBuf = Buffer.from(expectedSig, "utf-8");
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Backwards-compatible helper: the table a token was issued for. */
export function verifyTableToken(token: string): string | null {
  return verifyTableTokenDetails(token)?.tableId ?? null;
}

/**
 * Full verification: HMAC + current table generation. A QR that staff have
 * regenerated no longer authorizes menu access, ordering, service requests
 * or bills, even though its signature is still cryptographically valid.
 */
export async function verifyActiveTableToken(
  token: string
): Promise<VerifiedTableToken | null> {
  const payload = verifyTableTokenDetails(token);
  if (!payload) return null;

  const table = await prisma.table.findUnique({
    where: { id: payload.tableId },
    select: { tokenGeneration: true, tenantId: true },
  });
  if (!table || table.tokenGeneration !== payload.generation) return null;
  const verified = { ...payload, tenantId: payload.tenantId ?? table.tenantId };
  await scopeToTenant({ id: verified.tenantId!, kind: "RESTAURANT" });
  return verified;
}
