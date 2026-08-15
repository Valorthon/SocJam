import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "@/components/features/landing/BrandMark";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal/constants";

interface LegalLayoutProps {
  children: ReactNode;
}

export function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label={`${LEGAL.appName} home`}
        >
          <BrandMark />
        </Link>

        <nav
          className="flex items-center gap-1.5 sm:gap-3"
          aria-label="Account navigation"
        >
          <Button asChild variant="ghost" className="px-3 sm:px-4">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full px-4 sm:px-5"
          >
            <Link href="/signup">
              Get started <ArrowRight className="ml-1.5" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
        <article className="max-w-none">
          {children}
        </article>
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
