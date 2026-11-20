/**
 * Backend-only tenant provisioning.
 *
 * Creates a Supabase Auth user, then in one Prisma transaction creates:
 *   restaurant: Tenant + Settings + AdminUser
 *   hotel:      Tenant + HotelSettings + HotelUser
 *
 * There is deliberately no UI or public signup. Run from a trusted machine:
 *
 *   npm run tenant:create -- restaurant "Spice Hut" spice-hut \
 *     admin@spicehut.example 'strong-password'
 */
import { PrismaClient, TenantKind, Role, HotelRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const [kindArg, name, slug, email, password] = process.argv.slice(2);

if (!kindArg || !name || !slug || !email || !password) {
  console.error(
    "Usage: npm run tenant:create -- <restaurant|hotel> <name> <slug> <email> <password>"
  );
  process.exit(1);
}

const kind = kindArg.toLowerCase();
if (kind !== "restaurant" && kind !== "hotel") {
  console.error("Kind must be 'restaurant' or 'hotel'.");
  process.exit(1);
}

function poolerUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  try {
    const url = new URL(raw);
    if (url.hostname.includes("pooler.supabase.com") && url.port === "5432") {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: poolerUrl() }),
  });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authUserId: string | undefined;
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Supabase user creation failed: ${error?.message ?? "no user returned"}`);
    }
    authUserId = data.user.id;

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name,
          slug,
          kind: kind === "restaurant" ? TenantKind.RESTAURANT : TenantKind.HOTEL,
        },
      });

      if (kind === "restaurant") {
        await tx.settings.create({
          data: { id: randomUUID(), tenantId: created.id, restaurantName: name },
        });
        await tx.adminUser.create({
          data: {
            id: authUserId!,
            email,
            name,
            role: Role.ADMIN,
            tenantId: created.id,
          },
        });
      } else {
        await tx.hotelSettings.create({
          data: { id: randomUUID(), tenantId: created.id, hotelName: name },
        });
        await tx.hotelUser.create({
          data: {
            id: authUserId!,
            email,
            name,
            role: HotelRole.ADMIN,
            tenantId: created.id,
          },
        });
      }
      return created;
    });

    console.log("Tenant created.");
    console.log(`  id:    ${tenant.id}`);
    console.log(`  kind:  ${tenant.kind}`);
    console.log(`  slug:  ${tenant.slug}`);
    console.log(`  admin: ${email}`);
    console.log("The new tenant starts empty with default settings.");
  } catch (error) {
    // Keep the two stores consistent if the Prisma half fails.
    if (authUserId) {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error("Could not roll back the Supabase user:", cleanupError);
      }
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
