"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { UtensilsCrossed, BedDouble, ArrowRight } from "lucide-react";
import faviconImage from "@/assets/images/QRFavicon.png";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: EASE,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

const spaces = [
  {
    href: "/restaurant",
    loginHref: "/login",
    label: "Restaurant",
    description: "Scan, order & pay — manage your restaurant menu, tables and orders.",
    icon: UtensilsCrossed,
    accent: "text-rose-600",
    iconBg: "bg-rose-50",
    ring: "hover:border-rose-300 hover:shadow-[0_10px_40px_rgba(225,29,72,0.10)]",
    loginLabel: "Restaurant staff sign in",
  },
  {
    href: "/hotel/login",
    loginHref: "/hotel/login",
    label: "Hotel",
    description: "Manage rooms, guests and front-desk operations in one place.",
    icon: BedDouble,
    accent: "text-slate-900",
    iconBg: "bg-slate-100",
    ring: "hover:border-slate-400 hover:shadow-[0_10px_40px_rgba(15,23,42,0.10)]",
    loginLabel: "Hotel staff sign in",
  },
];

export default function SiteChooser() {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-3xl bg-white border border-[#E5E7EB] rounded-[28px] p-6 sm:p-10 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.05),0_30px_60px_rgba(15,23,42,0.08)] mx-4"
    >
      <motion.div variants={itemVariants} className="flex flex-col items-center text-center mb-8">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity mb-3">
          <Image
            src={faviconImage}
            alt="QRFast Logo"
            width={44}
            height={44}
            className="size-11 object-contain"
          />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1.5 leading-tight">
          Where do you want to go?
        </h1>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">
          QRFast runs two separate spaces. Pick the one you need — each keeps its own
          sign-in and data.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {spaces.map((space) => (
          <motion.div key={space.href} variants={itemVariants}>
            <Link
              href={space.href}
              className={`group flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-[#FCFCFD] p-6 transition-all duration-200 ${space.ring}`}
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${space.iconBg}`}
              >
                <space.icon className={`size-6 ${space.accent}`} />
              </span>
              <span className="text-lg font-semibold text-slate-900">{space.label}</span>
              <span className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">
                {space.description}
              </span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F172A]">
                Continue
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              href={space.loginHref}
              className="mt-2 inline-block text-xs font-medium text-slate-400 hover:text-[#0F172A] transition-colors"
            >
              {space.loginLabel} &rarr;
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
