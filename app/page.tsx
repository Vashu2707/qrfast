import SiteChooser from "@/components/portal/site-chooser";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose Your Space",
  description: "Select the QRFast space you want to visit: Restaurant or Hotel.",
};

export default function PortalPage() {
  return (
    <div className="relative min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      {/* Subtle Dot Grid Background (same as auth pages) */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.025)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />
      <main className="relative z-10 flex w-full items-center justify-center py-12">
        <SiteChooser />
      </main>
    </div>
  );
}
