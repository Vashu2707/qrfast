-- Cocktails section for bars & pubs: a separate, optional menu section.

-- CreateEnum
CREATE TYPE "MenuSection" AS ENUM ('FOOD', 'COCKTAIL');

-- AlterTable: backend toggle that gates the section for customers
ALTER TABLE "Settings" ADD COLUMN "cocktailsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: which tree a category belongs to (default keeps existing rows as food)
ALTER TABLE "Category" ADD COLUMN "section" "MenuSection" NOT NULL DEFAULT 'FOOD';
