import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConnectAccountButtonProps {
  onClick: () => void;
  label?: string;
  showIcon?: boolean;
  className?: string;
}

export function ConnectAccountButton({
  onClick,
  label = "Connect",
  showIcon = false,
  className,
}: ConnectAccountButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={onClick}
    >
      {showIcon ? <Plus className="mr-1.5 size-4" /> : null}
      {label}
    </Button>
  );
}
