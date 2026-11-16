import Features from "@/components/features";
import Hero from "@/components/hero";
import DashboardShowcase from "@/components/dashboard-showcase";
import ModernRestaurants from "@/components/modern-restaurants";
import DecisionSection from "@/components/decision-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Ordering for Restaurants",
  description:
    "Let your customers scan, order and pay from their phone. Streamline your kitchen and increase table turnover with QRFast.",
};

export default function RestaurantLandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <ModernRestaurants />
      <DashboardShowcase />
      <DecisionSection />
    </>
  );
}
