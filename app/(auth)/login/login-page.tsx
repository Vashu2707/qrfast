"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/actions/auth";
import { loginSchema, type LoginFormData } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDefaultRouteForRole } from "@/lib/roles";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    const result = await signIn(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Welcome back!");
    const redirectTo = searchParams.get("redirect");
    const roleRoute = result.role ? getDefaultRouteForRole(result.role) : "/dashboard";
    const target = redirectTo || roleRoute;

    if (target === window.location.pathname) {
      window.location.reload();
    } else {
      window.location.href = target;
    }
  };

  return (
    <Card className="w-full max-w-md border-border/60 shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Staff Login</CardTitle>
        <CardDescription>Sign in to manage the restaurant</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="admin@restaurant.com" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
