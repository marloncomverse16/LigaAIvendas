import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Phone, Calendar, Search, Users, CheckCircle, AlertCircle, Clock, User, Edit, DollarSign, ArrowRight, Download, Filter, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CrmLead {
  id: number;
  userId: number;
  phoneNumber: string;
  name?: string;
  status: 'sendo_atendido_ia' | 'finalizado_ia' | 'precisa_atendimento_humano' | 'transferido_humano' | 'finalizado_humano' | 'abandonado';
  source: string;
  sourceId?: number;
  assignedToUserId?: number;
  firstContactAt?: string;
  lastContactAt?: string;
  lastActivityAt: string;
  aiAgentId?: number;
  aiStatus?: string;
  aiNotes?: string;
  nextFollowUpAt?: string;
  followUpCount: number;
  notes?: string;
  tags: string[];
  isConverted: boolean;
  convertedAt?: string;
  conversionValue?: string;
  createdAt: string;
  updatedAt: string;
  assignedUserName?: string;
  aiAgentName?: string;
  activityCount: number;
}

interface CrmStats {
  total_leads: number;
  sendo_atendido_ia: number;
  finalizado_ia: number;
  precisa_atendimento_humano: number;
  transferido_humano: number;
  finalizado_humano: number;
  abandonado: number;
  converted_leads: number;
  urgent_leads: number;
  overdue_followups: number;
}

