"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useFinalizeMetaConnection, useMetaPages } from "@/lib/api";
import type { MetaPage } from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function PageCard({
  page,
  selected,
  onSelect,
}: {
  page: MetaPage;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center gap-4 rounded-lg border px-4 py-4 transition-colors " +
        (selected
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-card hover:bg-muted/30")
      }
    >
      <input
        type="radio"
        name="page"
        value={page.id}
        checked={selected}
        onChange={() => onSelect(page.id)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1877f2] text-white"
        }
      >
        f
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{page.name}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {page.hasInstagram
            ? "Includes Instagram business account"
            : "Facebook Page"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={
          "size-4 rounded-full border " +
          (selected ? "border-primary bg-primary" : "border-border")
        }
      />
    </label>
  );
}

export default function PickPagePage() {
  const router = useRouter();
  const pagesQuery = useMetaPages();
  const finalize = useFinalizeMetaConnection();
  const [selected, setSelected] = useState<string | null>(null);

  const pages = pagesQuery.data?.pages ?? [];
  const platform = pagesQuery.data?.platform;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      await finalize.mutateAsync({ pageId: selected });
      const successParam = platform ? platform.toLowerCase() : "success";
      router.push(`/settings/accounts?success=${successParam}`);
    } catch {
      // Mutation surfaces its error in finalize.error.
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Connect account
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Pick a Page</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select which Facebook Page SocJam should publish to{". "}
          {pages.some((page) => page.hasInstagram)
            ? "Pages with an Instagram business account will also publish to that Instagram account."
            : ""}
        </p>
      </section>

      {pagesQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {pagesQuery.isError ? (
        <section
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-6"
          role="alert"
        >
          <h3 className="font-medium">Unable to load Pages</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your connect session may have expired. Please return to{" "}
            {""}
            <a href="/settings/accounts" className="underline">
              connected accounts
            </a>{" "}
            and try again.
          </p>
        </section>
      ) : null}

      {!pagesQuery.isLoading && !pagesQuery.isError && pages.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-card px-4 py-5">
          <p className="font-medium">No Pages found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Facebook account does not manage any Pages. Create a Page first
            in Meta, then reconnect.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/settings/accounts")}
          >
            Back to accounts
          </Button>
        </section>
      ) : null}

      {pages.length > 0 ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              selected={selected === page.id}
              onSelect={setSelected}
            />
          ))}

          {finalize.error instanceof Error ? (
            <p className="text-sm text-destructive" role="alert">
              {finalize.error.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/settings/accounts")}
              disabled={finalize.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={finalize.isPending || !selected}>
              {finalize.isPending ? "Connecting…" : "Connect this Page"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}