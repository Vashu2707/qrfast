import { PrismaClient, Role, TableStatus, OrderStatus, PaymentStatus, PaymentMethod, NotificationType, DiscountType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("Cleaning up existing database records...");
  await prisma.invoice.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.addon.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.adminUser.deleteMany();

  console.log("Creating default settings...");
  await prisma.settings.create({
    data: {
      id: "singleton",
      restaurantName: "The Bistro",
      logo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80",
      banner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
      phone: "+919876543210",
      email: "info@thebistro.com",
      address: "123 Gourmet Boulevard, Food District, New Delhi - 110001",
      primaryColor: "#E11D48",
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

  console.log("Creating admin users...");
  const adminId = "44906845-303e-4479-be34-7edd22c56581";
  const kitchenId = "96a5492c-5b02-418e-9d3d-868eb916af0d";
  const cashierId = "fd7ab4ab-5c77-45d3-bb6b-4714ec594691";

  await prisma.adminUser.createMany({
    data: [
      { id: adminId, email: "admin@thebistro.com", name: "Chef Raymond", role: Role.ADMIN },
      { id: kitchenId, email: "kitchen@thebistro.com", name: "Kitchen Team A", role: Role.KITCHEN },
      { id: cashierId, email: "cashier@thebistro.com", name: "Cashier Sarah", role: Role.CASHIER },
    ],
  });

  console.log("Creating tables...");
  for (let i = 1; i <= 8; i++) {
    await prisma.table.create({
      data: {
        number: `${i}`,
        status: TableStatus.AVAILABLE,
        qrCodeUrl: `/menu/table-${i}`,
      },
    });
  }

  console.log("Creating categories...");
  const starters = await prisma.category.create({
    data: { name: "Starters", description: "Appetizers and quick bites", sortOrder: 1 },
  });
  const mains = await prisma.category.create({
    data: { name: "Mains", description: "Satisfying main courses", sortOrder: 2 },
  });
  const desserts = await prisma.category.create({
    data: { name: "Desserts", description: "Sweet delights to end your meal", sortOrder: 3 },
  });
  const beverages = await prisma.category.create({
    data: { name: "Beverages", description: "Refreshing soft drinks and mocktails", sortOrder: 4 },
  });

  console.log("Creating menu items...");

  const garlicBread = await prisma.menuItem.create({
    data: {
      name: "Garlic Bread with Cheese",
      description: "Baked artisan loaf spread with homemade garlic butter, herbs, and melted mozzarella.",
      price: 150.0,
      foodType: "VEG",
      spicyLevel: 0,
      preparationTime: 10,
      images: ["https://images.unsplash.com/photo-1573145959290-b1ee3f17f7df?w=600&q=80"],
      ingredients: ["Baguette", "Garlic Butter", "Parsley", "Mozzarella Cheese"],
      allergens: ["Gluten", "Dairy"],
      nutrition: { calories: 340, protein: 12, carbs: 42, fat: 16 },
      categoryId: starters.id,
      isBestSeller: true,
    },
  });
  await prisma.addon.createMany({
    data: [
      { name: "Extra Cheese", price: 40.0, isVeg: true, menuItemId: garlicBread.id },
      { name: "Jalapenos", price: 20.0, isVeg: true, menuItemId: garlicBread.id },
    ],
  });

  const paneerTikka = await prisma.menuItem.create({
    data: {
      name: "Paneer Tikka",
      description: "Cubes of paneer, bell peppers, and onions marinated in a yogurt tandoori marinade, roasted in a clay oven.",
      price: 250.0, foodType: "VEG", spicyLevel: 2, preparationTime: 15,
      images: ["https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80"],
      ingredients: ["Paneer", "Yogurt", "Tandoori Spices", "Bell Pepper", "Onion"],
      allergens: ["Dairy"],
      nutrition: { calories: 390, protein: 18, carbs: 10, fat: 28 },
      categoryId: starters.id,
      isChefSpecial: true,
    },
  });

  const chickenWings = await prisma.menuItem.create({
    data: {
      name: "Spicy Buffalo Chicken Wings",
      description: "Crispy fried chicken wings tossed in our signature hot sauce, served with celery and blue cheese dip.",
      price: 280.0, foodType: "NON_VEG", spicyLevel: 3, preparationTime: 18,
      images: ["https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&q=80"],
      ingredients: ["Chicken Wings", "Buffalo Sauce", "Blue Cheese Dressing", "Spices"],
      allergens: ["Gluten", "Dairy"],
      nutrition: { calories: 520, protein: 32, carbs: 12, fat: 38 },
      categoryId: starters.id,
      isBestSeller: true,
    },
  });
  await prisma.variant.createMany({
    data: [
      { name: "6 Pieces", price: 280.0, menuItemId: chickenWings.id },
      { name: "12 Pieces", price: 490.0, menuItemId: chickenWings.id },
    ],
  });

  const butterChicken = await prisma.menuItem.create({
    data: {
      name: "Butter Chicken (Murgh Makhani)",
      description: "Tender tandoori chicken cooked in a rich, buttery, creamy tomato gravy with a hint of fenugreek.",
      price: 360.0, foodType: "NON_VEG", spicyLevel: 1, preparationTime: 20,
      images: ["https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80"],
      ingredients: ["Chicken", "Tomato Puree", "Butter", "Fresh Cream", "Indian Spices"],
      allergens: ["Dairy", "Nuts"],
      nutrition: { calories: 650, protein: 40, carbs: 15, fat: 48 },
      categoryId: mains.id,
      isBestSeller: true,
    },
  });
  await prisma.variant.createMany({
    data: [
      { name: "Half Portion", price: 360.0, menuItemId: butterChicken.id },
      { name: "Full Portion", price: 590.0, menuItemId: butterChicken.id },
    ],
  });
  await prisma.addon.createMany({
    data: [
      { name: "Butter Naan", price: 50.0, isVeg: true, menuItemId: butterChicken.id },
      { name: "Basmati Rice", price: 60.0, isVeg: true, menuItemId: butterChicken.id },
    ],
  });

  const dalMakhani = await prisma.menuItem.create({
    data: {
      name: "Dal Makhani",
      description: "Black lentils and kidney beans slow-cooked overnight with butter, cream, tomatoes, and spices.",
      price: 240.0, foodType: "VEG", spicyLevel: 1, preparationTime: 15,
      images: ["https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80"],
      ingredients: ["Black Lentils", "Kidney Beans", "Butter", "Cream", "Ginger-Garlic Paste"],
      allergens: ["Dairy"],
      nutrition: { calories: 380, protein: 14, carbs: 45, fat: 18 },
      categoryId: mains.id,
    },
  });

  const vegBiryani = await prisma.menuItem.create({
    data: {
      name: "Hyderabadi Veg Biryani",
      description: "Fragrant basmati rice layered with spiced garden vegetables, cooked on dum, served with raita.",
      price: 290.0, foodType: "VEG", spicyLevel: 2, preparationTime: 22,
      images: ["https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80"],
      ingredients: ["Basmati Rice", "Carrot", "Beans", "Green Peas", "Biryani Masala", "Saffron"],
      allergens: ["Dairy"],
      nutrition: { calories: 450, protein: 10, carbs: 75, fat: 12 },
      categoryId: mains.id,
      isChefSpecial: true,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Chocolate Lava Cake",
      description: "Delectable warm chocolate cake with a molten chocolate center, served with a scoop of vanilla ice cream.",
      price: 180.0, foodType: "VEG", spicyLevel: 0, preparationTime: 12,
      images: ["https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80"],
      ingredients: ["Dark Chocolate", "Butter", "Flour", "Sugar", "Vanilla Ice Cream"],
      allergens: ["Gluten", "Dairy"],
      nutrition: { calories: 480, protein: 6, carbs: 55, fat: 26 },
      categoryId: desserts.id,
      isBestSeller: true,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Gulab Jamun (2 Pcs)",
      description: "Warm milk dumplings fried and soaked in cardamom-flavored sugar syrup.",
      price: 80.0, foodType: "VEG", spicyLevel: 0, preparationTime: 5,
      images: ["https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80"],
      ingredients: ["Milk Solids (Khoya)", "Sugar Syrup", "Cardamom", "Rosewater"],
      allergens: ["Dairy", "Gluten"],
      nutrition: { calories: 300, protein: 5, carbs: 50, fat: 9 },
      categoryId: desserts.id,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Virgin Mojito",
      description: "A perfect summer refresher with fresh mint leaves, lime chunks, simple syrup, topped with sparkling soda and ice.",
      price: 120.0, foodType: "VEG", spicyLevel: 0, preparationTime: 5,
      images: ["https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&q=80"],
      ingredients: ["Mint Leaves", "Lime Juice", "Sugar Syrup", "Soda Water", "Ice"],
      allergens: [],
      nutrition: { calories: 95, protein: 0, carbs: 24, fat: 0 },
      categoryId: beverages.id,
    },
  });

  const icedCoffee = await prisma.menuItem.create({
    data: {
      name: "Iced Caramel Macchiato",
      description: "Chilled espresso with creamy milk, sweet vanilla syrup, and finished with a caramel drizzle.",
      price: 160.0, foodType: "VEG", spicyLevel: 0, preparationTime: 7,
      images: ["https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80"],
      ingredients: ["Espresso", "Milk", "Caramel Sauce", "Vanilla Syrup", "Ice"],
      allergens: ["Dairy"],
      nutrition: { calories: 240, protein: 7, carbs: 36, fat: 8 },
      categoryId: beverages.id,
    },
  });
  await prisma.variant.createMany({
    data: [
      { name: "Regular Size", price: 160.0, menuItemId: icedCoffee.id },
      { name: "Large Size", price: 210.0, menuItemId: icedCoffee.id },
    ],
  });

  console.log("Creating offers...");
  await prisma.offer.createMany({
    data: [
      {
        code: "WELCOME10", title: "10% Off", discountType: DiscountType.PERCENTAGE, discountValue: 10.0,
        minOrderAmount: 250.0, expiryDate: new Date("2028-12-31T23:59:59Z"), isActive: true,
      },
      {
        code: "BISTRO100", title: "₹100 Off", discountType: DiscountType.FLAT, discountValue: 100.0,
        minOrderAmount: 600.0, expiryDate: new Date("2028-12-31T23:59:59Z"), isActive: true,
      },
    ],
  });

  console.log("Creating sample orders...");
  const table1 = await prisma.table.findFirst({ where: { number: "1" } });
  const table2 = await prisma.table.findFirst({ where: { number: "2" } });

  if (table1 && table2) {
    const order1 = await prisma.order.create({
      data: {
        tableId: table1.id, customerName: "Aarav Sharma", customerPhone: "9876543211",
        status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.SUCCESS, paymentMethod: PaymentMethod.CASH,
        subtotal: 390.0, discountAmount: 10.0, gstAmount: 19.5, serviceChargeAmount: 9.75, totalAmount: 409.25,
        notes: "Make the tikka extra spicy.",
      },
    });
    await prisma.orderItem.createMany({
      data: [
        { orderId: order1.id, menuItemId: paneerTikka.id, quantity: 1, price: 250.0 },
        { orderId: order1.id, menuItemId: garlicBread.id, quantity: 1, price: 150.0,
          customizations: { addons: [{ name: "Extra Cheese", price: 40.0 }] } },
      ],
    });
    await prisma.invoice.create({
      data: { orderId: order1.id, invoiceNumber: "INV-0001", amount: 409.25, taxAmount: 19.5, discountAmount: 10.0 },
    });
    await prisma.review.create({
      data: { orderId: order1.id, menuItemId: paneerTikka.id, customerName: "Aarav Sharma", rating: 5,
        comment: "Amazing Paneer Tikka! Loved the spicy level.",
        adminReply: "Thank you Aarav! We appreciate your kind words." },
    });

    const order2 = await prisma.order.create({
      data: {
        tableId: table2.id, customerName: "Ishita Kapoor", customerPhone: "9876543212",
        status: OrderStatus.PREPARING, paymentStatus: PaymentStatus.SUCCESS, paymentMethod: PaymentMethod.RAZORPAY,
        subtotal: 510.0, gstAmount: 25.5, serviceChargeAmount: 12.75, totalAmount: 548.25,
      },
    });
    await prisma.orderItem.createMany({
      data: [
        { orderId: order2.id, menuItemId: butterChicken.id, quantity: 1, price: 360.0 },
        { orderId: order2.id, menuItemId: garlicBread.id, quantity: 1, price: 150.0 },
      ],
    });
    await prisma.payment.create({
      data: { orderId: order2.id, amount: 548.25, method: PaymentMethod.RAZORPAY,
        transactionId: "pay_H1j2K3l4M5n6Op", paymentId: "rzp_test_554825", status: PaymentStatus.SUCCESS },
    });

    const order3 = await prisma.order.create({
      data: {
        tableId: table1.id, customerName: "Rohan Verma", customerPhone: "9876543213",
        status: OrderStatus.PLACED, paymentStatus: PaymentStatus.PENDING, paymentMethod: PaymentMethod.CASH,
        subtotal: 240.0, gstAmount: 12.0, serviceChargeAmount: 6.0, totalAmount: 258.0,
      },
    });
    await prisma.orderItem.create({
      data: { orderId: order3.id, menuItemId: dalMakhani.id, quantity: 1, price: 240.0 },
    });
  }

  console.log("Creating notifications...");
  await prisma.notification.createMany({
    data: [
      { title: "New Order Received", message: "Order placed for Table 1 (Dal Makhani)", type: NotificationType.NEW_ORDER },
      { title: "Bill Requested", message: "Table 2 has requested their bill.", type: NotificationType.REQUEST_BILL },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
