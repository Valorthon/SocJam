"use client";

import { Suspense, useEffect, useState } from "react";

import { AccountCard } from "@/components/features/accounts/AccountCard";
import { ConnectAccountButton } from "@/components/features/accounts/ConnectAccountButton";
import { MockConsentDialog } from "@/components/features/accounts/MockConsentDialog";
import { PlatformIcon } from "@/components/features/accounts/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccounts, useConnectMode } from "@/lib/api";
import {
  PLATFORM_ONBOARDING_DETAILS,
  PLATFORMS,
  type Platform,
} from "@/lib/platforms/constraints";
import { isTikTokRealEnabled } from "@/lib/platforms/config";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

function AccountListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {PLATFORMS.map((platform) => (
        <div
          key={platform}
          className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  );
}

const LINKEDIN_OAUTH_URL = "/api/accounts/oauth/linkedin";
const TIKTOK_OAUTH_URL = "/api/accounts/oauth/tiktok";
const META_OAUTH_START_URL = "/api/oauth/meta/start";

export default function ConnectedAccountsPage() {
  return (
    <Suspense fallback={<AccountListSkeleton />}>
      <ConnectedAccountsPageInner />
    </Suspense>
  );
}

function ConnectedAccountsPageInner() {
  const accountsQuery = useAccounts();
  const connectModeQuery = useConnectMode();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [addPlatformOpen, setAddPlatformOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const accounts = accountsQuery.data ?? [];
  const modes = connectModeQuery.data?.modes;

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const oauthError = searchParams.get("oauth_error");

    if (success === "linkedin") {
      toast.success("LinkedIn account connected successfully.");
    }
    if (success === "facebook") {
      toast.success("Facebook account connected successfully.");
    }
    if (success === "instagram") {
      toast.success("Instagram account connected successfully.");
    }

    if (success === "tiktok") {
      toast.success("TikTok account connected successfully.");
    }

    if (error) {
      const messages: Record<string, string> = {
        unauthorized: "You must be signed in to connect an account.",
        invalid_request: "Invalid OAuth request. Please try again.",
        invalid_state: "Security validation failed. Please try again.",
        not_configured: "OAuth is not configured for the selected platform.",
        access_denied: "Authorization was cancelled.",
        account_already_connected: "This account is already connected.",
        unable_to_connect: "Unable to connect account. Please try again.",
      };
      toast.error(messages[error] ?? "Unable to connect account. Please try again.");
    }

    if (oauthError) {
      const oauthMessages: Record<string, string> = {
        oauth_canceled: "Authorization was canceled. No account was connected.",
        missing_code: "Meta did not return an authorization code. Please try again.",
        missing_state: "Your session expired during authorization. Please try again.",
        state_mismatch: "Authorization state mismatch. Please try again.",
        invalid_state: "Authorization state was invalid. Please try again.",
        token_exchange_failed: "Meta rejected the authorization code. Please try again.",
        pages_failed: "Unable to load your Facebook Pages. Please try again.",
        no_pages: "Your Facebook account has no Pages to connect.",
      };
      toast.error(oauthMessages[oauthError] ?? "Unable to connect account. Please try again.");
    }

    if (success || error || oauthError) {
      router.replace("/settings/accounts");
    }
  }, [searchParams, router]);

  function startPlatformConnect(platform: Platform) {
    if (platform === "LINKEDIN" && modes?.[platform] === "real") {
      window.location.href = LINKEDIN_OAUTH_URL;
      return;
    }

if (platform === "TIKTOK" && isTikTokRealEnabled()) {
      window.location.href = TIKTOK_OAUTH_URL;
      return;
    }

    if (
      (platform === "FACEBOOK" || platform === "INSTAGRAM") &&
      modes?.[platform] === "real"
    ) {
      window.location.href = `${META_OAUTH_START_URL}?platform=${platform}`;
      return;
    }

    setSelectedPlatform(platform);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Settings
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Connected accounts
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage the social platforms SocJam has access to.
          </p>
        </div>
        <ConnectAccountButton
          label="Add platform"
          showIcon
          onClick={() => setAddPlatformOpen(true)}
        />
      </section>

      {accountsQuery.isLoading ? <AccountListSkeleton /> : null}

      {accountsQuery.isError ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-6" role="alert">
          <h3 className="font-medium">Unable to load connected accounts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please try again to manage your social platforms.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void accountsQuery.refetch()}
          >
            Try again
          </Button>
        </section>
      ) : null}

      {!accountsQuery.isLoading && !accountsQuery.isError ? (
        <>
          {accounts.length === 0 ? (
            <section className="rounded-lg border border-dashed border-border bg-card px-4 py-5">
              <p className="font-medium">No accounts connected yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect a platform to start publishing from SocJam.
              </p>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-lg border border-border bg-card">
            {PLATFORMS.flatMap((platform) => {
              const platformAccounts = accounts.filter(
                (account) => account.platform === platform,
              );

              if (platformAccounts.length === 0) {
              return [
                <AccountCard
                  key={platform}
                  platform={platform}
                  onConnect={startPlatformConnect}
                />,
              ];
              }

              return platformAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  platform={platform}
                  account={account}
                  onConnect={startPlatformConnect}
                />
              ));
            })}
          </section>
        </>
      ) : null}

      <Dialog open={addPlatformOpen} onOpenChange={setAddPlatformOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a platform</DialogTitle>
            <DialogDescription>
              Choose a platform to connect it to SocJam. LinkedIn, TikTok,
              Facebook, and Instagram use real OAuth when credentials are
              configured.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const details = PLATFORM_ONBOARDING_DETAILS[platform];

              return (
                <Button
                  key={platform}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 px-3 py-3 text-left"
                  onClick={() => {
                    setAddPlatformOpen(false);
                    startPlatformConnect(platform);
                  }}
                >
                  <PlatformIcon platform={platform} className="size-7 text-[10px]" />
                  <span>{details.name}</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <MockConsentDialog
        platform={selectedPlatform}
        open={selectedPlatform !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlatform(null);
        }}
      />
    </div>
  );
}
