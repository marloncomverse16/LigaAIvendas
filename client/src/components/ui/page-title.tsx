import React, { ReactNode } from 'react';

interface PageTitleProps {
  children: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

const PageTitle: React.FC<PageTitleProps> = ({ 
  children, 
  subtitle, 
  icon, 
  actions 
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-primary">{icon}</span>}
          <h1 className="text-2xl md:text-3xl font-bold">{children}</h1>
        </div>
        {subtitle && (
          <p className="text-muted-foreground text-sm md:text-base">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2 md:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageTitle;