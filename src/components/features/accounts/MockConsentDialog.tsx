"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useConnectAccount } from "@/lib/api";
import type { Platform } from "@/lib/platforms/constraints";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MockConsentDialogProps {
  platform: Platform | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

const PLATFORM_NAMES: Record<Platform, string> = {
  X: "X",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
};

export function MockConsentDialog({
  platform,
  open,
  onOpenChange,
  onConnected,
}: MockConsentDialogProps) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const connectAccount = useConnectAccount();

  useEffect(() => {
    if (open) {
      setHandle("");
      setError("");
    }
  }, [open, platform]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!platform) return;

    setError("");

    try {
      await connectAccount.mutateAsync({ platform, handle });
      onOpenChange(false);
      onConnected?.();
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Unable to connect account. Please try again.",
      );
    }
  }

  const name = platform ? PLATFORM_NAMES[platform] : "account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {name}</DialogTitle>
          <DialogDescription>
            This simulated consent flow connects a {name} test account for your
            OmniPost workspace.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="mock-handle">Account handle</Label>
            <Input
              id="mock-handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="@acme"
              autoComplete="off"
              disabled={connectAccount.isPending}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={connectAccount.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={connectAccount.isPending || !handle.trim()}>
              {connectAccount.isPending ? "Connecting…" : "Authorize"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
