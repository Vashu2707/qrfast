import Link from "next/link";
import Image from "next/image";
import bgImage from "@/assets/images/herobg.png";
import { Outfit, Playfair_Display } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["800", "900"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["600", "700"],
});

export default function Hero() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Background Image Container */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src={bgImage}
          alt="Elegant Restaurant Background"
          fill
          priority
          placeholder="blur"
          className="object-cover object-center opacity-100 select-none pointer-events-none"
        />
        {/* Subtle radial and linear gradients to blend the image beautifully */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#021f24]/90 via-[#021f24]/60 to-[#021f24]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15),transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#021f24]/70 backdrop-blur-md w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-2 hover:opacity-90 transition-opacity text-white">
            <div className="size-8 rounded-lg bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-lg">Q</div>
            <span>QRFast</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link href="#features" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              Features
            </Link>
            <Link href="#how-it-works" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              How it Works
            </Link>
            <Link href="#contact" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition-all hover:opacity-90 hover:scale-105"
            >
              Sign In
            </Link>
            <Link
              href="#get-started"
              className="bg-transparent border-2 border-white px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10 active:bg-white/20 whitespace-nowrap rounded-full hover:scale-105"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 flex-1 flex flex-col justify-center text-left py-16">
        <h1 className={`${outfit.className} text-5xl font-black tracking-tight sm:text-7xl max-w-3xl text-white leading-none`}>
          Let Customers Scan,
          <br />
          Order & Pay
          <span className={`${playfair.className} block text-3xl sm:text-5xl font-semibold text-amber-300 mt-4 italic normal-case`}>
            Without Waiting for a Waiter.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/80">
          Let your customers scan, order, and pay from their phone. No app download needed.
          Streamline your kitchen, reduce staff workload, and increase table turnover.
        </p>
      </section>
    </div>
  );
}
