"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOffers, createOffer, deleteOffer, toggleOfferStatus } from "@/actions/offers";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const emptyOffer = { code: "", title: "", discountType: "PERCENTAGE", discountValue: "", minOrderAmount: "0", expiryDate: "", usageLimit: "" };

export default function OffersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyOffer);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: offers = [] } = useQuery({ queryKey: ["offers"], queryFn: () => getOffers() });

  const handleCreate = async () => {
    const result = await createOffer({
      code: form.code,
      title: form.title,
      discountType: form.discountType as "PERCENTAGE" | "FLAT",
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: parseFloat(form.minOrderAmount),
      expiryDate: form.expiryDate,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      isActive: true,
    });
    if (result.error) toast.error(result.error);
    else {
      toast.success("Offer created");
      setForm(emptyOffer);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    }
  };

  return (
    <div>
      <StaffHeader title="Offers" subtitle="Manage discount codes" />
      <div className="space-y-6 p-6">
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 size-4" />Create Offer</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Offer</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="20% Off" /></div>
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v) => v && setForm({ ...form, discountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></div>
                <div className="space-y-2"><Label>Min Order (₹)</Label><Input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
                <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Unlimited" /></div>
              </div>
              <Button onClick={handleCreate} disabled={!form.code || !form.discountValue || !form.expiryDate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <Card key={offer.id} className={`border-border/60 ${!offer.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="text-base font-mono">{offer.code}</Badge>
                  <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Delete?")) { await deleteOffer(offer.id); queryClient.invalidateQueries({ queryKey: ["offers"] }); } }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                {offer.title && <p className="mt-1 text-sm text-muted-foreground">{offer.title}</p>}
                <p className="mt-1 text-sm">
                  {offer.discountType === "PERCENTAGE" ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}
                  {offer.minOrderAmount > 0 && ` · Min ₹${offer.minOrderAmount}`}
                </p>
                <p className="text-xs text-muted-foreground">Expires: {formatDate(offer.expiryDate)}</p>
                <p className="text-xs text-muted-foreground">Used: {offer.usageCount}{offer.usageLimit ? `/${offer.usageLimit}` : ""}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Switch checked={offer.isActive} onCheckedChange={async () => { await toggleOfferStatus(offer.id); queryClient.invalidateQueries({ queryKey: ["offers"] }); }} />
                  <span className="text-xs">{offer.isActive ? "Active" : "Inactive"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
