import React from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageTitle({ title, description, className, actions }: PageTitleProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center md:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="mt-4 md:mt-0 flex-shrink-0 flex gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}