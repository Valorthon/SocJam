"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConnectAccountButtonProps {
  onClick: () => void;
  label?: string;
  showIcon?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ConnectAccountButton({
  onClick,
  label = "Connect",
  showIcon = false,
  className,
  disabled = false,
}: ConnectAccountButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={onClick}
      disabled={disabled}
    >
      {showIcon ? <Plus className="mr-1.5 size-4" /> : null}
      {label}
    </Button>
  );
}