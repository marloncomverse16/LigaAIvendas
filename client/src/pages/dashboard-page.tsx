import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Sidebar } from "@/components/layout/sidebar";
import { StatusCard } from "@/components/dashboard/status-card";
import { CounterCard } from "@/components/dashboard/counter-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { LeadRecommendations } from "@/components/dashboard/lead-recommendations-fixed";
import { 
  AlertCircle, 
  MessageSquare, 
  Calendar, 
  Search, 
  ArrowDown, 
  ArrowUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Fetch dashboard stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Fetch metrics for charts
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/metrics"],
  });
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };
  
  const subtitle = user?.name 
    ? `${getGreeting()}, ${user.name}`
    : `${getGreeting()}, ${user?.username}`;
  
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen ml-0 md:ml-64">
        <Header title="Dashboard" subtitle={subtitle} />
        
        <main className="flex-1 p-4 md:p-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatusCard
              title="Status do WhatsApp"
              value={stats?.whatsappStatus || "desconectado"}
              icon={<MessageSquare className="h-5 w-5" />}
              iconBgColor="bg-primary-50 dark:bg-primary-900"
              iconTextColor="text-primary"
              actionLabel="Conectar agora"
              actionUrl="#"
              isLoading={isLoadingStats}
            />
            
            <StatusCard
              title="Tokens Disponíveis"
              value={stats?.availableTokens?.toString() || "0"}
              icon={<AlertCircle className="h-5 w-5" />}
              iconBgColor="bg-secondary-50 dark:bg-secondary-900"
              iconTextColor="text-secondary"
              actionLabel="Comprar mais"
              actionUrl="#"
              isLoading={isLoadingStats}
              variant="numeric"
            />
            
            <StatusCard
              title="Status de Disparos"
              value={stats?.dispatchStatus || "inativo"}
              icon={<MessageSquare className="h-5 w-5" />}
              iconBgColor="bg-accent-50 dark:bg-accent-900"
              iconTextColor="text-accent"
              actionLabel="Ver histórico"
              actionUrl="#"
              isLoading={isLoadingStats}
            />
          </div>
          
          {/* Counters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <CounterCard
              title="Total de Leads"
              count={stats?.leadsCount || 0}
              icon={<AlertCircle className="h-5 w-5" />}
              growth={0}
              bgColor="from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700"
              isLoading={isLoadingStats}
            />
            
            <CounterCard
              title="Total de Prospecções"
              count={stats?.prospectsCount || 0}
              icon={<Search className="h-5 w-5" />}
              growth={0}
              bgColor="from-secondary-500 to-secondary-600 dark:from-secondary-600 dark:to-secondary-700"
              isLoading={isLoadingStats}
            />
            
            <CounterCard
              title="Total de Disparos"
              count={stats?.dispatchesCount || 0}
              icon={<MessageSquare className="h-5 w-5" />}
              growth={0}
              bgColor="from-accent-500 to-accent-600 dark:from-accent-600 dark:to-accent-700"
              isLoading={isLoadingStats}
            />
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <ChartCard
              title="Disparos por Mês"
              data={metrics || []}
              dataKey="dispatchesCount"
              isLoading={isLoadingMetrics}
            />
            
            <ChartCard
              title="Prospecções por Mês"
              data={metrics || []}
              dataKey="prospectsCount"
              isLoading={isLoadingMetrics}
            />
          </div>
          
          {/* Lead Recommendations */}
          <LeadRecommendations />
          
          {/* Recent Activity */}
          <div className="bg-card rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Atividades Recentes</h2>
              <button className="text-sm text-primary hover:underline">Ver todas</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-card-foreground">Novo lead cadastrado <span className="font-medium">João Silva</span></p>
                  <p className="text-sm text-muted-foreground">Hoje, 10:45</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-card-foreground">Disparo automático concluído <span className="font-medium">Campanha de Fim de Ano</span></p>
                  <p className="text-sm text-muted-foreground">Ontem, 18:30</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-card-foreground">Reunião agendada com <span className="font-medium">Maria Oliveira</span></p>
                  <p className="text-sm text-muted-foreground">{format(new Date(), "dd/MM/yyyy', 'HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
