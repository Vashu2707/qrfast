"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpRestaurant } from "@/actions/auth";
import { signupSchema, type SignupFormData } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });

  const restaurantName = watch("restaurantName");

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    const result = await signUpRestaurant(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Account created! Please check your email to verify.");
    router.push("/login");
  };

  return (
    <Card className="w-full max-w-lg border-border/60 shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Start Your Restaurant</CardTitle>
        <CardDescription>Create your QRFast account in minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="restaurantName">Restaurant Name</Label>
              <Input id="restaurantName" placeholder="The Bistro" {...register("restaurantName")} />
              {errors.restaurantName && (
                <p className="text-sm text-destructive">{errors.restaurantName.message}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="restaurantSlug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/menu/</span>
                <Input
                  id="restaurantSlug"
                  placeholder="the-bistro"
                  {...register("restaurantSlug", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    },
                  })}
                />
              </div>
              {restaurantName && !watch("restaurantSlug") && (
                <p className="text-xs text-muted-foreground">
                  Suggested: {restaurantName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
                </p>
              )}
              {errors.restaurantSlug && (
                <p className="text-sm text-destructive">{errors.restaurantSlug.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input id="name" placeholder="John Doe" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Restaurant Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
