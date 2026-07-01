import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight">QRFast</Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Contactless QR Menu
          <br />
          <span className="text-primary">for Modern Restaurants</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Let your customers scan, order, and pay from their phone. No app download needed.
          Streamline your kitchen, reduce staff workload, and increase table turnover.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/menu/table-1"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            View Live Demo <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Staff Login
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "QR Ordering", description: "Customers scan a QR code at their table to view the menu and order directly from their phone." },
            { title: "Live Kitchen Display", description: "Orders appear instantly in the kitchen with sound alerts and a kanban-style workflow." },
            { title: "Smart Checkout", description: "Pay online via Razorpay or settle at the counter. GST invoices auto-generated." },
            { title: "Menu Management", description: "Easily update items, prices, categories, variants, and add-ons with a rich editor." },
            { title: "Table & QR Management", description: "Generate high-quality QR codes for each table and track occupancy in real time." },
            { title: "Analytics Dashboard", description: "Track daily revenue, popular items, order trends, and export CSV reports." },
          ].map(({ title, description }) => (
            <div key={title} className="rounded-xl border border-border/60 p-6 transition-shadow hover:shadow-md">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} QRFast. All rights reserved.</p>
      </footer>
    </div>
  );
}
