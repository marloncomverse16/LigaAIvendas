import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  children: ReactNode;
  icon?: ReactNode;
  subtitle?: string;
  className?: string;
  actions?: ReactNode;
}

const PageTitle = ({ 
  children, 
  icon, 
  subtitle, 
  className, 
  actions 
}: PageTitleProps) => {
  return (
    <div className={cn(
      "flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4",
      className
    )}>
      <div className="flex items-center">
        {icon && (
          <div className="mr-3 p-2 rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageTitle;