import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  isEmpty?: boolean;
}

interface QRReportData {
  conversations: any[];
  messages: any[];
  contacts: any[];
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<ReportData>({
    conversations: [],
    messages: [],
    billing: [],
    leads: [],
    isEmpty: false
  });
  const [qrReportData, setQrReportData] = useState<QRReportData>({
    conversations: [],
    messages: [],
    contacts: []
  });
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('meta');
  const { toast } = useToast();

  // Buscar dados dos relatórios QR Code - ISOLAMENTO GARANTIDO
  const fetchQRReports = async () => {
    setQrLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      });

      const [conversationsRes, messagesRes, contactsRes] = await Promise.all([
        fetch(`/api/qr-reports/conversations?${params}`),
        fetch(`/api/qr-reports/messages?${params}`),
        fetch(`/api/qr-reports/contacts?${params}`)
      ]);

      const [conversations, messages, contacts] = await Promise.all([
        conversationsRes.json(),
        messagesRes.json(),
        contactsRes.json()
      ]);

      setQrReportData({
        conversations: conversations || [],
        messages: messages || [],
        contacts: contacts || []
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar relatórios",
        description: "Não foi possível carregar os dados dos relatórios QR Code",
        variant: "destructive"
      });
    } finally {
      setQrLoading(false);
    }
  };

  // Buscar dados dos relatórios Meta - ISOLAMENTO GARANTIDO
  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      });

      const [conversationsRes, messagesRes, billingRes, leadsRes] = await Promise.all([
        fetch(`/api/meta-reports/conversations?${params}`),
        fetch(`/api/meta-reports/messages?${params}`),
        fetch(`/api/meta-reports/billing?${params}`),
        fetch(`/api/meta-reports/leads?${params}`)
      ]);

      const [conversations, messages, billing, leads] = await Promise.all([
        conversationsRes.json(),
        messagesRes.json(),
        billingRes.json(),
        leadsRes.json()
      ]);

      // Verificar se são dados vazios de um novo usuário
      const totalData = (conversations?.length || 0) + (messages?.length || 0) + 
                       (billing?.length || 0) + (leads?.length || 0);
      
      console.log('📊 Total de dados Meta carregados:', totalData);

      setReportData({
        conversations: conversations || [],
        messages: messages || [],
        billing: billing || [],
        leads: leads || [],
        isEmpty: totalData === 0
      });
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

  // Sincronizar dados da Meta API - ISOLAMENTO GARANTIDO
  const syncMetaData = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/meta-reports/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
      });

      if (response.ok) {
        toast({
          title: "Sincronização concluída",
          description: "Dados da Meta API foram atualizados com sucesso"
        });
        await fetchReports();
      } else {
        throw new Error('Erro na sincronização');
      }
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar os dados da Meta API",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (activeTab === 'meta') {
      fetchReports();
    } else {
      fetchQRReports();
    }
  }, [startDate, endDate, activeTab]);

  // Estatísticas resumidas Meta API - corrigindo nomes dos campos
  const stats = {
    totalConversations: reportData.conversations.length,
    freeConversations: reportData.conversations.filter(c => c.is_free_window === true || c.is_free_window === 't').length,
    totalMessages: reportData.messages.length,
    deliveredMessages: reportData.messages.filter(m => m.delivery_status === 'delivered').length,
    leadsWithResponse: reportData.leads.filter(l => l.has_response === true || l.has_response === 't').length,
    totalCost: reportData.billing.reduce((sum, b) => sum + parseFloat(b.total_cost || '0'), 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios WhatsApp</h1>
          <p className="text-muted-foreground">
            Análise detalhada das comunicações via WhatsApp Meta API e QR Code
          </p>
        </div>
      </div>

      {/* Abas principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="meta">Relatórios Meta API</TabsTrigger>
          <TabsTrigger value="qr">Relatórios QR Code</TabsTrigger>
        </TabsList>

        {/* Aba Meta API */}
        <TabsContent value="meta" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">WhatsApp Business Cloud API</h2>
              <p className="text-muted-foreground">Dados com custo por mensagem e conversa</p>
            </div>
            <Button onClick={syncMetaData} disabled={syncing} className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Meta API'}
            </Button>
          </div>

          {/* Filtros Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Filtros
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

          {/* Estatísticas Meta */}
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
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {stats.totalCost.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.leadsWithResponse} leads responderam
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios detalhados Meta */}
          <Tabs defaultValue="conversations" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conversations">Conversas Iniciadas</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              <Card>
                <CardHeader>
                  <CardTitle>Conversas Iniciadas</CardTitle>
                  <CardDescription>
                    Detalhamento das conversas dentro e fora do período gratuito
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData.conversations.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Tipo</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Iniciada em</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Custo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.conversations.slice(0, 10).map((conv, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{conv.contact_number}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  conv.is_free_window === true || conv.is_free_window === 't' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {conv.is_free_window === true || conv.is_free_window === 't' ? 'Gratuita' : 'Comercial'}
                                </span>
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {conv.started_at ? format(new Date(conv.started_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">R$ {parseFloat(conv.cost_brl || conv.total_cost || '0').toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        Mostrando os primeiros 10 resultados de {reportData.conversations.length} conversas
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      {reportData.isEmpty ? (
                        <div className="space-y-2">
                          <p>Não há dados de conversas Meta disponíveis ainda.</p>
                          <p className="text-sm">Para gerar relatórios, clique em "Sincronizar Meta API" acima.</p>
                        </div>
                      ) : (
                        <p>Nenhuma conversa encontrada no período selecionado</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages">
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens Enviadas e Entregues</CardTitle>
                  <CardDescription>
                    Status de entrega das mensagens enviadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData.messages.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Enviado em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.messages.slice(0, 10).map((msg, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{msg.contact_number}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  msg.delivery_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  msg.delivery_status === 'sent' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {msg.delivery_status === 'delivered' ? 'Entregue' :
                                   msg.delivery_status === 'sent' ? 'Enviado' : 'Falhou'}
                                </span>
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {msg.sent_at ? format(new Date(msg.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
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



            <TabsContent value="leads">
              <Card>
                <CardHeader>
                  <CardTitle>Leads que Responderam</CardTitle>
                  <CardDescription>
                    Contatos que responderam após receber mensagens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData.leads.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Primeira Mensagem</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.leads.slice(0, 10).map((lead, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{lead.contact_number}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                {lead.first_message_at ? format(new Date(lead.first_message_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  lead.has_response === true || lead.has_response === 't' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {lead.has_response === true || lead.has_response === 't' ? 'Respondeu' : 'Não respondeu'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        Mostrando os primeiros 10 resultados de {reportData.leads.length} leads
                      </div>
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
        </TabsContent>

        {/* Aba QR Code */}
        <TabsContent value="qr" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">WhatsApp via QR Code</h2>
              <p className="text-muted-foreground">API gratuita - sem custos por mensagem</p>
            </div>
            <Button onClick={fetchQRReports} disabled={qrLoading} className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold">
              <RefreshCw className={`h-4 w-4 ${qrLoading ? 'animate-spin' : ''}`} />
              {qrLoading ? 'Carregando...' : 'Atualizar Relatórios'}
            </Button>
          </div>

          {/* Filtros QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qrStartDate">Data Inicial</Label>
                <Input
                  id="qrStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="qrEndDate">Data Final</Label>
                <Input
                  id="qrEndDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{qrReportData.conversations.length}</div>
                <p className="text-xs text-muted-foreground">
                  Via QR Code - Gratuito
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{qrReportData.messages.length}</div>
                <p className="text-xs text-muted-foreground">
                  Sem custo por mensagem
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contatos Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{qrReportData.contacts.length}</div>
                <p className="text-xs text-muted-foreground">
                  Conectados via QR Code
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios detalhados QR Code */}
          <Tabs defaultValue="qr-conversations" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="qr-conversations">Conversas</TabsTrigger>
              <TabsTrigger value="qr-messages">Mensagens</TabsTrigger>
              <TabsTrigger value="qr-contacts">Contatos</TabsTrigger>
            </TabsList>

            <TabsContent value="qr-conversations">
              <Card>
                <CardHeader>
                  <CardTitle>Conversas Iniciadas via QR Code</CardTitle>
                  <CardDescription>
                    Lista de conversas sem custos adicionais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {qrReportData.conversations.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Nome</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Primeiro Contato</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Último Contato</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Total Mensagens</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrReportData.conversations.map((conv, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{conv.phone_number}</td>
                              <td className="border border-gray-200 px-4 py-2">{conv.name || 'N/A'}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                {conv.first_contact ? format(new Date(conv.first_contact), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {conv.last_contact ? format(new Date(conv.last_contact), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">{conv.total_messages}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        Mostrando {Math.min(10, qrReportData.conversations.length)} de {qrReportData.conversations.length} conversas
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p>Nenhuma conversa QR Code encontrada no período selecionado</p>
                      <p className="text-sm mt-2">Envie mensagens via QR Code para gerar dados aqui automaticamente</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr-messages">
              <Card>
                <CardHeader>
                  <CardTitle>Mensagens via QR Code</CardTitle>
                  <CardDescription>
                    Histórico de mensagens sem custos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {qrReportData.messages.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Tipo</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Enviado em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrReportData.messages.slice(0, 10).map((msg, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{msg.phone_number}</td>
                              <td className="border border-gray-200 px-4 py-2">{msg.message_type}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {msg.status === 'sent' ? 'Enviado' : 
                                   msg.status === 'delivered' ? 'Entregue' : 
                                   msg.status === 'read' ? 'Lido' : 
                                   msg.status === 'failed' ? 'Falhou' : 
                                   msg.status || 'Enviado'}
                                </span>
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {msg.sent_at ? format(new Date(msg.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
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

            <TabsContent value="qr-contacts">
              <Card>
                <CardHeader>
                  <CardTitle>Contatos via QR Code</CardTitle>
                  <CardDescription>
                    Lista de contatos conectados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {qrReportData.contacts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-2 text-left">Telefone</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Nome</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Última Atividade</th>
                            <th className="border border-gray-200 px-4 py-2 text-left">Adicionado em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrReportData.contacts.slice(0, 10).map((contact, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-4 py-2">{contact.phone_number}</td>
                              <td className="border border-gray-200 px-4 py-2">{contact.name || 'N/A'}</td>
                              <td className="border border-gray-200 px-4 py-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  contact.activity_status === 'Ativo' ? 'bg-green-100 text-green-800' :
                                  contact.activity_status === 'Recente' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {contact.activity_status}
                                </span>
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {contact.last_message_time ? format(new Date(contact.last_message_time), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                              <td className="border border-gray-200 px-4 py-2">
                                {contact.created_at ? format(new Date(contact.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        Mostrando {Math.min(10, qrReportData.contacts.length)} de {qrReportData.contacts.length} contatos
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p>Nenhum contato QR Code encontrado no período selecionado</p>
                      <p className="text-sm mt-2">Envie mensagens via QR Code para gerar dados aqui automaticamente</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}