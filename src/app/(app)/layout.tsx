import type { ReactNode } from "react";

import { getRequiredAppUser } from "@/lib/app-user";

import { AppSidebar } from "@/components/features/shell/AppSidebar";
import { TopNav } from "@/components/features/shell/TopNav";

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getRequiredAppUser();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar user={user} />

      <div className="flex min-h-screen flex-col md:ml-60">
        <TopNav user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
