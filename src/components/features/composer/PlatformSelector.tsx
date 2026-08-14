"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { PlatformIcon } from "@/components/features/accounts/PlatformIcon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SocialAccountDto } from "@/types";

interface PlatformSelectorProps {
  accounts: SocialAccountDto[];
  selectedAccountIds: string[];
  onSelect: (account: SocialAccountDto) => void;
  onDeselect: (accountId: string) => void;
}

export function PlatformSelector({
  accounts,
  selectedAccountIds,
  onSelect,
  onDeselect,
}: PlatformSelectorProps) {
  const hasReconnectRequiredAccount = accounts.some(
    (account) => account.status === "RECONNECT_REQUIRED",
  );

  if (accounts.length === 0) {
    return (
      <section aria-labelledby="platforms-heading">
        <h2
          id="platforms-heading"
          className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Publish to
        </h2>
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-4">
          <p className="text-sm text-muted-foreground">
            Connect an account to start composing for a platform.
          </p>
          <Link
            href="/settings/accounts"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
          >
            <Plus className="mr-1.5" />
            Add platform
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="platforms-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2
          id="platforms-heading"
          className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Publish to
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {selectedAccountIds.length} selected
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => {
          const selected = selectedAccountIds.includes(account.id);
          const reconnectRequired = account.status === "RECONNECT_REQUIRED";
          const label = reconnectRequired
            ? `Reconnect ${account.handle} in Settings before selecting it`
            : `${selected ? "Deselect" : "Select"} ${account.handle}`;

          return (
            <span key={account.id} title={label}>
              <Button
                type="button"
                variant={selected ? "secondary" : "outline"}
                size="sm"
                disabled={reconnectRequired}
                aria-pressed={selected}
                onClick={() =>
                  selected ? onDeselect(account.id) : onSelect(account)
                }
                className={cn(
                  "max-w-full gap-2 border-border font-mono text-xs",
                  selected && "border-foreground/30 bg-secondary",
                )}
              >
                <PlatformIcon platform={account.platform} className="size-4 text-[8px]" />
                <span className="max-w-40 truncate">{account.handle}</span>
                {reconnectRequired ? (
                  <span className="text-[10px] normal-case text-muted-foreground">
                    Reconnect required
                  </span>
                ) : null}
              </Button>
            </span>
          );
        })}

        <Link
          href="/settings/accounts"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5 border-dashed font-mono text-xs text-muted-foreground",
          )}
        >
          <Plus />
          Add platform
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Select the connected accounts that should receive this post.
      </p>
      {hasReconnectRequiredAccount ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reconnect required accounts must be reconnected in Settings before
          they can be selected.
        </p>
      ) : null}
    </section>
  );
}
