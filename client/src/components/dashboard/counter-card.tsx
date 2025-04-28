import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CounterCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  growth: number;
  bgColor: string;
  isLoading?: boolean;
}

export function CounterCard({
  title,
  count,
  icon,
  growth,
  bgColor,
  isLoading = false
}: CounterCardProps) {
  return (
    <Card className={cn(
      "bg-gradient-to-r text-white card-transition",
      bgColor
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="p-2 bg-white/10 rounded-full">
            {icon}
          </div>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-10 w-24 mt-2 mb-4 bg-white/20" />
        ) : (
          <div className="mt-2">
            <span className="text-4xl font-bold">{count.toLocaleString()}</span>
          </div>
        )}
        
        {isLoading ? (
          <Skeleton className="h-4 w-32 mt-4 bg-white/20" />
        ) : (
          <div className="mt-4 flex items-center text-sm">
            {growth > 0 ? (
              <ArrowUp className="mr-1 h-4 w-4" />
            ) : growth < 0 ? (
              <ArrowDown className="mr-1 h-4 w-4" />
            ) : (
              <span className="mr-1">•</span>
            )}
            <span>{Math.abs(growth)}% de crescimento</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
