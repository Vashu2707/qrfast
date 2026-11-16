"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHotelSettings, updateHotelSettings } from "@/actions/hotel/settings";
import { StaffHeader } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function HotelSettingsPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["hotel-settings"],
    queryFn: () => getHotelSettings(),
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const initForm = () => {
    if (!settings) return;
    setForm({
      hotelName: settings.hotelName || "",
      description: settings.description || "",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      logo: settings.logo || "",
      banner: settings.banner || "",
      primaryColor: settings.primaryColor || "#0F172A",
      currency: settings.currency || "INR",
      timezone: settings.timezone || "Asia/Kolkata",
      gstPercentage: String(settings.gstPercentage ?? 0),
      checkInTime: settings.checkInTime || "14:00",
      checkOutTime: settings.checkOutTime || "11:00",
    });
  };

  if (Object.keys(form).length === 0 && settings) initForm();

  const handleSave = async () => {
    setLoading(true);
    const result = await updateHotelSettings({
      hotelName: form.hotelName || "",
      description: form.description || null,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      logo: form.logo || null,
      banner: form.banner || null,
      primaryColor: form.primaryColor || "#0F172A",
      currency: form.currency || "INR",
      timezone: form.timezone || "Asia/Kolkata",
      gstPercentage: parseFloat(form.gstPercentage || "0"),
      checkInTime: form.checkInTime || "14:00",
      checkOutTime: form.checkOutTime || "11:00",
    });
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["hotel-settings"] });
      queryClient.invalidateQueries({ queryKey: ["hotel-public-settings"] });
    }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <StaffHeader title="Settings" subtitle="Configure your hotel" />
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Hotel Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Hotel Name</Label>
              <Input value={form.hotelName || ""} onChange={(e) => update("hotelName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description || ""}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address || ""} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <SingleImageUpload
                value={form.logo || ""}
                onChange={(url) => update("logo", url)}
                label="Upload logo"
                aspectRatio="square"
              />
            </div>
            <div className="space-y-2">
              <Label>Banner</Label>
              <SingleImageUpload
                value={form.banner || ""}
                onChange={(url) => update("banner", url)}
                label="Upload banner"
                aspectRatio="banner"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Stay & Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Check-in Time</Label>
                <Input
                  placeholder="14:00"
                  value={form.checkInTime || ""}
                  onChange={(e) => update("checkInTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check-out Time</Label>
                <Input
                  placeholder="11:00"
                  value={form.checkOutTime || ""}
                  onChange={(e) => update("checkOutTime", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>GST %</Label>
                <Input
                  type="number"
                  value={form.gstPercentage || ""}
                  onChange={(e) => update("gstPercentage", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={form.currency || ""} onChange={(e) => update("currency", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <Input
                  type="color"
                  value={form.primaryColor || "#0F172A"}
                  onChange={(e) => update("primaryColor", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
