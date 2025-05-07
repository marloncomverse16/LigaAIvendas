import React, { ReactNode } from "react";

interface PageTitleProps {
  children: ReactNode;
  icon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}

const PageTitle: React.FC<PageTitleProps> = ({
  children,
  icon,
  subtitle,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div className="flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-foreground">
          {icon && <div className="text-primary">{icon}</div>}
          {children}
        </h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
};

export default PageTitle;