interface LeadsResponse {
  leads: CrmLead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const leadFormSchema = z.object({
  phoneNumber: z.string().min(1, "Telefone é obrigatório"),
  name: z.string().optional(),
  status: z.enum(['sendo_atendido_ia', 'finalizado_ia', 'precisa_atendimento_humano', 'transferido_humano', 'finalizado_humano', 'abandonado']),
  source: z.string().min(1, "Origem é obrigatória"),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['sendo_atendido_ia', 'finalizado_ia', 'precisa_atendimento_humano', 'transferido_humano', 'finalizado_humano', 'abandonado']),
  conversionValue: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;
type UpdateStatusData = z.infer<typeof updateStatusSchema>;

const statusLabels = {
  'sendo_atendido_ia': 'Sendo Atendido pela IA',
  'finalizado_ia': 'Finalizado pela IA',
  'precisa_atendimento_humano': 'Precisa Atendimento Humano',
  'transferido_humano': 'Transferido para Humano',
  'finalizado_humano': 'Finalizado por Humano',
  'abandonado': 'Abandonado'
};

const statusColors = {
  'sendo_atendido_ia': 'bg-blue-100 text-blue-800',
  'finalizado_ia': 'bg-green-100 text-green-800',
  'precisa_atendimento_humano': 'bg-yellow-100 text-yellow-800',
  'transferido_humano': 'bg-purple-100 text-purple-800',
  'finalizado_humano': 'bg-emerald-100 text-emerald-800',
  'abandonado': 'bg-gray-100 text-gray-800'
};

export default function CrmLeadsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [leadToUpdate, setLeadToUpdate] = useState<CrmLead | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Filtros por data
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Buscar estatísticas
  const { data: stats } = useQuery<CrmStats>({
    queryKey: ["/api/crm/stats"],
  });

  // Buscar leads com filtros
  const { data: leadsData, isLoading, refetch } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", page, searchTerm, statusFilter, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);
      
      const response = await fetch(`/api/crm/leads?${params}`);
      if (!response.ok) throw new Error("Erro ao buscar leads");
      return response.json();
    },
  });

  // Formulário para criar lead
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      phoneNumber: "",
      name: "",
      status: "sendo_atendido_ia",
      source: "manual",
      notes: "",
    },
  });

  // Formulário para atualizar status
  const statusForm = useForm<UpdateStatusData>({
    resolver: zodResolver(updateStatusSchema),
    defaultValues: {
      status: "sendo_atendido_ia",
      conversionValue: "",
    },
  });

  // Formulário para editar lead
  const editForm = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      phoneNumber: "",
      name: "",
      status: "sendo_atendido_ia",
      source: "manual",
      notes: "",
    },
  });

  // Criar lead
  const createMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao criar lead");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Lead criado",
        description: "Lead criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar status do lead
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number, data: UpdateStatusData }) => {
      const response = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao atualizar lead");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setIsStatusDialogOpen(false);
      setLeadToUpdate(null);
      statusForm.reset();
      toast({
        title: "Status atualizado",
        description: "Status do lead atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Editar lead
  const editMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number, data: LeadFormData }) => {
      const response = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao atualizar lead");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      setIsEditMode(false);
      setSelectedLead(null);
      editForm.reset();
      toast({
        title: "Lead atualizado",
        description: "Lead atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const onSubmit = (data: LeadFormData) => {
    createMutation.mutate(data);
  };

  const onStatusSubmit = (data: UpdateStatusData) => {
    if (leadToUpdate) {
      updateStatusMutation.mutate({ leadId: leadToUpdate.id, data });
    }
  };

  const onEditSubmit = (data: LeadFormData) => {
    if (selectedLead) {
      editMutation.mutate({ leadId: selectedLead.id, data });
    }
  };

  const openStatusDialog = (lead: CrmLead) => {
    setLeadToUpdate(lead);
    statusForm.reset({
      status: lead.status,
      conversionValue: lead.conversionValue || "",
    });
    setIsStatusDialogOpen(true);
  };

  const openEditMode = (lead: CrmLead) => {
    setSelectedLead(lead);
    editForm.reset({
      phoneNumber: lead.phoneNumber,
      name: lead.name || "",
      status: lead.status,
      source: lead.source,
      notes: lead.notes || "",
    });
    setIsEditMode(true);
  };

  // Função para exportar dados para CSV
  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Buscar todos os leads com os filtros aplicados (sem paginação)
      const params = new URLSearchParams({
        page: "1",
        limit: "1000", // Limite alto para pegar todos
      });
      
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (dateFilter.start) params.append("startDate", dateFilter.start);
      if (dateFilter.end) params.append("endDate", dateFilter.end);
      
      const response = await fetch(`/api/crm/leads?${params}`);
      if (!response.ok) throw new Error("Erro ao buscar dados para exportação");
      
      const data: LeadsResponse = await response.json();
      
      // Gerar CSV
      const csvHeaders = 'Telefone,Nome,Status,Origem,Valor Conversão,Notas,Data Criação,Última Atividade\n';
      const csvData = data.leads.map(lead => {
        const phone = lead.phoneNumber;
        const name = (lead.name || '').replace(/"/g, '""');
        const status = statusLabels[lead.status];
        const source = lead.source;
        const conversionValue = lead.conversionValue || '';
        const notes = (lead.notes || '').replace(/"/g, '""');
        const createdAt = new Date(lead.createdAt).toLocaleDateString('pt-BR');
        const lastActivity = new Date(lead.lastActivityAt).toLocaleDateString('pt-BR');
        
        return `"${phone}","${name}","${status}","${source}","${conversionValue}","${notes}","${createdAt}","${lastActivity}"`;
      }).join('\n');
      
      const csv = csvHeaders + csvData;
      
      // Fazer download do arquivo
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_crm_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Exportação concluída",
        description: `${data.leads.length} leads exportados com sucesso`,
      });
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro na exportação",
        description: "Erro ao exportar dados para CSV",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Aplicar filtros por data
  const applyDateFilter = () => {
    setPage(1); // Reset página
    refetch(); // Refazer consulta
    setShowDateFilter(false);
  };

  // Limpar filtros por data
  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-orange-600">CRM de Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e acompanhe o funil de vendas
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowDateFilter(!showDateFilter)}
            variant="outline"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros por Data
          </Button>
          <Button
            onClick={exportToCSV}
            disabled={isExporting}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Lead</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do lead" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem</FormLabel>
                        <FormControl>
                          <Input placeholder="Origem do lead" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Observações sobre o lead" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Lead"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros por Data */}
      {showDateFilter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros por Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
              <div className="flex items-end space-x-2">
                <Button onClick={applyDateFilter} className="bg-orange-500 hover:bg-orange-600">
                  Aplicar
                </Button>
                <Button onClick={clearDateFilter} variant="outline">
                  Limpar
                </Button>
                <Button
                  onClick={() => setShowDateFilter(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_leads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sendo Atendidos IA</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sendo_atendido_ia}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.converted_leads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Precisam Atenção</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.precisa_atendimento_humano}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por telefone, nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>
            {leadsData ? `${leadsData.pagination.total} leads encontrados` : "Carregando..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : leadsData?.leads.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leadsData?.leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {lead.phoneNumber}
                          {lead.name && (
                            <span className="ml-2 text-muted-foreground">
                              - {lead.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={statusColors[lead.status]}>
                            {statusLabels[lead.status]}
                          </Badge>
                          {lead.conversionValue && (
                            <span className="text-sm font-medium text-green-600">
                              R$ {lead.conversionValue}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {lead.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => openStatusDialog(lead)}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Alterar Status
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => openEditMode(lead)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {leadsData && leadsData.pagination.totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="flex items-center px-4 text-sm">
                  Página {page} de {leadsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= leadsData.pagination.totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para alterar status */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status do Lead</DialogTitle>
          </DialogHeader>
          <Form {...statusForm}>
            <form onSubmit={statusForm.handleSubmit(onStatusSubmit)} className="space-y-4">
              <FormField
                control={statusForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={statusForm.control}
                name="conversionValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Venda (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: 1500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStatusDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar lead */}
      <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do lead" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <FormControl>
                      <Input placeholder="Origem do lead" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações sobre o lead" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditMode(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}