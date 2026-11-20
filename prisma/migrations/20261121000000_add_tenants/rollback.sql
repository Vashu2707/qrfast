-- Manual rollback for 20261121000000_add_tenants.
-- ONLY safe before any second tenant is created: dropping tenantId columns
-- discards tenant assignments. Take a backup first.
--
--   npx prisma db execute --file prisma/migrations/20261121000000_add_tenants/rollback.sql

ALTER TABLE "Addon" DROP CONSTRAINT "Addon_tenantId_fkey";
ALTER TABLE "AdminUser" DROP CONSTRAINT "AdminUser_tenantId_fkey";
ALTER TABLE "Category" DROP CONSTRAINT "Category_tenantId_fkey";
ALTER TABLE "HotelBooking" DROP CONSTRAINT "HotelBooking_tenantId_fkey";
ALTER TABLE "HotelRoom" DROP CONSTRAINT "HotelRoom_tenantId_fkey";
ALTER TABLE "HotelRoomType" DROP CONSTRAINT "HotelRoomType_tenantId_fkey";
ALTER TABLE "HotelSettings" DROP CONSTRAINT "HotelSettings_tenantId_fkey";
ALTER TABLE "HotelUser" DROP CONSTRAINT "HotelUser_tenantId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_tenantId_fkey";
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_tenantId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_tenantId_fkey";
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_tenantId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_tenantId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_tenantId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_tenantId_fkey";
ALTER TABLE "Review" DROP CONSTRAINT "Review_tenantId_fkey";
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_tenantId_fkey";
ALTER TABLE "Table" DROP CONSTRAINT "Table_tenantId_fkey";
ALTER TABLE "Variant" DROP CONSTRAINT "Variant_tenantId_fkey";

DROP INDEX "Category_tenantId_name_parentId_key";
DROP INDEX "HotelBooking_tenantId_referenceCode_key";
DROP INDEX "HotelRoom_tenantId_number_key";
DROP INDEX "HotelRoomType_tenantId_name_key";
DROP INDEX "HotelSettings_tenantId_key";
DROP INDEX "Invoice_tenantId_invoiceNumber_key";
DROP INDEX "Offer_tenantId_code_key";
DROP INDEX "Settings_tenantId_key";
DROP INDEX "Table_tenantId_number_key";
DROP INDEX "Tenant_slug_key";

ALTER TABLE "Addon" DROP COLUMN "tenantId";
ALTER TABLE "AdminUser" DROP COLUMN "tenantId";
ALTER TABLE "Category" DROP COLUMN "tenantId";
ALTER TABLE "HotelBooking" DROP COLUMN "tenantId";
ALTER TABLE "HotelRoom" DROP COLUMN "tenantId";
ALTER TABLE "HotelRoomType" DROP COLUMN "tenantId";
ALTER TABLE "HotelSettings" DROP COLUMN "tenantId";
ALTER TABLE "HotelUser" DROP COLUMN "tenantId";
ALTER TABLE "Invoice" DROP COLUMN "tenantId";
ALTER TABLE "MenuItem" DROP COLUMN "tenantId";
ALTER TABLE "Notification" DROP COLUMN "tenantId";
ALTER TABLE "Offer" DROP COLUMN "tenantId";
ALTER TABLE "Order" DROP COLUMN "tenantId";
ALTER TABLE "OrderItem" DROP COLUMN "tenantId";
ALTER TABLE "Payment" DROP COLUMN "tenantId";
ALTER TABLE "Review" DROP COLUMN "tenantId";
ALTER TABLE "Settings" DROP COLUMN "tenantId";
ALTER TABLE "Table" DROP COLUMN "tenantId";
ALTER TABLE "Variant" DROP COLUMN "tenantId";

DROP TABLE "Tenant";
DROP TYPE "TenantKind";

ALTER TABLE "Category" ADD CONSTRAINT "Category_name_parentId_key" UNIQUE ("name", "parentId");
CREATE UNIQUE INDEX "HotelBooking_referenceCode_key" ON "HotelBooking"("referenceCode");
CREATE UNIQUE INDEX "HotelRoom_number_key" ON "HotelRoom"("number");
CREATE UNIQUE INDEX "HotelRoomType_name_key" ON "HotelRoomType"("name");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Offer_code_key" ON "Offer"("code");
CREATE UNIQUE INDEX "Table_number_key" ON "Table"("number");
