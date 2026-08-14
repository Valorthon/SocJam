"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PostDetailDto } from "@/types";

interface ContinueEditingModalProps {
  draft: PostDetailDto | null;
  open: boolean;
  onContinue: () => void;
  onStartNew: () => void;
}

export function ContinueEditingModal({
  draft,
  open,
  onContinue,
  onStartNew,
}: ContinueEditingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onStartNew()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continue editing?</DialogTitle>
          <DialogDescription>
            {draft?.baseText.trim()
              ? "You have a recently saved draft. Would you like to continue where you left off?"
              : "You have a recently saved draft. Would you like to continue editing it?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onStartNew}>
            Start new draft
          </Button>
          <Button type="button" onClick={onContinue}>
            Continue editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
