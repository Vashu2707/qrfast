import { PrismaClient, Role, TableStatus, OrderStatus, PaymentStatus, PaymentMethod, NotificationType, DiscountType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const existing = await prisma.settings.count();
  if (existing > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("Seeding database for the first time...");

  await prisma.settings.create({
    data: {
      id: "singleton",
      restaurantName: "The Bistro",
      logo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80",
      banner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
      phone: "+919876543210",
      email: "info@thebistro.com",
      address: "123 Gourmet Boulevard, Food District, New Delhi - 110001",
      primaryColor: "#DC2626",
      currency: "INR",
      timezone: "Asia/Kolkata",
      gstNumber: "07AAAAA1111A1Z1",
      gstPercentage: 5.0,
      serviceChargePercentage: 2.5,
      openingHours: {
        monday: { open: "11:00", close: "23:00", closed: false },
        tuesday: { open: "11:00", close: "23:00", closed: false },
        wednesday: { open: "11:00", close: "23:00", closed: false },
        thursday: { open: "11:00", close: "23:00", closed: false },
        friday: { open: "11:00", close: "23:30", closed: false },
        saturday: { open: "11:00", close: "23:30", closed: false },
        sunday: { open: "11:00", close: "23:00", closed: false },
      },
    },
  });

  console.log("Seeded settings. Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
