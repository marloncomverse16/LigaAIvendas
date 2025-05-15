import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useSidebar } from "@/providers/sidebar-provider";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div 
        className={cn(
          "relative flex-1 overflow-y-auto bg-background transition-all duration-300",
          collapsed ? "ml-16" : "ml-16 md:ml-64"
        )}
      >
        <main className="h-full w-full">
          {children}
        </main>
      </div>
    </div>
  );
}