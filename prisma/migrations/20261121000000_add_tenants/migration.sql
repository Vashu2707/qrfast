-- CreateEnum
CREATE TYPE "TenantKind" AS ENUM ('RESTAURANT', 'HOTEL');

-- DropIndex
ALTER TABLE "Category" DROP CONSTRAINT "Category_name_parentId_key";

-- DropIndex
DROP INDEX "HotelBooking_referenceCode_key";

-- DropIndex
DROP INDEX "HotelRoom_number_key";

-- DropIndex
DROP INDEX "HotelRoomType_name_key";

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- DropIndex
DROP INDEX "Offer_code_key";

-- DropIndex
DROP INDEX "Table_number_key";

-- AlterTable
ALTER TABLE "Addon" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "HotelBooking" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222';

-- AlterTable
ALTER TABLE "HotelRoom" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222';

-- AlterTable
ALTER TABLE "HotelRoomType" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222';

-- AlterTable
ALTER TABLE "HotelSettings" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222';

-- AlterTable
ALTER TABLE "HotelUser" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TenantKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
-- Backfill the two pre-existing properties as tenants. All existing business
-- rows were assigned these IDs by the DEFAULT clauses in the ALTER statements.
INSERT INTO "Tenant" ("id", "name", "kind", "slug", "createdAt", "updatedAt")
SELECT '11111111-1111-1111-1111-111111111111',
       COALESCE((SELECT "restaurantName" FROM "Settings" LIMIT 1), 'My Restaurant'),
       'RESTAURANT', 'primary-restaurant', NOW(), NOW();

INSERT INTO "Tenant" ("id", "name", "kind", "slug", "createdAt", "updatedAt")
SELECT '22222222-2222-2222-2222-222222222222',
       COALESCE((SELECT "hotelName" FROM "HotelSettings" LIMIT 1), 'My Hotel'),
       'HOTEL', 'primary-hotel', NOW(), NOW();


-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_parentId_key" ON "Category"("tenantId", "name", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelBooking_tenantId_referenceCode_key" ON "HotelBooking"("tenantId", "referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_tenantId_number_key" ON "HotelRoom"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomType_tenantId_name_key" ON "HotelRoomType"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HotelSettings_tenantId_key" ON "HotelSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_tenantId_code_key" ON "Offer"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_tenantId_key" ON "Settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_tenantId_number_key" ON "Table"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelUser" ADD CONSTRAINT "HotelUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSettings" ADD CONSTRAINT "HotelSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoomType" ADD CONSTRAINT "HotelRoomType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

