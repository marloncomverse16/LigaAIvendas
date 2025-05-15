import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="absolute inset-0 left-16 md:left-64 overflow-y-auto bg-background p-0 flex">
        <main className="h-full w-full p-0 m-0 overflow-hidden flex">
          {children}
        </main>
      </div>
    </div>
  );
}