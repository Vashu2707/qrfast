-- Protect order history from destructive cascades (BUG-REPORT #4, #5).
--
-- Deleting a Table used to cascade-delete every Order, Payment and Invoice
-- for it; deleting a MenuItem/Category used to cascade-delete historical
-- OrderItem rows (itemized bills stopped adding up, analytics rewritten).
-- Both FKs are now RESTRICT — app-level guards return a friendly error
-- before the DB is ever asked to delete referenced rows.

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tableId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
