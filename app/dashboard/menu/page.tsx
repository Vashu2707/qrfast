"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
} from "@/actions/menu-items";
import { getCategories, createCategory, deleteCategory } from "@/actions/categories";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";

// ── Form state ───────────────────────────────────────────────────────────────

interface ItemFormState {
  name: string;
  description: string;
  price: string;
  discountPrice: string;
  foodType: "VEG" | "NON_VEG" | "VEGAN";
  spicyLevel: string;
  preparationTime: string;
  categoryId: string;
  /** Uploaded Supabase public URLs */
  images: string[];
  ingredients: string;
  allergens: string;
}

const emptyItem: ItemFormState = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  foodType: "VEG",
  spicyLevel: "0",
  preparationTime: "15",
  categoryId: "",
  images: [],
  ingredients: "",
  allergens: "",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItem);
  const [editId, setEditId] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => getMenuItems(),
    refetchInterval: 15000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    refetchInterval: 15000,
  });

  const resetForm = () => {
    setItemForm(emptyItem);
    setEditId(null);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return toast.error("Name is required");
    if (!itemForm.price) return toast.error("Price is required");
    if (!itemForm.categoryId) return toast.error("Category is required");

    setSaving(true);

    const data = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || undefined,
      price: parseFloat(itemForm.price),
      discountPrice: itemForm.discountPrice ? parseFloat(itemForm.discountPrice) : null,
      foodType: itemForm.foodType,
      spicyLevel: parseInt(itemForm.spicyLevel),
      preparationTime: parseInt(itemForm.preparationTime),
      categoryId: itemForm.categoryId,
      // Images are already Supabase Storage public URLs at this point
      images: itemForm.images,
      ingredients: itemForm.ingredients
        ? itemForm.ingredients.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      allergens: itemForm.allergens
        ? itemForm.allergens.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      variants: [],
      addons: [],
    };

    const result = editId
      ? await updateMenuItem(editId, data)
      : await createMenuItem(data);

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editId ? "Item updated" : "Item created");
      setItemDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditId(item.id);
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      discountPrice: item.discountPrice ? String(item.discountPrice) : "",
      foodType: (item.foodType ?? "VEG") as "VEG" | "NON_VEG" | "VEGAN",
      spicyLevel: String(item.spicyLevel),
      preparationTime: String(item.preparationTime),
      categoryId: item.categoryId,
      images: item.images, // already URLs from storage
      ingredients: item.ingredients.join(", "),
      allergens: item.allergens.join(", "),
    });
    setItemDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item? Its images will also be removed.")) return;
    const result = await deleteMenuItem(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await toggleMenuItemAvailability(id, !current);
    queryClient.invalidateQueries({ queryKey: ["menuItems"] });
  };

  const handleCreateCategory = async () => {
    const result = await createCategory({ name: catName });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Category created");
      setCatName("");
      setCatDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  };

  return (
    <div>
      <StaffHeader title="Menu Management" subtitle="Manage categories and menu items" />
      <div className="space-y-6 p-6">

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              resetForm();
              setItemDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Item
          </Button>

          {/* ── Add / Edit Item dialog ── */}
          <Dialog
            open={itemDialogOpen}
            onOpenChange={(o) => {
              setItemDialogOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g. Paneer Butter Masala"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={itemForm.description}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, description: e.target.value })
                    }
                    placeholder="Short description of the dish"
                    rows={2}
                  />
                </div>

                {/* Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (₹) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      placeholder="199"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discounted Price (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.discountPrice}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, discountPrice: e.target.value })
                      }
                      placeholder="149"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={itemForm.categoryId}
                    onValueChange={(v) =>
                      v && setItemForm({ ...itemForm, categoryId: v })
                    }
                    items={categories.map((c) => ({ value: c.id, label: c.name }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Images — Supabase Storage upload */}
                <div className="space-y-2">
                  <Label>Images</Label>
                  <ImageUpload
                    value={itemForm.images}
                    onChange={(urls) => setItemForm({ ...itemForm, images: urls })}
                    maxImages={5}
                  />
                </div>

                {/* Food Type — 3-way selector */}
                <div className="space-y-2">
                  <Label>Food Type <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    {(
                      [
                        { value: "VEG",     label: "Veg",     dot: "bg-green-600",  border: "border-green-600",  active: "bg-green-50 border-green-600 text-green-700 dark:bg-green-950/40" },
                        { value: "NON_VEG", label: "Non-Veg", dot: "bg-red-600",    border: "border-red-600",    active: "bg-red-50 border-red-600 text-red-700 dark:bg-red-950/40" },
                        { value: "VEGAN",   label: "Vegan",   dot: "bg-emerald-500",border: "border-emerald-500",active: "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40" },
                      ] as const
                    ).map(({ value, label, dot, active }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setItemForm({ ...itemForm, foodType: value })}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                          itemForm.foodType === value
                            ? active
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        <span className={`size-3 rounded-sm border-2 ${itemForm.foodType === value ? dot.replace("bg-", "border-") : "border-muted-foreground"} flex items-center justify-center`}>
                          <span className={`size-1.5 rounded-full ${itemForm.foodType === value ? dot : "bg-muted-foreground"}`} />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spicy level */}
                <div className="space-y-2">
                  <Label>Spicy Level (0 = not spicy, 3 = very spicy)</Label>
                  <Select
                    value={itemForm.spicyLevel}
                    onValueChange={(v) =>
                      v && setItemForm({ ...itemForm, spicyLevel: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Not spicy</SelectItem>
                      <SelectItem value="1">1 — Mild 🌶️</SelectItem>
                      <SelectItem value="2">2 — Medium 🌶️🌶️</SelectItem>
                      <SelectItem value="3">3 — Hot 🌶️🌶️🌶️</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Prep time */}
                <div className="space-y-2">
                  <Label>Preparation Time (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemForm.preparationTime}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, preparationTime: e.target.value })
                    }
                  />
                </div>

                {/* Ingredients */}
                <div className="space-y-2">
                  <Label>Ingredients (comma separated)</Label>
                  <Input
                    value={itemForm.ingredients}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, ingredients: e.target.value })
                    }
                    placeholder="Paneer, Tomato, Cream"
                  />
                </div>

                {/* Allergens */}
                <div className="space-y-2">
                  <Label>Allergens (comma separated)</Label>
                  <Input
                    value={itemForm.allergens}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, allergens: e.target.value })
                    }
                    placeholder="Dairy, Gluten"
                  />
                </div>

                <Button
                  onClick={handleSaveItem}
                  disabled={saving || !itemForm.name || !itemForm.price || !itemForm.categoryId}
                  className="w-full"
                >
                  {saving ? "Saving…" : editId ? "Update Item" : "Create Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Category */}
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Category
          </Button>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Category name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
                <Button onClick={handleCreateCategory} disabled={!catName}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Category chips ── */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge key={cat.id} variant="secondary" className="gap-2">
              {cat.name}
              <button
                onClick={async () => {
                  if (confirm("Delete category? This will also delete all its items.")) {
                    await deleteCategory(cat.id);
                    queryClient.invalidateQueries({ queryKey: ["categories"] });
                    queryClient.invalidateQueries({ queryKey: ["menuItems"] });
                  }
                }}
                className="hover:text-destructive"
                aria-label={`Delete category ${cat.name}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>

        {/* ── Menu item cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`border-border/60 ${!item.isAvailable ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                {/* Thumbnail */}
                {item.images[0] && (
                  <div className="relative mb-3 h-36 overflow-hidden rounded-lg">
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {item.images.length > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        +{item.images.length - 1}
                      </span>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-semibold">{item.name}</h3>
                      {item.foodType === "VEG" && (
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-green-600">
                          <span className="size-2 rounded-full bg-green-600" />
                        </span>
                      )}
                      {item.foodType === "NON_VEG" && (
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-red-600">
                          <span className="size-2 rounded-full bg-red-600" />
                        </span>
                      )}
                      {item.foodType === "VEGAN" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40">
                          🌱 Vegan
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.category.name}</p>
                    <p className="mt-1 font-bold">
                      {formatCurrency(item.discountPrice ?? item.price)}
                      {item.discountPrice && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">
                          {formatCurrency(item.price)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(item)}
                      aria-label="Edit item"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Delete item"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Availability toggle */}
                <div className="mt-3 flex items-center justify-between">
                  <Switch
                    checked={item.isAvailable}
                    onCheckedChange={() => handleToggle(item.id, item.isAvailable)}
                    aria-label="Toggle availability"
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.isAvailable ? "Available" : "Unavailable"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
