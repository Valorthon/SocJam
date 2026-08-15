"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { loginUser } from "./actions";

function getOAuthErrorMessage(error: string): string {
  switch (error) {
    case "OAuthCallback":
      return "Google sign-in failed. Please try again.";
    case "OAuthCreateAccount":
      return "Unable to create an account with Google. Please try again.";
    case "AccessDenied":
      return "Google sign-in was denied. Please try again.";
    case "Configuration":
      return "Google sign-in is not configured.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      toast.error(getOAuthErrorMessage(oauthError));
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await loginUser({ email, password });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Invalid email or password.");
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn("google", { redirectTo: "/onboarding" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-[360px] flex-col gap-8">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1>
            <Image
              src="/branding/logo-light.svg"
              alt="OmniPost"
              width={60}
              height={60}
              className="size-[60px]"
              priority
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            Write once. Publish everywhere.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="font-mono text-xs" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-mono text-xs" htmlFor="password">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setComingSoonFeature("Password recovery")}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>

            {error ? (
              <p className="font-mono text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-xs uppercase text-muted-foreground">
              Or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <GoogleMark />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </Button>
        </section>

        <footer className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link className="transition-colors hover:text-foreground" href="/signup">
            Sign up
          </Link>
          <span aria-hidden="true">•</span>
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={() => setComingSoonFeature("Privacy policy")}
          >
            Privacy
          </button>
          <span aria-hidden="true">•</span>
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={() => setComingSoonFeature("Terms of service")}
          >
            Terms
          </button>
        </footer>
      </div>

      <Dialog
        open={comingSoonFeature !== null}
        onOpenChange={(open) => {
          if (!open) setComingSoonFeature(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Coming soon</DialogTitle>
            <DialogDescription>
              {comingSoonFeature ?? "This feature"} is not available yet.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18V16.94A10.98 10.98 0 0 0 12 23Z" fill="#34A853" />
      <path d="M5.84 14.09A6.52 6.52 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.95 10.95 0 0 0 12 1c-4.3 0-8.01 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
    </svg>
  );
}
