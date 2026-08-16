"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { getInitials } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { SidebarContent } from "./SidebarContent";

interface TopNavProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    timezone: string;
  };
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Calendar",
  "/analytics": "Analytics",
  "/settings/accounts": "Connected Accounts",
  "/compose": "Compose",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(`${prefix}/`)) return title;
  }
  return "SocJam";
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card px-4">
      {/* Mobile hamburger */}
      <div className="flex items-center md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 bg-card p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent user={user} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-base font-semibold md:text-lg">{title}</h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline font-mono">
            {user.timezone}
          </span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted text-xs text-muted-foreground">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
