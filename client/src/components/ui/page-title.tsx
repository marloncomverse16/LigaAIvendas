import React from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageTitle = ({
  children,
  subtitle,
  icon,
  actions,
  className,
  ...props
}: PageTitleProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="h-10 w-10 text-primary">{icon}</div>}
        <div>
          <h1
            className={cn(
              "text-2xl font-bold tracking-tight",
              className
            )}
            {...props}
          >
            {children}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex-shrink-0 flex gap-2">{actions}</div>}
    </div>
  );
};

export default PageTitle;