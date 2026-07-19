"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUp } from "@/actions/auth";
import { signUpSchema, type SignUpFormData } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock } from "lucide-react";
import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any,
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as any,
    },
  },
};

export default function SignupPage() {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    const result = await signUp(data);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Account created! Please sign in.");
    window.location.href = "/login";
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-[500px] bg-white border border-[#E5E7EB] rounded-[24px] p-8 sm:p-12 shadow-[0_1px_2px_rgba(15,23,42,0.02),0_8px_24px_rgba(15,23,42,0.04),0_24px_48px_rgba(15,23,42,0.03)]"
    >
      {/* Brand Logo */}
      <motion.div variants={itemVariants} className="flex justify-center mb-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="size-8 rounded-lg bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            Q
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            QRFast
          </span>
        </Link>
      </motion.div>

      {/* Header text */}
      <motion.div variants={itemVariants} className="text-center mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Your Restaurant Account</h1>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Get started with modern tableside QR ordering and secure digital checkout.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name Input */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Name
          </Label>
          <div className="relative flex items-center">
            <User className="absolute left-4 size-5 text-slate-400 pointer-events-none" />
            <Input
              id="name"
              placeholder="John Doe"
              autoComplete="name"
              className="pl-12 h-14 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0f9f90] focus-visible:ring-1 focus-visible:ring-[#0f9f90]/30"
              {...register("name")}
            />
          </div>
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </motion.div>

        {/* Email Input */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Email Address
          </Label>
          <div className="relative flex items-center">
            <Mail className="absolute left-4 size-5 text-slate-400 pointer-events-none" />
            <Input
              id="email"
              type="email"
              placeholder="admin@restaurant.com"
              autoComplete="email"
              className="pl-12 h-14 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0f9f90] focus-visible:ring-1 focus-visible:ring-[#0f9f90]/30"
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </motion.div>

        {/* Password Input */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Password
          </Label>
          <div className="relative flex items-center">
            <Lock className="absolute left-4 size-5 text-slate-400 pointer-events-none" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="pl-12 h-14 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0f9f90] focus-visible:ring-1 focus-visible:ring-[#0f9f90]/30"
              {...register("password")}
            />
          </div>
          {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
        </motion.div>

        {/* Confirm Password Input */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Confirm Password
          </Label>
          <div className="relative flex items-center">
            <Lock className="absolute left-4 size-5 text-slate-400 pointer-events-none" />
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="pl-12 h-14 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 transition-all duration-200 focus-visible:border-[#0f9f90] focus-visible:ring-1 focus-visible:ring-[#0f9f90]/30"
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
        </motion.div>

        {/* Submit Button */}
        <motion.div variants={itemVariants} className="pt-2">
          <Button
            type="submit"
            className="w-full h-14 rounded-xl font-semibold bg-[#0f9f90] hover:bg-[#0d8a7c] text-white transition-all duration-200 shadow-[0_1px_2px_rgba(15,159,144,0.05),0_8px_16px_rgba(15,159,144,0.1)] hover:shadow-[0_1px_2px_rgba(15,159,144,0.05),0_12px_24px_rgba(15,159,144,0.15)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 size-5 animate-spin" />}
            Create Account
          </Button>
        </motion.div>
      </form>

      {/* Footer link */}
      <motion.p variants={itemVariants} className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-slate-950 hover:text-[#0f9f90] hover:underline transition-colors"
        >
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  );
}
