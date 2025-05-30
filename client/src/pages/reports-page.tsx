import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, RefreshCw, BarChart3, MessageSquare, DollarSign, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportData {
  conversations: any[];
  messages: any[];
  billing: any[];
  leads: any[];
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [reportData, setReportData] = useState<ReportData>({
    conversations: [],
    messages: [],
    billing: [],
    leads: []
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  // Buscar dados dos relatórios
  const fetchReports = async () => {
    setLoading(true);
    try {
      const userId = 2; // Implementar busca do usuário autenticado
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(phoneNumberId && { phoneNumberId })
      });

      const [conversationsRes, messagesRes, billingRes, leadsRes] = await Promise.all([
        fetch(`/api/meta-reports/conversations/${userId}?${params}`),
        fetch(`/api/meta-reports/messages/${userId}?${params}`),
        fetch(`/api/meta-reports/billing/${userId}?${params}`),
        fetch(`/api/meta-reports/leads/${userId}?${params}`)
      ]);

      const [conversations, messages, billing, leads] = await Promise.all([
        conversationsRes.json(),
        messagesRes.json(),
        billingRes.json(),
        leadsRes.json()
      ]);

      setReportData({ conversations, messages, billing, leads });
    } catch (error) {
      toast({
        title: "Erro ao carregar relatórios",
        description: "Não foi possível carregar os dados dos relatórios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar dados com a Meta API
  const syncMetaData = async () => {
    setSyncing(true);
    try {
      const userId = 2; // Implementar busca do usuário autenticado
      const response = await fetch(`/api/meta-reports/sync/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Sincronização concluída",
          description: "Dados da Meta API sincronizados com sucesso"
        });
        fetchReports(); // Recarregar dados após sincronização
      } else {
        toast({
          title: "Erro na sincronização",
          description: result.error || "Erro ao sincronizar dados da Meta API",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com a Meta API",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Exportar dados para CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há dados disponíveis para exportação",
        variant: "destructive"
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${startDate}_${endDate}.csv`;
    link.click();
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, phoneNumberId]);

  // Calcular estatísticas resumidas
  const stats = {
    totalConversations: reportData.conversations.length,
    freeConversations: reportData.conversations.filter(c => c.is_free_window).length,
    totalMessages: reportData.messages.length,
    deliveredMessages: reportData.messages.filter(m => m.delivery_status === 'delivered').length,
    leadsWithResponse: reportData.leads.filter(l => l.has_response).length,
    totalCost: reportData.billing.reduce((sum, b) => sum + parseFloat(b.cost_brl || '0'), 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios Meta</h1>
          <p className="text-muted-foreground">
            Análise detalhada das comunicações via WhatsApp Business Cloud API
          </p>
        </div>
        <Button onClick={syncMetaData} disabled={syncing} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Meta API'}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <Label htmlFor="phoneNumberId">Phone Number ID (Opcional)</Label>
            <Input
              id="phoneNumberId"
              placeholder="Digite o Phone Number ID"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.freeConversations} gratuitas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Entregues</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveredMessages}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalMessages} enviadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Respondidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leadsWithResponse}</div>
            <p className="text-xs text-muted-foreground">
              de {reportData.leads.length} leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">BRL</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com os relatórios */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversations">Conversas Iniciadas</TabsTrigger>
          <TabsTrigger value="messages">Entrega de Mensagens</TabsTrigger>
          <TabsTrigger value="billing">Cobrança</TabsTrigger>
          <TabsTrigger value="leads">Leads Respondidos</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Conversas Iniciadas</CardTitle>
                <CardDescription>
                  Lista de todas as conversas iniciadas no período
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => exportToCSV(reportData.conversations, 'conversas')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Carregando...</p>
              ) : reportData.conversations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-2 text-left">Contato</th>
                        <th className="border border-gray-200 p-2 text-left">Tipo</th>
                        <th className="border border-gray-200 p-2 text-left">Período Gratuito</th>
                        <th className="border border-gray-200 p-2 text-left">Início</th>
                        <th className="border border-gray-200 p-2 text-left">Mensagens</th>
                        <th className="border border-gray-200 p-2 text-left">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.conversations.map((conv, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 p-2">
                            {conv.contact_number === 'aggregate_report' ? 'Relatório Consolidado' : conv.contact_number}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {conv.conversation_type === 'business_initiated' ? 'Iniciada pelo Negócio' : 
                             conv.conversation_type === 'user_initiated' ? 'Iniciada pelo Cliente' : 
                             conv.conversation_type}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {conv.is_free_window ? 'Sim' : 'Não'}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {format(new Date(conv.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </td>
                          <td className="border border-gray-200 p-2">{conv.message_count}</td>
                          <td className="border border-gray-200 p-2">R$ {(parseFloat(conv.cost_brl) || 0.038).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma conversa encontrada no período selecionado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Entrega de Mensagens</CardTitle>
                <CardDescription>
                  Status de entrega das mensagens enviadas
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => exportToCSV(reportData.messages, 'mensagens')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Carregando...</p>
              ) : reportData.messages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-2 text-left">Contato</th>
                        <th className="border border-gray-200 p-2 text-left">Tipo</th>
                        <th className="border border-gray-200 p-2 text-left">Template</th>
                        <th className="border border-gray-200 p-2 text-left">Status</th>
                        <th className="border border-gray-200 p-2 text-left">Enviado</th>
                        <th className="border border-gray-200 p-2 text-left">Entregue</th>
                        <th className="border border-gray-200 p-2 text-left">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.messages.map((msg, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 p-2">
                            {msg.contact_number === 'aggregate_report' ? 'Relatório Consolidado' : msg.contact_number}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {msg.message_type === 'text' ? 'Texto' : 
                             msg.message_type === 'template' ? 'Template' : 
                             msg.message_type === 'image' ? 'Imagem' : 
                             msg.message_type === 'document' ? 'Documento' : 
                             msg.message_type}
                          </td>
                          <td className="border border-gray-200 p-2">{msg.template_name || '-'}</td>
                          <td className="border border-gray-200 p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              msg.delivery_status === 'delivered' ? 'bg-green-100 text-green-800' :
                              msg.delivery_status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {msg.delivery_status === 'delivered' ? 'Entregue' :
                               msg.delivery_status === 'failed' ? 'Falha' :
                               msg.delivery_status === 'sent' ? 'Enviado' :
                               msg.delivery_status === 'read' ? 'Lido' :
                               msg.delivery_status}
                            </span>
                          </td>
                          <td className="border border-gray-200 p-2">
                            {format(new Date(msg.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {msg.delivered_at ? format(new Date(msg.delivered_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                          </td>
                          <td className="border border-gray-200 p-2">R$ {(parseFloat(msg.cost_brl) || 0.027).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma mensagem encontrada no período selecionado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Cobrança</CardTitle>
                <CardDescription>
                  Resumo dos custos por período
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => exportToCSV(reportData.billing, 'cobranca')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Carregando...</p>
              ) : reportData.billing.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-2 text-left">Data</th>
                        <th className="border border-gray-200 p-2 text-left">Conversas</th>
                        <th className="border border-gray-200 p-2 text-left">Gratuitas</th>
                        <th className="border border-gray-200 p-2 text-left">Pagas</th>
                        <th className="border border-gray-200 p-2 text-left">Mensagens</th>
                        <th className="border border-gray-200 p-2 text-left">Custo Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.billing.map((bill, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 p-2">
                            {format(new Date(bill.report_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td className="border border-gray-200 p-2">{bill.conversation_count}</td>
                          <td className="border border-gray-200 p-2">{bill.free_conversation_count}</td>
                          <td className="border border-gray-200 p-2">{bill.paid_conversation_count}</td>
                          <td className="border border-gray-200 p-2">{bill.message_count}</td>
                          <td className="border border-gray-200 p-2">${bill.total_cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Nenhum dado de cobrança encontrado no período selecionado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Relatório de Leads Respondidos</CardTitle>
                <CardDescription>
                  Análise de resposta dos leads contactados
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => exportToCSV(reportData.leads, 'leads')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Carregando...</p>
              ) : reportData.leads.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-2 text-left">Contato</th>
                        <th className="border border-gray-200 p-2 text-left">Fonte</th>
                        <th className="border border-gray-200 p-2 text-left">Primeira Mensagem</th>
                        <th className="border border-gray-200 p-2 text-left">Primeira Resposta</th>
                        <th className="border border-gray-200 p-2 text-left">Tempo de Resposta</th>
                        <th className="border border-gray-200 p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.leads.map((lead, index) => (
                        <tr key={index}>
                          <td className="border border-gray-200 p-2">{lead.contact_number}</td>
                          <td className="border border-gray-200 p-2">{lead.lead_source || '-'}</td>
                          <td className="border border-gray-200 p-2">
                            {format(new Date(lead.first_message_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </td>
                          <td className="border border-gray-200 p-2">
                            {lead.first_response_at ? 
                              format(new Date(lead.first_response_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 
                              '-'
                            }
                          </td>
                          <td className="border border-gray-200 p-2">
                            {lead.response_time ? `${Math.round(lead.response_time)} min` : '-'}
                          </td>
                          <td className="border border-gray-200 p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              lead.lead_status === 'responded' ? 'bg-green-100 text-green-800' :
                              lead.lead_status === 'converted' ? 'bg-blue-100 text-blue-800' :
                              lead.lead_status === 'lost' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {lead.lead_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Nenhum lead encontrado no período selecionado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}