import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, MoreHorizontal, BarChart2, LineChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { Metric } from "@shared/schema";

interface ChartCardProps {
  title: string;
  data: Metric[];
  dataKey: "leadsCount" | "prospectsCount" | "dispatchesCount";
  isLoading?: boolean;
  variant?: "area" | "bar";
}

export function ChartCard({
  title,
  data,
  dataKey,
  isLoading = false,
  variant = "area"
}: ChartCardProps) {
  // Format month names to be shorter for display
  const formatMonthName = (month: string) => {
    const shortMonths: Record<string, string> = {
      "janeiro": "Jan",
      "fevereiro": "Fev",
      "março": "Mar",
      "abril": "Abr",
      "maio": "Mai",
      "junho": "Jun",
      "julho": "Jul",
      "agosto": "Ago",
      "setembro": "Set",
      "outubro": "Out",
      "novembro": "Nov",
      "dezembro": "Dez"
    };
    
    return shortMonths[month.toLowerCase()] || month;
  };
  
  // Process data for the chart
  const chartData = data?.map(item => ({
    ...item,
    month: formatMonthName(item.month),
    [dataKey]: item[dataKey] || 0
  })) || [];
  
  // Get color based on dataKey
  const getColor = (key: string) => {
    const colors: Record<string, string> = {
      "leadsCount": "#047857",
      "prospectsCount": "#4f46e5",
      "dispatchesCount": "#ec4899"
    };
    
    return colors[key] || "#047857";
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center bg-muted/20 rounded-md">
            <div className="text-center">
              {variant === "area" ? (
                <LineChart className="h-10 w-10 mb-2 text-muted-foreground mx-auto" />
              ) : (
                <BarChart2 className="h-10 w-10 mb-2 text-muted-foreground mx-auto" />
              )}
              <p className="text-muted-foreground">Nenhum dado disponível</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              {variant === "area" ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getColor(dataKey)} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={getColor(dataKey)} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value === 0 ? '0' : value}
                  />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey={dataKey} 
                    stroke={getColor(dataKey)} 
                    fillOpacity={1}
                    fill={`url(#gradient-${dataKey})`} 
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value === 0 ? '0' : value}
                  />
                  <Tooltip />
                  <Bar 
                    dataKey={dataKey} 
                    fill={getColor(dataKey)} 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
