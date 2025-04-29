import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1 h-full">
        <Sidebar />
        <div className="ml-16 md:ml-64 flex-1 w-full bg-background overflow-y-auto">
          <main className="w-full flex flex-col min-h-screen">
            <div className="w-full max-w-screen-2xl mx-auto flex-1">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}