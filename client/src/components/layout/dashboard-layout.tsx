import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="h-screen overflow-hidden">
      <Sidebar />
      <div className="ml-16 md:ml-64 min-h-screen bg-background">
        <main className="h-full">
          {children}
        </main>
      </div>
    </div>
  );
}