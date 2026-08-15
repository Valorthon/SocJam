import Link from "next/link";
import { LEGAL } from "@/lib/legal/constants";
import {
  ArrowRight,
  Layers3,
  MessageSquareText,
  Play,
  Send,
  Sparkles,
} from "lucide-react";

import { BrandMark } from "@/components/features/landing/BrandMark";
import { ProductPreview } from "@/components/features/landing/ProductPreview";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: MessageSquareText,
    number: "01",
    title: "Create once",
    description: "Start with one clear idea instead of five blank tabs.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "Adapt with AI",
    description: "Tailor the voice, format, and length for every audience.",
  },
  {
    icon: Send,
    number: "03",
    title: "Publish with confidence",
    description: "Keep delivery status for every channel in one place.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[38rem] bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(255,255,255,0.10),transparent)]" />

      <header className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="OmniPost home">
          <BrandMark />
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-3" aria-label="Account navigation">
          <Button asChild variant="ghost" className="px-3 sm:px-4">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-4 sm:px-5">
            <Link href="/signup">
              Get started <ArrowRight className="ml-1.5" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:px-10 lg:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.03em] sm:text-6xl lg:text-8xl">
              One post. Everywhere,
              <span className="block text-white/45">without being everywhere.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              OmniPost helps social teams create, adapt, and publish on every channel — all from one focused workspace.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-6 text-sm">
                <Link href="/signup">
                  Start creating free <ArrowRight className="ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-white/15 bg-white/[0.02] px-6 text-sm hover:bg-white/[0.07]">
                <Link href="#how-it-works">
                  <Play className="mr-2 size-3.5 fill-current" /> See how it works
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required</p>
          </div>

          <ProductPreview />
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-7 sm:flex-row sm:justify-between sm:px-8 lg:px-10">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Built for the places your work shows up</p>
            <div className="flex items-center gap-5 text-sm font-medium text-muted-foreground sm:gap-7">
              <span>Instagram</span><span>LinkedIn</span><span>TikTok</span><span>Facebook</span><span className="hidden sm:inline">X</span>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">A simpler social workflow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Make your best work easier to share.</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.09] md:grid-cols-3">
            {benefits.map(({ icon: Icon, number, title, description }) => (
              <article key={number} className="min-h-60 bg-[#101012] p-6 sm:p-7">
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]"><Icon className="size-4 text-white/85" /></span>
                  <span className="font-mono text-xs text-muted-foreground">{number}</span>
                </div>
                <h3 className="mt-12 text-xl font-medium tracking-tight">{title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28 lg:px-10">
          <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#19191d] to-[#0e0e10] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="mx-auto max-w-2xl">
              <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"><Layers3 className="size-5" /></div>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Your social presence, finally in sync.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">Spend less time moving content between platforms and more time making it worth sharing.</p>
              <Button asChild size="lg" className="mt-7 h-12 rounded-full px-6">
                <Link href="/signup">
                  Create your workspace <ArrowRight className="ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:px-8 lg:px-10">
          <p>
            © {new Date().getFullYear()} {LEGAL.appName}. All rights reserved.
          </p>

          <nav
            className="flex items-center gap-6"
            aria-label="Legal links"
          >
            <Link
              href="/terms-of-service"
              className="hover:text-foreground"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
