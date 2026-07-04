"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuItemDialog } from "@/components/features/menu/menu-item-dialog";
import {
  Search, ShoppingBag, Bell, Receipt,
  Star, ChevronRight, Filter, Sparkles, Crown,
} from "lucide-react";
import { requestService } from "@/actions/orders";
import { toast } from "sonner";

interface MenuData {
  restaurant: {
    restaurantName: string;
    logo: string | null;
    banner: string | null;
    primaryColor: string;
  };
  table: {
    id: string;
    number: string;
  };
  bestsellers: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    discountPrice: number | null;
    isVeg: boolean;
    spicyLevel: number;
    preparationTime: number;
    images: string[];
    ingredients: string[];
    allergens: string[];
    isChefSpecial?: boolean;
    variants: { id: string; name: string; price: number }[];
    addons: { id: string; name: string; price: number; isVeg: boolean }[];
    category: { id: string; name: string };
  }>;
  newItems: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    discountPrice: number | null;
    isVeg: boolean;
    spicyLevel: number;
    preparationTime: number;
    images: string[];
    ingredients: string[];
    allergens: string[];
    isChefSpecial?: boolean;
    variants: { id: string; name: string; price: number }[];
    addons: { id: string; name: string; price: number; isVeg: boolean }[];
    category: { id: string; name: string };
  }>;
  reviews: Array<{
    id: string;
    customerName: string;
    rating: number;
    comment: string | null;
    createdAt: Date | string;
    menuItem: { name: string } | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    menuItems: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      discountPrice: number | null;
      isVeg: boolean;
      spicyLevel: number;
      preparationTime: number;
      images: string[];
      ingredients: string[];
      allergens: string[];
      isChefSpecial?: boolean;
      variants: { id: string; name: string; price: number }[];
      addons: { id: string; name: string; price: number; isVeg: boolean }[];
    }>;
  }>;
}

interface Props {
  data: MenuData;
  tableParam: string;
}

