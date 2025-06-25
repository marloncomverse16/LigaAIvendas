import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  UserCheck,
  Phone,
  Mail,
  Building,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Tipos
interface CrmLead {
  id: number;
  userId: number;
  phoneNumber: string;
  name?: string;
  email?: string;
  company?: string;
  status: 'sendo_atendido_ia' | 'finalizado_ia' | 'precisa_atendimento_humano' | 'transferido_humano' | 'finalizado_humano' | 'abandonado';
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
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

// Esquema de validação para criar/editar lead
const leadFormSchema = z.object({
  phoneNumber: z.string().min(1, "Telefone é obrigatório"),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  status: z.enum(['sendo_atendido_ia', 'finalizado_ia', 'precisa_atendimento_humano', 'transferido_humano', 'finalizado_humano', 'abandonado']).optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  source: z.string().min(1, "Origem é obrigatória"),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

// Mapear status para labels em português
const statusLabels = {
  'sendo_atendido_ia': 'Sendo Atendido pela IA',
  'finalizado_ia': 'Finalizada pela IA',
  'precisa_atendimento_humano': 'Precisa de Atendimento Humano',
  'transferido_humano': 'Transferido para Humano',
  'finalizado_humano': 'Finalizado por Humano',
  'abandonado': 'Abandonado'
};

const priorityLabels = {
  'baixa': 'Baixa',
  'media': 'Média',
  'alta': 'Alta',
  'urgente': 'Urgente'
};

const statusColors = {
  'sendo_atendido_ia': 'bg-blue-100 text-blue-800',
  'finalizado_ia': 'bg-green-100 text-green-800',
  'precisa_atendimento_humano': 'bg-orange-100 text-orange-800',
  'transferido_humano': 'bg-purple-100 text-purple-800',
  'finalizado_humano': 'bg-emerald-100 text-emerald-800',
  'abandonado': 'bg-gray-100 text-gray-800'
};

const priorityColors = {
  'baixa': 'bg-gray-100 text-gray-800',
  'media': 'bg-yellow-100 text-yellow-800',
  'alta': 'bg-orange-100 text-orange-800',
  'urgente': 'bg-red-100 text-red-800'
};

export default function CrmLeadsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);

  // Buscar estatísticas
  const { data: stats } = useQuery<CrmStats>({
    queryKey: ["/api/crm/stats"],
  });

  // Buscar leads com filtros
  const { data: leadsData, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", page, searchTerm, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter && priorityFilter !== "all") params.append("priority", priorityFilter);
      
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
      email: "",
      company: "",
      status: "sendo_atendido_ia",
      priority: "media",
      source: "manual",
      notes: "",
    },
  });

  // Mutation para criar lead
  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await apiRequest("POST", "/api/crm/leads", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead criado",
        description: "Lead criado com sucesso no sistema.",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para transferir para humano
  const transferToHumanMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await apiRequest("POST", `/api/crm/leads/${leadId}/transfer-human`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead transferido",
        description: "Lead transferido para atendimento humano com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeadFormData) => {
    createLeadMutation.mutate(data);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM de Leads</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e acompanhe o atendimento em cada estágio
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Lead</DialogTitle>
              <DialogDescription>
                Adicione um novo lead ao sistema CRM
              </DialogDescription>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar status" />
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
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar prioridade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(priorityLabels).map(([value, label]) => (
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
                </div>

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar origem" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="prospecting">Prospecção</SelectItem>
                          <SelectItem value="chat">Chat</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                        </SelectContent>
                      </Select>
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
                  <Button type="submit" disabled={createLeadMutation.isPending}>
                    {createLeadMutation.isPending ? "Criando..." : "Criar Lead"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <CardTitle className="text-sm font-medium">Sendo Atendido IA</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.sendo_atendido_ia}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finalizado IA</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.finalizado_ia}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Precisa Atendimento</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.precisa_atendimento_humano}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
              <UserCheck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.converted_leads}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por telefone, nome, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
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

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter || priorityFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setPriorityFilter("");
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>
            {leadsData?.pagination.total || 0} leads encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Carregando leads...</p>
            </div>
          ) : leadsData?.leads.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum lead encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leadsData?.leads.map((lead) => (
                <div
                  key={lead.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">
                            {lead.name || lead.phoneNumber}
                          </h3>
                          <Badge className={statusColors[lead.status]}>
                            {statusLabels[lead.status]}
                          </Badge>
                          <Badge className={priorityColors[lead.priority]}>
                            {priorityLabels[lead.priority]}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.phoneNumber}</span>
                          </div>
                          {lead.email && (
                            <div className="flex items-center space-x-1">
                              <Mail className="h-3 w-3" />
                              <span>{lead.email}</span>
                            </div>
                          )}
                          {lead.company && (
                            <div className="flex items-center space-x-1">
                              <Building className="h-3 w-3" />
                              <span>{lead.company}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(lead.lastActivityAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {lead.status === 'precisa_atendimento_humano' && (
                        <Button
                          size="sm"
                          onClick={() => transferToHumanMutation.mutate(lead.id)}
                          disabled={transferToHumanMutation.isPending}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Transferir
                        </Button>
                      )}
                      
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>

                  {lead.notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <strong>Observações:</strong> {lead.notes}
                    </div>
                  )}

                  {lead.aiNotes && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <strong>Notas da IA:</strong> {lead.aiNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {leadsData && leadsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Página {leadsData.pagination.page} de {leadsData.pagination.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === leadsData.pagination.totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}