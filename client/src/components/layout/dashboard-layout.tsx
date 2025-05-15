import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="absolute top-0 bottom-0 left-0 right-0 z-5 overflow-y-auto bg-background" style={{marginLeft: "64px"}}>
        <main className="h-full w-full p-0 m-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}