/** Veg/Non-veg FSSAI-style square indicator */
function VegIndicator({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 ${
        isVeg ? "border-green-600" : "border-red-600"
      }`}
    >
      <span
        className={`size-2 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`}
      />
    </span>
  );
}

/** Spicy flame dots (1-3) */
function SpicyLevel({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <span className="flex items-center gap-0.5" title={`Spicy level ${level}/3`}>
      {Array.from({ length: level }).map((_, i) => (
        <span key={i} className="text-[11px]">🌶️</span>
      ))}
    </span>
  );
}

/** Chef special crown badge */
function ChefSpecialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      <Crown className="size-2.5" />
      Chef&apos;s Special
    </span>
  );
}

export function MenuClient({ data, tableParam }: Props) {
  const { restaurant, table, bestsellers, newItems, reviews, categories } = data;
  const { items, setTable, getSubtotal } = useCart();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">("name");

  useEffect(() => {
    setTable(table.id, table.number);
  }, [table.id, table.number, setTable]);

  const allItems = useMemo(() => {
    return categories.flatMap((c) =>
      c.menuItems.map((item) => ({ ...item, categoryName: c.name, categoryId: c.id }))
    );
  }, [categories]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (activeCategory !== "all") result = result.filter((i) => i.categoryId === activeCategory);
    if (vegFilter === "veg") result = result.filter((i) => i.isVeg);
    if (vegFilter === "nonveg") result = result.filter((i) => !i.isVeg);
    if (search) result = result.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

    result = [...result].sort((a, b) => {
      const priceA = a.discountPrice ?? a.price;
      const priceB = b.discountPrice ?? b.price;
      if (sortBy === "price-low") return priceA - priceB;
      if (sortBy === "price-high") return priceB - priceA;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [allItems, activeCategory, vegFilter, search, sortBy]);

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = getSubtotal();

  const handleService = async (type: "CALL_WAITER" | "REQUEST_BILL") => {
    const result = await requestService(table.id, type);
    if (result.error) toast.error(result.error);
    else toast.success(type === "CALL_WAITER" ? "Waiter has been notified!" : "Bill request sent!");
  };

  const isFiltering = search || activeCategory !== "all" || vegFilter !== "all";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ──────────────── Hero Banner ──────────────── */}
      <div className="relative h-52 overflow-hidden sm:h-60">
        {restaurant.banner ? (
          <Image
            src={restaurant.banner}
            alt={restaurant.restaurantName}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <div />
          <ThemeToggle />
        </div>

        {/* Restaurant info */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end gap-3">
            {restaurant.logo && (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border-2 border-background shadow-lg">
                <Image src={restaurant.logo} alt="" fill className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{restaurant.restaurantName}</h1>
              <p className="text-sm text-muted-foreground">Table {table.number} · Dine-In</p>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── Quick Actions ──────────────── */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => handleService("CALL_WAITER")}>
          <Bell className="mr-1.5 size-3.5" />
          Call Waiter
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleService("REQUEST_BILL")}>
          <Receipt className="mr-1.5 size-3.5" />
          Request Bill
        </Button>
      </div>

      {/* ──────────────── Bestsellers (horizontal scroll) ──────────────── */}
      {bestsellers.length > 0 && !isFiltering && (
        <section className="px-4 py-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-amber-500" />
            Popular
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {bestsellers.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn w-36 shrink-0 rounded-xl border border-border/60 bg-card p-2 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {item.images[0] ? (
                  <div className="relative mb-2 h-24 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                    {item.isChefSpecial && (
                      <div className="absolute left-1 top-1">
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          <Crown className="size-2" /> Chef
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-muted text-3xl">
                    🍽️
                  </div>
                )}
                <div className="flex items-center gap-1 mb-0.5">
                  <VegIndicator isVeg={item.isVeg} />
                  <p className="truncate text-sm font-medium">{item.name}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: restaurant.primaryColor }}>
                  {formatCurrency(item.discountPrice ?? item.price)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── New Items (horizontal scroll) ──────────────── */}
      {newItems.length > 0 && !isFiltering && (
        <section className="px-4 py-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            New on Menu
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {newItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn w-36 shrink-0 rounded-xl border border-primary/20 bg-primary/5 p-2 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {item.images[0] ? (
                  <div className="relative mb-2 h-24 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                    <div className="absolute right-1 top-1">
                      <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 font-bold">
                        NEW
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-muted text-3xl">
                    🆕
                  </div>
                )}
                <div className="flex items-center gap-1 mb-0.5">
                  <VegIndicator isVeg={item.isVeg} />
                  <p className="truncate text-sm font-medium">{item.name}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: restaurant.primaryColor }}>
                  {formatCurrency(item.discountPrice ?? item.price)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── Search & Filters ──────────────── */}
      <div className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <Filter className="size-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => setVegFilter(vegFilter === "veg" ? "all" : "veg")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              vegFilter === "veg" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            🥬 Veg
          </button>
          <button
            onClick={() => setVegFilter(vegFilter === "nonveg" ? "all" : "nonveg")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              vegFilter === "nonveg" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            🍖 Non-Veg
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="shrink-0 rounded-full border-0 bg-muted px-3 py-1 text-xs text-muted-foreground"
          >
            <option value="name">A-Z</option>
            <option value="price-low">Price ↑</option>
            <option value="price-high">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ──────────────── Menu Grid ──────────────── */}
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.length === 0 ? (
            <p
              key="empty"
              className="col-span-full py-16 text-center text-muted-foreground"
            >
              No items found
            </p>
          ) : (
            filteredItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="animate-fadeIn flex gap-4 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:shadow-md active:scale-[0.99]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* Item image */}
                {item.images[0] ? (
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                    {item.isChefSpecial && (
                      <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">
                        CHEF&apos;S SPECIAL
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                    🍽️
                  </div>
                )}

                {/* Item info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <VegIndicator isVeg={item.isVeg} />
                    <SpicyLevel level={item.spicyLevel} />
                    <span className="truncate font-semibold text-sm leading-tight">{item.name}</span>
                  </div>
                  {item.isChefSpecial && <ChefSpecialBadge />}
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: restaurant.primaryColor }}>
                      {formatCurrency(item.discountPrice ?? item.price)}
                    </span>
                    {item.discountPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(item.price)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">· {item.preparationTime} min</span>
                  </div>
                </div>

                <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
              </button>
            ))
          )}
      </div>

      {/* ──────────────── Customer Reviews ──────────────── */}
      {reviews.length > 0 && !isFiltering && (
        <section className="border-t border-border/60 px-4 py-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-amber-500" />
            What Guests Say
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {reviews.map((review, i) => (
              <div
                key={review.id}
                className="animate-fadeIn w-64 shrink-0 rounded-xl border border-border/60 bg-card p-4"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{review.customerName}</p>
                    {review.menuItem && (
                      <p className="text-xs text-muted-foreground">{review.menuItem.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`size-3 ${
                          idx < review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-xs text-muted-foreground line-clamp-3 italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────── Sticky Cart Bar ──────────────── */}
        {cartCount > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 p-4 backdrop-blur-md">
            <Link href={`/menu/${tableParam}/cart`}>
              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                style={{ backgroundColor: restaurant.primaryColor }}
              >
                <ShoppingBag className="size-5" />
                <span>
                  {cartCount} item{cartCount > 1 ? "s" : ""} · {formatCurrency(cartTotal)}
                </span>
                <ChevronRight className="ml-auto size-5" />
              </Button>
            </Link>
          </div>
        )}

      {/* ──────────────── Item Dialog ──────────────── */}
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          primaryColor={restaurant.primaryColor}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
