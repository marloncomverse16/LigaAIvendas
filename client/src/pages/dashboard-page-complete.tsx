import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Wifi,
  MessageSquare,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
  BarChart3,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  metaConnection: {
    connected: boolean;
    phoneNumber: string;
    lastCheck: string;
  };
  qrConnection: {
    connected: boolean;
    instanceName: string;
    lastCheck: string;
  };
  cloudReports: {
    totalConversations: number;
    totalMessages: number;
    totalCost: number;
    leadsWithResponse: number;
  };
  qrReports: {
    totalConversations: number;
    totalMessages: number;
    totalContacts: number;
  };
  goals: {
    revenue: number;
    averageTicket: number;
    leadsGoal: number;
    period: string;
  };
  calculations: {
    messagesPerLead: number;
    leadsPerSale: number;
    averageSalePrice: number;
    requiredMessages: number;
    projectedRevenue: number;
  };
}

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [refreshing, setRefreshing] = useState(false);

  // Buscar dados do dashboard
  const { data: dashboardData, refetch, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/complete', startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/complete?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error('Erro ao carregar dados');
      return response.json();
    }
  });

  const refreshData = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{getGreeting()}</h1>
          <p className="text-muted-foreground">
            Visão geral da sua operação WhatsApp
          </p>
        </div>
        <Button 
          onClick={refreshData} 
          disabled={refreshing} 
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-600 hover:to-yellow-500 text-white border-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
        </Button>
      </div>

      {/* Filtros de Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período de Análise
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Data Inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">Data Final</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status das Conexões */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              WhatsApp Cloud API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dashboardData?.metaConnection.connected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-700">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-700">Desconectado</span>
                  </>
                )}
              </div>
              <Badge variant={dashboardData?.metaConnection.connected ? "default" : "destructive"}>
                {dashboardData?.metaConnection.connected ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {dashboardData?.metaConnection.phoneNumber && (
              <p className="text-sm text-muted-foreground mt-2">
                Telefone: {dashboardData.metaConnection.phoneNumber}
              </p>
            )}
            {dashboardData?.metaConnection.lastCheck && (
              <p className="text-xs text-muted-foreground mt-1">
                Última verificação: {format(new Date(dashboardData.metaConnection.lastCheck), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              WhatsApp Web (QR Code)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dashboardData?.qrConnection.connected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-700">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-700">Desconectado</span>
                  </>
                )}
              </div>
              <Badge variant={dashboardData?.qrConnection.connected ? "default" : "destructive"}>
                {dashboardData?.qrConnection.connected ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {dashboardData?.qrConnection.instanceName && (
              <p className="text-sm text-muted-foreground mt-2">
                Instância: {dashboardData.qrConnection.instanceName}
              </p>
            )}
            {dashboardData?.qrConnection.lastCheck && (
              <p className="text-xs text-muted-foreground mt-1">
                Última verificação: {format(new Date(dashboardData.qrConnection.lastCheck), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo dos Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatórios Cloud API
            </CardTitle>
            <CardDescription>Dados com custos por mensagem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Conversas</p>
                <p className="text-2xl font-bold">{dashboardData?.cloudReports.totalConversations || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mensagens</p>
                <p className="text-2xl font-bold">{dashboardData?.cloudReports.totalMessages || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-2xl font-bold text-red-600">
                  R$ {(dashboardData?.cloudReports.totalCost || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Responderam</p>
                <p className="text-2xl font-bold text-green-600">{dashboardData?.cloudReports.leadsWithResponse || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Relatórios QR Code
            </CardTitle>
            <CardDescription>API gratuita - sem custos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Conversas</p>
                <p className="text-2xl font-bold">{dashboardData?.qrReports.totalConversations || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mensagens</p>
                <p className="text-2xl font-bold">{dashboardData?.qrReports.totalMessages || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contatos</p>
                <p className="text-2xl font-bold">{dashboardData?.qrReports.totalContacts || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo</p>
                <p className="text-2xl font-bold text-green-600">Gratuito</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metas de Faturamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas de Faturamento
          </CardTitle>
          <CardDescription>
            Configurações definidas em "Configurações - Metas"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground">Meta de Receita</h3>
              <p className="text-3xl font-bold text-green-600">
                R$ {(dashboardData?.goals.revenue || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">
                Período: {dashboardData?.goals.period || 'Mensal'}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground">Ticket Médio</h3>
              <p className="text-3xl font-bold text-blue-600">
                R$ {(dashboardData?.goals.averageTicket || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">
                Por venda realizada
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground">Meta de Leads</h3>
              <p className="text-3xl font-bold text-purple-600">
                {dashboardData?.goals.leadsGoal || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Leads no período
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cálculos e Projeções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análises e Projeções
          </CardTitle>
          <CardDescription>
            Cálculos baseados no histórico do período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <h3 className="font-medium">Mensagens por Lead</h3>
              </div>
              <p className="text-2xl font-bold">
                {(dashboardData?.calculations.messagesPerLead || 0).toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">
                Média de mensagens enviadas para conseguir 1 lead
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <h3 className="font-medium">Leads por Venda</h3>
              </div>
              <p className="text-2xl font-bold">
                {(dashboardData?.calculations.leadsPerSale || 0).toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">
                Média de leads para fechar 1 venda
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <h3 className="font-medium">Preço Médio de Venda</h3>
              </div>
              <p className="text-2xl font-bold">
                R$ {(dashboardData?.calculations.averageSalePrice || 0).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                Ticket médio por venda fechada
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-red-500" />
                <h3 className="font-medium">Disparos Necessários</h3>
              </div>
              <p className="text-2xl font-bold">
                {(dashboardData?.calculations.requiredMessages || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">
                Para atingir a meta de faturamento
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <h3 className="font-medium">Receita Projetada</h3>
              </div>
              <p className="text-2xl font-bold">
                R$ {(dashboardData?.calculations.projectedRevenue || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">
                Baseada no desempenho atual
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <h3 className="font-medium">Status da Meta</h3>
              </div>
              <div className="flex items-center gap-2">
                {(dashboardData?.calculations.projectedRevenue || 0) >= (dashboardData?.goals.revenue || 0) ? (
                  <Badge variant="default">No Alvo</Badge>
                ) : (
                  <Badge variant="destructive">Abaixo da Meta</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {(dashboardData?.calculations.projectedRevenue || 0) >= (dashboardData?.goals.revenue || 0) 
                  ? 'Projeção atinge a meta' 
                  : 'Necessário aumentar esforços'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando dados...</span>
        </div>
      )}
    </div>
  );
}