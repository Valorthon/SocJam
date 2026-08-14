"use client";

import { cn } from "@/lib/utils";

import { SidebarContent } from "./SidebarContent";

interface AppSidebarProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    timezone: string;
  };
  className?: string;
}

export function AppSidebar({ user, className }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex",
        className,
      )}
    >
      <SidebarContent user={user} />
    </aside>
  );
}
