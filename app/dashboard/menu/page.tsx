"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability } from "@/actions/menu-items";
import { getCategories, createCategory, deleteCategory } from "@/actions/categories";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Leaf } from "lucide-react";
import Image from "next/image";

const emptyItem = {
  name: "", description: "", price: "", discountPrice: "", isVeg: true,
  spicyLevel: "0", preparationTime: "15", categoryId: "", images: "",
  ingredients: "", allergens: "",
};

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editId, setEditId] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const { data: items = [] } = useQuery({ queryKey: ["menuItems"], queryFn: getMenuItems });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const resetForm = () => { setItemForm(emptyItem); setEditId(null); };

  const handleSaveItem = async () => {
    const data = {
      ...itemForm,
      price: parseFloat(itemForm.price),
      discountPrice: itemForm.discountPrice ? parseFloat(itemForm.discountPrice) : null,
      spicyLevel: parseInt(itemForm.spicyLevel),
      preparationTime: parseInt(itemForm.preparationTime),
      images: itemForm.images ? itemForm.images.split(",").map((s) => s.trim()) : [],
      ingredients: itemForm.ingredients ? itemForm.ingredients.split(",").map((s) => s.trim()) : [],
      allergens: itemForm.allergens ? itemForm.allergens.split(",").map((s) => s.trim()) : [],
    };

    const result = editId
      ? await updateMenuItem(editId, data)
      : await createMenuItem(data);

    if (result.error) toast.error(result.error);
    else {
      toast.success(editId ? "Item updated" : "Item created");
      setItemDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
    }
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditId(item.id);
    setItemForm({
      name: item.name, description: item.description || "", price: String(item.price),
      discountPrice: item.discountPrice ? String(item.discountPrice) : "",
      isVeg: item.isVeg, spicyLevel: String(item.spicyLevel),
      preparationTime: String(item.preparationTime), categoryId: item.categoryId,
      images: item.images.join(", "), ingredients: item.ingredients.join(", "),
      allergens: item.allergens.join(", "),
    });
    setItemDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
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
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { resetForm(); setItemDialogOpen(true); }}><Plus className="mr-2 size-4" />Add Item</Button>
          <Dialog open={itemDialogOpen} onOpenChange={(o) => { setItemDialogOpen(o); if (!o) resetForm(); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
              <DialogHeader><DialogTitle>{editId ? "Edit Item" : "Add Menu Item"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2"><Label>Name</Label><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Price (₹)</Label><Input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Discount Price</Label><Input type="number" value={itemForm.discountPrice} onChange={(e) => setItemForm({ ...itemForm, discountPrice: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={itemForm.categoryId} onValueChange={(v) => v && setItemForm({ ...itemForm, categoryId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Image URLs (comma separated)</Label><Input value={itemForm.images} onChange={(e) => setItemForm({ ...itemForm, images: e.target.value })} placeholder="https://..." /></div>
                <div className="flex items-center gap-2"><Switch checked={itemForm.isVeg} onCheckedChange={(v) => setItemForm({ ...itemForm, isVeg: v })} /><Label>Vegetarian</Label></div>
                <Button onClick={handleSaveItem} disabled={!itemForm.name || !itemForm.price || !itemForm.categoryId}>Save Item</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => setCatDialogOpen(true)}><Plus className="mr-2 size-4" />Add Category</Button>
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
                <Button onClick={handleCreateCategory} disabled={!catName}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge key={cat.id} variant="secondary" className="gap-2">
              {cat.name}
              <button onClick={async () => { if (confirm("Delete category?")) { await deleteCategory(cat.id); queryClient.invalidateQueries({ queryKey: ["categories"] }); } }} className="hover:text-destructive">×</button>
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className={`border-border/60 ${!item.isAvailable ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                {item.images[0] && (
                  <div className="relative mb-3 h-36 overflow-hidden rounded-lg">
                    <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.isVeg && <Leaf className="size-3.5 text-green-600" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.category.name}</p>
                    <p className="mt-1 font-bold">{formatCurrency(item.discountPrice || item.price)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Switch checked={item.isAvailable} onCheckedChange={() => handleToggle(item.id, item.isAvailable)} />
                  <span className="text-xs text-muted-foreground">{item.isAvailable ? "Available" : "Unavailable"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
