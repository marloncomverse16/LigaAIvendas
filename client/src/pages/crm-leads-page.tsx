import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Phone, Calendar, Search, Users, CheckCircle, AlertCircle, Clock, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

type LeadFormData = z.infer<typeof leadFormSchema>;

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

  // Buscar estatísticas
  const { data: stats } = useQuery<CrmStats>({
    queryKey: ["/api/crm/stats"],
  });

  // Buscar leads com filtros
  const { data: leadsData, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", page, searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      
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

  // Mutation para criar lead
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
        title: "Lead criado com sucesso",
        description: "O lead foi adicionado ao sistema.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeadFormData) => {
    createMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const getStatIcon = (type: string) => {
    switch(type) {
      case 'total': return Users;
      case 'sendo_atendido_ia': return Clock;
      case 'finalizado_ia': return CheckCircle;
      case 'precisa_atendimento_humano': return AlertCircle;
      default: return User;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM de Leads</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe seus leads de forma eficiente
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Lead</DialogTitle>
              <DialogDescription>
                Adicione um novo lead ao sistema de CRM.
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
                          {Object.entries(statusLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
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
                        <Textarea 
                          placeholder="Observações sobre o lead" 
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
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Lead"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_leads || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sendo Atendidos pela IA</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sendo_atendido_ia || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados pela IA</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.finalizado_ia || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precisam Atenção Humana</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.precisa_atendimento_humano || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por telefone ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="text-center py-8">Carregando leads...</div>
          ) : leadsData?.leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {leadsData?.leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <h3 className="font-medium">{lead.name || 'Nome não informado'}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={statusColors[lead.status]}>
                            {statusLabels[lead.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.phoneNumber}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(lead.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedLead(lead)}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {leadsData && leadsData.pagination.totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="flex items-center px-4">
                Página {page} de {leadsData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= leadsData.pagination.totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Lead */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              Informações completas sobre o lead selecionado
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Nome</h4>
                  <p className="text-base">{selectedLead.name || 'Nome não informado'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Telefone</h4>
                  <p className="text-base">{selectedLead.phoneNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
                  <Badge className={statusColors[selectedLead.status]}>
                    {statusLabels[selectedLead.status]}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Origem</h4>
                  <p className="text-base">{selectedLead.source}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Data de Criação</h4>
                  <p className="text-base">{formatDate(selectedLead.createdAt)}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Última Atividade</h4>
                  <p className="text-base">{formatDate(selectedLead.lastActivityAt)}</p>
                </div>
              </div>

              {selectedLead.notes && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Observações</h4>
                  <p className="text-base bg-muted/50 p-3 rounded-md">{selectedLead.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Follow-ups</h4>
                  <p className="text-base">{selectedLead.followUpCount}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Convertido</h4>
                  <Badge variant={selectedLead.isConverted ? "default" : "secondary"}>
                    {selectedLead.isConverted ? "Sim" : "Não"}
                  </Badge>
                </div>
              </div>

              {selectedLead.isConverted && selectedLead.conversionValue && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Valor da Conversão</h4>
                  <p className="text-base">{selectedLead.conversionValue}</p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedLead(null)}>
                  Fechar
                </Button>
                <Button>
                  Editar Lead
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}