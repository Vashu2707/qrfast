"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { MenuItemDialog } from "@/components/features/menu/menu-item-dialog";
import {
  Search, ShoppingBag, Leaf, Flame, Bell, Receipt,
  Star, ChevronRight, Filter,
} from "lucide-react";
import { requestService } from "@/actions/orders";
import { toast } from "sonner";

type MenuData = NonNullable<Awaited<ReturnType<typeof import("@/actions/public-menu").getPublicMenu>>>;

interface Props {
  data: MenuData;
  slug: string;
  tableParam: string;
}

export function MenuClient({ data, slug, tableParam }: Props) {
  const { restaurant, table, bestsellers } = data;
  const settings = restaurant.settings!;
  const { items, setTable, getSubtotal } = useCart();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedItem, setSelectedItem] = useState<MenuData["restaurant"]["categories"][0]["menuItems"][0] | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">("name");

  useEffect(() => {
    setTable(table.id, table.number, slug, restaurant.id);
  }, [table.id, table.number, slug, restaurant.id, setTable]);

  const allItems = useMemo(() => {
    return restaurant.categories.flatMap((c) =>
      c.menuItems.map((item) => ({ ...item, categoryName: c.name, categoryId: c.id }))
    );
  }, [restaurant.categories]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (activeCategory !== "all") result = result.filter((i) => i.categoryId === activeCategory);
    if (vegFilter === "veg") result = result.filter((i) => i.isVeg);
    if (vegFilter === "nonveg") result = result.filter((i) => !i.isVeg);
    if (search) result = result.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

    result = [...result].sort((a, b) => {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Banner */}
      <div className="relative h-48 overflow-hidden sm:h-56">
        {restaurant.banner && (
          <Image src={restaurant.banner} alt={restaurant.name} fill className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <div />
          <ThemeToggle />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end gap-3">
            {restaurant.logo && (
              <div className="relative size-14 overflow-hidden rounded-xl border-2 border-background shadow-lg">
                <Image src={restaurant.logo} alt="" fill className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{restaurant.name}</h1>
              <p className="text-sm text-muted-foreground">Table {table.number} · Dine-In Menu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => handleService("CALL_WAITER")}>
          <Bell className="mr-1.5 size-3.5" />Call Waiter
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleService("REQUEST_BILL")}>
          <Receipt className="mr-1.5 size-3.5" />Request Bill
        </Button>
      </div>

      {/* Bestsellers */}
      {bestsellers.length > 0 && (
        <section className="px-4 py-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="size-4 text-amber-500" />Popular
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {bestsellers.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-36 shrink-0 rounded-xl border border-border/60 bg-card p-2 text-left transition-shadow hover:shadow-md"
              >
                {item.images[0] && (
                  <div className="relative mb-2 h-24 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                  </div>
                )}
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-sm font-bold" style={{ color: settings.primaryColor }}>
                  {formatCurrency(item.discountPrice || item.price)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Search & Filters */}
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
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="size-4 shrink-0 text-muted-foreground" />
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            All
          </button>
          {restaurant.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {cat.name}
            </button>
          ))}
          <button onClick={() => setVegFilter(vegFilter === "veg" ? "all" : "veg")} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vegFilter === "veg" ? "bg-green-600 text-white" : "bg-muted"}`}>
            <Leaf className="mr-1 inline size-3" />Veg
          </button>
          <button onClick={() => setVegFilter(vegFilter === "nonveg" ? "all" : "nonveg")} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${vegFilter === "nonveg" ? "bg-red-600 text-white" : "bg-muted"}`}>
            Non-Veg
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="shrink-0 rounded-full border-0 bg-muted px-3 py-1 text-xs"
          >
            <option value="name">Name</option>
            <option value="price-low">Price: Low</option>
            <option value="price-high">Price: High</option>
          </select>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.length === 0 ? (
          <p className="col-span-full py-12 text-center text-muted-foreground">No items found</p>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="flex gap-4 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:shadow-md active:scale-[0.99]"
            >
              {item.images[0] ? (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
                  <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">🍽️</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`size-3.5 rounded-sm border ${item.isVeg ? "border-green-600" : "border-red-600"}`}>
                    <span className={`block size-full rounded-sm ${item.isVeg ? "bg-green-600" : "bg-red-600"} m-[1px] scale-50`} />
                  </span>
                  {item.spicyLevel > 0 && <Flame className="size-3.5 text-orange-500" />}
                  <span className="truncate font-semibold">{item.name}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-bold" style={{ color: settings.primaryColor }}>
                    {formatCurrency(item.discountPrice || item.price)}
                  </span>
                  {item.discountPrice && (
                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(item.price)}</span>
                  )}
                  <span className="text-xs text-muted-foreground">· {item.preparationTime} min</span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
            </button>
          ))
        )}
      </div>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-card/95 p-4 backdrop-blur-md">
          <Link href={`/menu/${slug}/${tableParam}/cart`}>
            <Button className="w-full h-12 text-base" style={{ backgroundColor: settings.primaryColor }}>
              <ShoppingBag className="mr-2 size-5" />
              {cartCount} item{cartCount > 1 ? "s" : ""} · {formatCurrency(cartTotal)}
              <ChevronRight className="ml-auto size-5" />
            </Button>
          </Link>
        </div>
      )}

      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          primaryColor={settings.primaryColor}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
