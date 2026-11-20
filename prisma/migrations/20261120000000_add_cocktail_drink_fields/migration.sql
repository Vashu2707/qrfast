-- Cocktail drink attributes on the shared MenuItem table (NULL for food rows).
-- Cocktails stay orderable through the same pipeline; only their data shape
-- differs (no foodType/spicyLevel usage — those columns stay for food items).

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "abv" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "baseSpirit" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "glass" TEXT;
