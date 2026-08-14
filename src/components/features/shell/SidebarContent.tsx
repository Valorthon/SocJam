"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  LayoutDashboard,
  PenLine,
  Settings,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

import { NavItem } from "./NavItem";
import { UserMenu } from "./UserMenu";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/accounts", label: "Settings", icon: Settings },
];

interface SidebarContentProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    timezone: string;
  };
}

export function SidebarContent({ user }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-1 px-3 py-4">
      <Link href="/dashboard" className="mb-6 flex items-center px-3">
        <Image
          src="/branding/logo-light.svg"
          alt=""
          width={60}
          height={60}
          className="size-[60px]"
        />
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            icon={link.icon}
            label={link.label}
            isActive={pathname === link.href || pathname.startsWith(`${link.href}/`)}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Link
          href="/compose"
          className={buttonVariants({
            className: "w-full justify-start gap-2",
          })}
        >
          <PenLine className="h-4 w-4" />
          Compose
        </Link>

        <div className="border-t border-border pt-4">
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
