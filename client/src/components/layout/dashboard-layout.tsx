import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="w-full overflow-auto bg-background">
        <main className="h-full w-full overflow-hidden flex">
          {children}
        </main>
      </div>
    </div>
  );
}