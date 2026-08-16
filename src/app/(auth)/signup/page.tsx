"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSignupFlow } from "@/lib/auth/signup-flow";

import { loginUser } from "../login/actions";
import { registerUser, type RegisterFieldErrors } from "./actions";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegisterFieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setLoading(true);

    const result = await completeSignupFlow({
      name,
      email,
      password,
      confirmPassword,
    }, {
      register: registerUser,
      login: loginUser,
    });

    if (!result.success) {
      setLoading(false);
      if (result.stage === "registration") {
        setErrors(result.result.fieldErrors ?? {});
        setServerError(result.result.error ?? "Unable to create your account.");
      } else {
        setServerError("Your account was created. Please sign in to continue.");
      }
      return;
    }
    setLoading(false);
    router.push(result.redirectTo);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-[360px] flex-col gap-8">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1>
            <Image
              src="/branding/logo-light.svg"
              alt="SocJam"
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
          <div className="mb-6">
            <h2 className="text-lg font-medium">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start managing your social posts from one place.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FieldError error={errors.name}>
              <Label className="font-mono text-xs" htmlFor="name">
                Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={loading}
                aria-invalid={Boolean(errors.name)}
                required
              />
            </FieldError>

            <FieldError error={errors.email}>
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
                aria-invalid={Boolean(errors.email)}
                required
              />
            </FieldError>

            <FieldError error={errors.password}>
              <Label className="font-mono text-xs" htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                aria-invalid={Boolean(errors.password)}
                required
              />
            </FieldError>

            <FieldError error={errors.confirmPassword}>
              <Label className="font-mono text-xs" htmlFor="confirm-password">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                aria-invalid={Boolean(errors.confirmPassword)}
                required
              />
            </FieldError>

            {serverError ? (
              <p className="font-mono text-sm text-destructive" role="alert">
                {serverError}
              </p>
            ) : null}

            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </form>
        </section>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function FieldError({
  children,
  error,
}: {
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
