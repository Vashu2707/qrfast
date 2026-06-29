"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  QrCode,
  Utensils,
  TrendingUp,
  Clock,
  CreditCard,
  ChefHat,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const features = [
    {
      icon: <QrCode className="h-6 w-6 text-rose-500" />,
      title: "Contactless QR Ordering",
      desc: "Instant table-bound QR scanning that loads your interactive menu in under 2 seconds. No app download needed.",
    },
    {
      icon: <Utensils className="h-6 w-6 text-rose-500" />,
      title: "Rich Interactive Menu",
      desc: "Vivid photography, veg/non-veg filter badges, spice levels, allergen declarations, and custom item add-ons.",
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-rose-500" />,
      title: "Supercharged Revenue",
      desc: "Automatic upsell popups for add-ons, drinks, and desserts increase average basket size by up to 22%.",
    },
    {
      icon: <Clock className="h-6 w-6 text-rose-500" />,
      title: "Kitchen Workflow Manager",
      desc: "Live preparation tracking screens with incoming order sound triggers, urgency timers, and priority tags.",
    },
    {
      icon: <CreditCard className="h-6 w-6 text-rose-500" />,
      title: "Razorpay & Cash Desk Checkout",
      desc: "Secure mobile checkout. Customers pay instantly using UPI, cards, net banking, or pay at the desk later.",
    },
    {
      icon: <ChefHat className="h-6 w-6 text-rose-500" />,
      title: "Dynamic Admin Dashboard",
      desc: "Oversee sales, tables, customers, and popular dishes in real-time. Export transaction sheets in one click.",
    },
  ];

  const plans = [
    {
      name: "Starter",
      price: "₹0",
      period: "forever",
      desc: "Perfect for testing and small cafes.",
      features: [
        "1 Active Restaurant",
        "Up to 5 Dining Tables",
        "Standard Interactive QR Menu",
        "Pay at Counter System",
        "Basic Analytics Dashboard",
        "Email Support",
      ],
      cta: "Start Free",
      popular: false,
    },
    {
      name: "Growth Pro",
      price: "₹1,499",
      period: "per month",
      desc: "For busy restaurants scaling operations.",
      features: [
        "1 Restaurant (Unlimited Tables)",
        "Premium QR Code Customizer",
        "Razorpay Payment Gateway Integration",
        "Kitchen & Cashier Sound Dashboards",
        "Advanced Analytics & CSV Export",
        "Email & SMS Notifications",
        "Priority 24/7 Support",
      ],
      cta: "Get Started",
      popular: true,
    },
    {
      name: "Enterprise Multi",
      price: "₹3,999",
      period: "per month",
      desc: "For large hotel chains and franchises.",
      features: [
        "Unlimited Branch Outlets",
        "Unlimited Staff Members & Roles",
        "Custom Domain Mapping",
        "Dedicated Database Instance",
        "Custom SMS Gateway Config",
        "Dedicated Account Manager",
        "API Webhook Integrations",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const faqs = [
    {
      q: "Do customers need to download an application to order?",
      a: "No! Customers simply scan the table QR code using their default phone camera or any scanner. The menu opens instantly as a fast, responsive web application in their mobile browser.",
    },
    {
      q: "How does the kitchen receive orders?",
      a: "The kitchen gets an automated visual order card on their dedicated dashboard with sound alerts immediately after an order is placed. The kitchen can tap to mark items as 'Preparing', 'Ready', and 'Served'.",
    },
    {
      q: "Can I customize taxes (GST) and service charges?",
      a: "Yes, you can configure your exact GST percentage, service charge percentage, and currency within the Restaurant Settings panel. Taxes are auto-calculated at checkout.",
    },
    {
      q: "Is a credit card required for the free plan?",
      a: "No credit card is required. You can sign up, create your restaurant menu, and print table QR codes on the free tier immediately.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F13] text-[#F3F4F6] font-sans antialiased selection:bg-rose-500 selection:text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0F0F13]/80 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <QrCode className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              QRFast
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/menu/the-bistro" className="hover:text-white transition-colors flex items-center gap-1">
              Live Demo <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Active</span>
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 h-9 shadow-md shadow-rose-600/10 transition-all font-medium">
                Register Restaurant
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.06),transparent_45%)]" />
        <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-rose-500/5 rounded-full blur-[100px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 mb-6 text-xs text-zinc-400 font-medium"
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Empowering Modern Dine-In Operations
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent"
          >
            Next-Gen QR Ordering for Smart Restaurants
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Enable contactless tableside ordering, smart digital checkout, live order tracking, and clean admin insights. Elevate guest satisfaction instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-8 h-12 shadow-lg shadow-rose-600/20 font-medium">
                Get Started for Free <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link href="/menu/the-bistro" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:text-white rounded-xl px-8 h-12 text-zinc-300">
                Explore Demo Menu
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Value Grid / Features */}
      <section id="features" className="py-24 bg-zinc-950/40 border-y border-zinc-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything Your Restaurant Needs
            </h2>
            <p className="text-zinc-400">
              A comprehensive system built on Next.js 15 and Supabase, tailored for speed, reliability, and visual beauty.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className="p-6 rounded-2xl bg-[#13131A] border border-zinc-900/80 hover:border-zinc-800/80 transition-all flex flex-col gap-4 group"
              >
                <div className="h-12 w-12 rounded-xl bg-zinc-900/80 flex items-center justify-center border border-zinc-800/80 group-hover:bg-rose-950/20 group-hover:border-rose-900/30 transition-all">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-lg text-zinc-100">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-zinc-400">
              Start for free with basic QR features, then unlock automatic payment integrations, sound alerts, and advanced reports as you grow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((p, idx) => (
              <div
                key={idx}
                className={`p-8 rounded-2xl bg-[#13131A] border flex flex-col justify-between relative overflow-hidden ${
                  p.popular
                    ? "border-rose-500 shadow-xl shadow-rose-950/10 scale-105 z-10"
                    : "border-zinc-900"
                }`}
              >
                {p.popular && (
                  <div className="absolute top-0 right-0 bg-rose-600 text-white font-semibold text-[10px] px-3.5 py-1 rounded-bl-xl uppercase tracking-wider">
                    POPULAR
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-white mb-2">{p.name}</h3>
                  <p className="text-zinc-500 text-xs mb-6">{p.desc}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">{p.price}</span>
                    <span className="text-zinc-500 text-xs">/ {p.period}</span>
                  </div>
                  <ul className="space-y-3.5 mb-8 text-sm text-zinc-400">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-rose-500 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/signup">
                  <Button
                    className={`w-full rounded-xl py-3 h-auto font-medium transition-all ${
                      p.popular
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/10"
                        : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60"
                    }`}
                  >
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-zinc-950/40 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <HelpCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-zinc-400">Answers to some common questions about our platform.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-900 bg-[#13131A] overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-6 py-4.5 flex items-center justify-between text-left font-medium text-zinc-100 hover:text-white"
                >
                  <span>{f.q}</span>
                  <ChevronRight
                    className={`h-4 w-4 text-zinc-400 transition-transform ${
                      activeFaq === idx ? "rotate-90 text-rose-500" : ""
                    }`}
                  />
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-5 pt-1 text-sm text-zinc-400 leading-relaxed border-t border-zinc-900/60">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900/80 py-12 text-zinc-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-rose-600 flex items-center justify-center">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-base">QRFast</span>
          </div>
          <div>© {new Date().getFullYear()} QRFast Systems. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
