import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="relative ml-16 md:ml-64 flex-1 overflow-y-auto bg-background">
        <main className="h-full w-full">
          {children}
        </main>
      </div>
    </div>
  );
}