"use client";

import { useState } from "react";

import { ConnectAccountButton } from "@/components/features/accounts/ConnectAccountButton";
import { PlatformIcon } from "@/components/features/accounts/PlatformIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDisconnectAccount } from "@/lib/api";
import {
  PLATFORM_ONBOARDING_DETAILS,
  type Platform,
} from "@/lib/platforms/constraints";
import type { SocialAccountDto } from "@/types";

interface AccountCardProps {
  platform: Platform;
  account?: SocialAccountDto;
  onConnect: (platform: Platform) => void;
}

function AccountStatus({ status }: { status: SocialAccountDto["status"] }) {
  const isConnected = status === "ACTIVE";

  return (
    <span
      className={
        isConnected
          ? "rounded border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-emerald-300"
          : "rounded border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-300"
      }
    >
      {isConnected ? "Connected" : "Reconnect required"}
    </span>
  );
}

export function AccountCard({ platform, account, onConnect }: AccountCardProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const disconnectAccount = useDisconnectAccount();
  const details = PLATFORM_ONBOARDING_DETAILS[platform];
  const isConnected = account?.status === "ACTIVE";

  async function confirmDisconnect() {
    if (!account) return;

    try {
      await disconnectAccount.mutateAsync(account.id);
      setDisconnectOpen(false);
    } catch {
      // The mutation error is rendered as a sanitized message in the dialog.
    }
  }

  return (
    <>
      <article className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformIcon platform={platform} />
          <div className="min-w-0">
            <h3 className="font-medium text-foreground">{details.name}</h3>
            {account ? (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {account.handle}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {account ? <AccountStatus status={account.status} /> : null}
          {account && isConnected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDisconnectOpen(true)}
            >
              Disconnect
            </Button>
          ) : (
            <ConnectAccountButton
              label={account ? "Reconnect" : "Connect"}
              onClick={() => onConnect(platform)}
            />
          )}
        </div>
      </article>

      {account ? (
        <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect {details.name}?</DialogTitle>
              <DialogDescription>
                OmniPost will lose access to {account.handle}.{" "}
                {account.scheduledTargetCount > 0
                  ? `This will cancel ${account.scheduledTargetCount} scheduled ${account.scheduledTargetCount === 1 ? "post" : "posts"}.`
                  : "You can reconnect this account later."}
              </DialogDescription>
            </DialogHeader>

            {disconnectAccount.error instanceof Error ? (
              <p className="text-sm text-destructive" role="alert">
                {disconnectAccount.error.message}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={disconnectAccount.isPending}
                onClick={() => setDisconnectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={disconnectAccount.isPending}
                onClick={confirmDisconnect}
              >
                {disconnectAccount.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
