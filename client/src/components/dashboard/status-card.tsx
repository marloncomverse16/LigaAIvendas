import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatusCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconTextColor: string;
  actionLabel?: string;
  actionUrl?: string;
  isLoading?: boolean;
  variant?: "status" | "numeric";
}

export function StatusCard({
  title,
  value,
  icon,
  iconBgColor,
  iconTextColor,
  actionLabel,
  actionUrl,
  isLoading = false,
  variant = "status"
}: StatusCardProps) {
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, { color: string, icon: React.ReactNode }> = {
      "conectado": { color: "text-green-500 dark:text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
      "desconectado": { color: "text-red-500 dark:text-red-400", icon: <AlertCircle className="h-3 w-3" /> },
      "ativo": { color: "text-green-500 dark:text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
      "inativo": { color: "text-green-500 dark:text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
    };
    
    return statusMap[status.toLowerCase()] || { color: "text-gray-500 dark:text-gray-400", icon: <AlertCircle className="h-3 w-3" /> };
  };
  
  const { color, icon: statusIcon } = getStatusColor(value);
  
  return (
    <Card className="card-transition">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
          <div className={cn("p-2 rounded-full", iconBgColor, iconTextColor)}>
            {icon}
          </div>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-6 w-24 mb-2" />
        ) : variant === "status" ? (
          <div className="flex items-center space-x-2">
            <span className={cn("inline-block w-3 h-3 rounded-full", value === "desconectado" ? "bg-red-500" : "bg-green-500")}></span>
            <span className={cn("font-medium", color)}>{value}</span>
          </div>
        ) : (
          <div className="flex items-center">
            <span className="text-3xl font-bold text-card-foreground">{value}</span>
          </div>
        )}
        
        {actionLabel && actionUrl && (
          isLoading ? (
            <Skeleton className="h-4 w-28 mt-4" />
          ) : (
            <Button variant="link" size="sm" className="mt-4 p-0" asChild>
              <Link href={actionUrl}>{actionLabel}</Link>
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
