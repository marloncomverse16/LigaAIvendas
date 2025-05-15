import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="ml-16 md:ml-64 flex-1 h-full overflow-y-auto bg-background transition-all duration-300">
        <main className="h-full w-full p-0 m-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}