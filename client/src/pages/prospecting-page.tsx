import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Search, FilePlus2, Download, X, Edit, Trash2, CheckCircle2, AlarmClock, ArrowLeft, Upload, FileSpreadsheet, AlertCircle, FileType, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProspectingSearchSchema } from "@shared/schema";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ProspectingSearch = {
  id: number;
  userId: number;
  segment: string;
  city: string | null;
  filters: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  leadsFound: number;
  dispatchesDone: number;
  dispatchesPending: number;
  webhookUrl: string | null;
};

type ProspectingResult = {
  id: number;
  searchId: number;
  name: string | null;
  nome: string | null; // Alias para compatibilidade
  email: string | null;
  phone: string | null;
  telefone: string | null; // Alias para compatibilidade
  address: string | null;
  endereco: string | null; // Alias para compatibilidade
  type: string | null;
  tipo: string | null; // Alias para compatibilidade
  site: string | null;
  cidade: string | null;
  estado: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
};

const prospectingSearchSchema = insertProspectingSearchSchema.extend({
  segment: z.string().min(3, "Segmento é obrigatório e deve ter pelo menos 3 caracteres"),
  webhookUrl: z.string().url("URL deve ser válida").or(z.literal("")).nullable()
});

export default function ProspectingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSearch, setActiveSearch] = useState<number | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ProspectingResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>("searches");
  const [filterSegment, setFilterSegment] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [importMethod, setImportMethod] = useState<"form" | "import">("form");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para paginação dos resultados
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;
  
  // Estados para controle de progresso da busca
  const [isSearchInProgress, setIsSearchInProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Estados para filtros de prospectos
  const [prospectFilter, setProspectFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  
  // Estados para edição/exclusão
  const [editingProspect, setEditingProspect] = useState<ProspectingResult | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    type: "",
    site: "",
    cidade: "",
    estado: ""
  });

  // Query para buscar servidores do usuário
  const { data: userServers } = useQuery({
    queryKey: ["/api/user-servers", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/user-servers");
      if (!res.ok) throw new Error("Falha ao carregar servidores");
      return await res.json();
    },
    enabled: !!user?.id
  });

  // Query para buscar dados de prospecção
  const { data: searches, isLoading: isLoadingSearches } = useQuery({
    queryKey: ["/api/prospecting/searches", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/prospecting/searches");
      if (!res.ok) throw new Error("Falha ao carregar buscas de prospecção");
      const data = await res.json() as ProspectingSearch[];
      
      // Verificação de segurança silenciosa
      const validData = data.filter(search => search.userId === user?.id);
      if (validData.length !== data.length) {
        toast({
          title: "Dados filtrados por segurança",
          description: "Apenas seus dados foram carregados",
          variant: "destructive"
        });
      }
      
      return validData;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: false
  });

  // Query para buscar resultados de uma busca específica
  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ["/api/prospecting/results", activeSearch, user?.id],
    queryFn: async () => {
      if (!activeSearch) return [];
      const res = await fetch(`/api/prospecting/results/${activeSearch}`);
      if (!res.ok) throw new Error("Falha ao carregar resultados de prospecção");
      return await res.json() as ProspectingResult[];
    },
    enabled: !!activeSearch,
    onSuccess: () => {
      // Reset para primeira página quando trocar de busca
      setCurrentPage(1);
    }
  });

  // Obter o webhook de prospecção do servidor conectado
  const connectedServer = userServers?.find((server: any) => server.isDefault) || userServers?.[0];
  
  // Debug do servidor conectado
  console.log("Servidor conectado:", connectedServer);
  
  // Usar o webhook de prospecção configurado no servidor
  const prospectingWebhookUrl = connectedServer?.server?.prospectingWebhookUrl || 
                                "https://webhook.primerastreadores.com/webhook/prospeccao01";
                                
  console.log("Webhook de prospecção sendo usado:", prospectingWebhookUrl);

  // Form para criar nova busca
  const form = useForm<z.infer<typeof prospectingSearchSchema>>({
    resolver: zodResolver(prospectingSearchSchema),
    defaultValues: {
      segment: "",
      city: "",
      filters: "",
      webhookUrl: prospectingWebhookUrl
    }
  });

  // Atualizar o webhookUrl quando o servidor mudar
  useEffect(() => {
    if (prospectingWebhookUrl) {
      form.setValue("webhookUrl", prospectingWebhookUrl);
    }
  }, [prospectingWebhookUrl, form]);

  // Limpeza quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);



  // Mutação para criar nova busca
  const createSearchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof prospectingSearchSchema>) => {
      setIsSearchInProgress(true);
      setProgressMessage("Iniciando busca de prospecção...");
      
      const res = await apiRequest("POST", "/api/prospecting/searches", data);
      if (!res.ok) throw new Error("Falha ao criar busca");
      return await res.json();
    },
    onSuccess: (data) => {
      const searchId = data.id;
      setProgressMessage("Busca criada! Aguardando processamento...");
      
      // Limpar polling anterior se existir
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      // Iniciar polling para verificar o status da busca
      const checkSearchStatus = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/prospecting/searches/${searchId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            
            if (statusData.status === 'concluido') {
              clearInterval(checkSearchStatus);
              setPollingInterval(null);
              setIsSearchInProgress(false);
              setProgressMessage("");
              
              toast({
                title: "Busca concluída",
                description: `${statusData.leadsFound || 0} leads encontrados com sucesso`,
              });
              
              // Resetar formulário e voltar para a aba de buscas
              form.reset();
              setImportFile(null);
              setPreviewData([]);
              setImportError(null);
              setActiveTab("searches");
              queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches", user?.id] });
            } else if (statusData.status === 'em_andamento') {
              setProgressMessage(`Processando... ${statusData.leadsFound || 0} leads encontrados até agora`);
            } else if (statusData.status === 'erro') {
              clearInterval(checkSearchStatus);
              setPollingInterval(null);
              setIsSearchInProgress(false);
              setProgressMessage("");
              
              toast({
                title: "Erro na busca",
                description: "Ocorreu um erro durante o processamento. Verifique a lista de buscas.",
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error("Erro ao verificar status da busca:", error);
        }
      }, 3000); // Verificar a cada 3 segundos
      
      // Armazenar o intervalo para limpeza posterior
      setPollingInterval(checkSearchStatus);
      
      // Timeout de segurança para parar o polling após 10 minutos
      setTimeout(() => {
        clearInterval(checkSearchStatus);
        setPollingInterval(null);
        setIsSearchInProgress(false);
        setProgressMessage("");
        toast({
          title: "Timeout da busca",
          description: "A busca pode estar demorando mais que o esperado. Verifique a lista de buscas.",
          variant: "destructive",
        });
      }, 600000); // 10 minutos
    },
    onError: (error) => {
      setIsSearchInProgress(false);
      setProgressMessage("");
      toast({
        title: "Erro ao criar busca",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para importar arquivo CSV/Excel
  const importListMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setIsSearchInProgress(true);
      setProgressMessage("Iniciando importação de lista...");
      
      const res = await fetch("/api/prospecting/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Falha ao importar lista");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      setIsSearchInProgress(false);
      setProgressMessage("");
      
      toast({
        title: "Lista importada",
        description: `${data.leadsFound} leads importados com sucesso`,
      });
      setImportFile(null);
      setImportError(null);
      setImportMethod("form");
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches", user?.id] });
      setActiveTab("searches");
    },
    onError: (error) => {
      setIsSearchInProgress(false);
      setProgressMessage("");
      
      toast({
        title: "Erro ao importar lista",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para editar prospecto individual
  const editProspectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PUT", `/api/prospecting/results/${id}`, data);
      if (!res.ok) throw new Error("Falha ao editar prospecto");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prospecto atualizado",
        description: "As informações do prospecto foram atualizadas com sucesso",
      });
      setEditingProspect(null);
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/results", activeSearch] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao editar prospecto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para excluir prospecto individual
  const deleteProspectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/prospecting/results/${id}`);
      if (!res.ok) throw new Error("Falha ao excluir prospecto");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prospecto excluído",
        description: "O prospecto foi removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/results", activeSearch] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir prospecto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Função para processar o arquivo selecionado
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportError(null);
    
    if (!file) {
      setImportFile(null);
      return;
    }
    
    // Verificar o tipo de arquivo
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setImportError("Formato de arquivo inválido. Use CSV ou Excel.");
      setImportFile(null);
      return;
    }
    
    setImportFile(file);
  };

  // Função para importar a lista
  const handleImportSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!importFile) {
      setImportError("Selecione um arquivo para importar");
      return;
    }
    
    const segment = form.getValues("segment");
    const city = form.getValues("city");
    
    if (!segment) {
      setImportError("Preencha o campo Segmento");
      return;
    }
    
    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("segment", segment);
    if (city) formData.append("city", city);
    const webhookUrl = form.getValues("webhookUrl");
    if (webhookUrl) formData.append("webhookUrl", webhookUrl);
    
    importListMutation.mutate(formData);
  };

  // Mutação para excluir busca
  const deleteSearchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/prospecting/searches/${id}`);
      if (!res.ok) throw new Error("Falha ao excluir busca");
      return id;
    },
    onSuccess: (id) => {
      toast({
        title: "Busca excluída",
        description: "A busca foi excluída com sucesso",
      });
      if (activeSearch === id) {
        setActiveSearch(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches", user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir busca",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para disparar leads
  const dispatchLeadsMutation = useMutation({
    mutationFn: async (searchId: number) => {
      // Usar o webhook de prospecção do servidor conectado
      if (!prospectingWebhookUrl) {
        throw new Error("Webhook de prospecção não configurado no servidor conectado");
      }
      
      // Buscar a pesquisa e os resultados
      const search = searches?.find(s => s.id === searchId);
      if (!search) {
        throw new Error("Busca não encontrada");
      }
      
      // Verificar se há resultados pendentes
      if (search.dispatchesPending <= 0) {
        throw new Error("Não há resultados pendentes para disparar");
      }
      
      // Enviar requisição para o webhook de prospecção do servidor
      const res = await fetch(prospectingWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchId: searchId,
          segment: search.segment,
          city: search.city,
          userId: user?.id,
          count: search.dispatchesPending,
          callbackUrl: `${window.location.origin}/api/prospecting/webhook-callback/${user?.id}`
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Erro ao disparar: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: (data, searchId) => {
      toast({
        title: "Disparos iniciados",
        description: "Os leads foram enviados para processamento",
      });
      
      // Atualizar o status da busca
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/results", searchId, user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao disparar leads",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Função para disparar leads
  const handleDispatchLeads = (searchId: number) => {
    if (confirm("Tem certeza que deseja disparar os leads pendentes?")) {
      dispatchLeadsMutation.mutate(searchId);
    }
  };



  // Função para exportar resultados para CSV
  const exportToCSV = (searchId: number) => {
    if (!results || results.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há resultados disponíveis para exportação",
        variant: "destructive",
      });
      return;
    }

    // Preparar dados CSV
    const headers = "Nome,Email,Telefone,Endereço,Tipo,Data de Criação\n";
    const csvData = results.map(result => {
      return `"${result.name || ''}","${result.email || ''}","${result.phone || ''}","${result.address || ''}","${result.type || ''}","${result.createdAt ? format(new Date(result.createdAt), 'dd/MM/yyyy HH:mm') : ''}"`
    }).join("\n");

    // Criar e baixar o arquivo
    const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `prospecção_${searchId}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubmit = (data: z.infer<typeof prospectingSearchSchema>) => {
    createSearchMutation.mutate(data);
    // Após enviar o formulário, vamos para a aba de buscas
    setActiveTab("searches");
  };

  // Aplicar filtros aos resultados
  const applyFilters = (data: ProspectingResult[]) => {
    if (!data) return [];
    
    return data.filter(result => {
      const matchesName = !prospectFilter || 
        (result.name?.toLowerCase().includes(prospectFilter.toLowerCase()) || 
         result.nome?.toLowerCase().includes(prospectFilter.toLowerCase()) ||
         result.email?.toLowerCase().includes(prospectFilter.toLowerCase()) ||
         result.phone?.includes(prospectFilter) ||
         result.telefone?.includes(prospectFilter));
      
      const matchesCity = !cityFilter || 
        (result.cidade?.toLowerCase().includes(cityFilter.toLowerCase()));
      
      const matchesType = !typeFilter || 
        (result.type?.toLowerCase().includes(typeFilter.toLowerCase()) ||
         result.tipo?.toLowerCase().includes(typeFilter.toLowerCase()));
      
      return matchesName && matchesCity && matchesType;
    });
  };

  // Aplicar filtros e calcular dados paginados
  const filteredResults = applyFilters(results || []);
  const totalResults = filteredResults.length;
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  // Funções de navegação da paginação
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Função para inicializar edição de prospecto
  const startEditProspect = (prospect: ProspectingResult) => {
    setEditingProspect(prospect);
    setEditForm({
      name: prospect.name || prospect.nome || "",
      email: prospect.email || "",
      phone: prospect.phone || prospect.telefone || "",
      address: prospect.address || prospect.endereco || "",
      type: prospect.type || prospect.tipo || "",
      site: prospect.site || "",
      cidade: prospect.cidade || "",
      estado: prospect.estado || ""
    });
  };

  // Função para salvar edição
  const saveEditProspect = () => {
    if (!editingProspect) return;
    
    editProspectMutation.mutate({ 
      id: editingProspect.id, 
      data: editForm 
    });
  };

  // Função para cancelar edição
  const cancelEditProspect = () => {
    setEditingProspect(null);
    setEditForm({
      name: "",
      email: "",
      phone: "",
      address: "",
      type: "",
      site: "",
      cidade: "",
      estado: ""
    });
  };

  // Função para excluir prospecto
  const deleteProspect = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir este prospecto?")) {
      deleteProspectMutation.mutate(id);
    }
  };

  // Reset filtros e paginação quando mudar de busca
  useEffect(() => {
    setProspectFilter("");
    setCityFilter("");
    setTypeFilter("");
    setCurrentPage(1);
  }, [activeSearch]);

  // Renderizar status da busca com badge
  const renderStatus = (status: string) => {
    if (status === 'pendente') {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlarmClock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    } else if (status === 'em_andamento') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Em andamento</Badge>;
    } else if (status === 'concluido') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluído</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <Search className="h-8 w-8 text-primary" /> Prospecção
          </h1>
          <p className="text-muted-foreground">
            Encontre e gerencie leads para sua empresa com base em segmentos e localidades
          </p>
        </div>

        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardContent className="p-0">
            <Tabs defaultValue="searches" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full rounded-none border-b justify-center p-0">
                <TabsTrigger value="searches" className="flex-1 rounded-none py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Search className="h-4 w-4 mr-2" />
                  Buscas e Resultados
                </TabsTrigger>
                <TabsTrigger value="new" className="flex-1 rounded-none py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <FilePlus2 className="h-4 w-4 mr-2" />
                  Nova Busca
                </TabsTrigger>
              </TabsList>

              {/* Tab de listagem de buscas */}
              <TabsContent value="searches" className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <Card className="shadow-md">
                      <CardHeader>
                        <CardTitle>Minhas Buscas</CardTitle>
                        <CardDescription>Selecione para ver os resultados</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        {/* Filtros */}
                        <div className="p-4 border-b">
                          <div className="mb-2">
                            <Input 
                              placeholder="Filtrar por segmento" 
                              value={filterSegment}
                              onChange={(e) => setFilterSegment(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          <div className="mb-2">
                            <Input 
                              placeholder="Filtrar por cidade" 
                              value={filterCity}
                              onChange={(e) => setFilterCity(e.target.value)}
                              className="mb-2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={filterPeriod}
                              onValueChange={setFilterPeriod}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Período" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="hoje">Hoje</SelectItem>
                                <SelectItem value="semana">Esta semana</SelectItem>
                                <SelectItem value="mes">Este mês</SelectItem>
                                <SelectItem value="ano">Este ano</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={filterStatus}
                              onValueChange={setFilterStatus}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="em_andamento">Em andamento</SelectItem>
                                <SelectItem value="concluido">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <ScrollArea className="h-[400px]">
                          {isLoadingSearches ? (
                            <div className="flex items-center justify-center p-6">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                          ) : searches && searches.length > 0 ? (
                            <div className="divide-y">
                              {searches
                                .filter(search => {
                                  // Filtro por segmento
                                  if (filterSegment && !search.segment.toLowerCase().includes(filterSegment.toLowerCase())) {
                                    return false;
                                  }
                                  
                                  // Filtro por cidade
                                  if (filterCity && search.city && !search.city.toLowerCase().includes(filterCity.toLowerCase())) {
                                    return false;
                                  }
                                  
                                  // Filtro por período
                                  if (filterPeriod !== 'todos') {
                                    const searchDate = new Date(search.createdAt);
                                    const today = new Date();
                                    
                                    if (filterPeriod === 'hoje') {
                                      return searchDate.toDateString() === today.toDateString();
                                    } else if (filterPeriod === 'semana') {
                                      const startOfWeek = new Date(today);
                                      startOfWeek.setDate(today.getDate() - today.getDay());
                                      return searchDate >= startOfWeek;
                                    } else if (filterPeriod === 'mes') {
                                      return searchDate.getMonth() === today.getMonth() && 
                                            searchDate.getFullYear() === today.getFullYear();
                                    } else if (filterPeriod === 'ano') {
                                      return searchDate.getFullYear() === today.getFullYear();
                                    }
                                  }
                                  
                                  // Filtro por status
                                  if (filterStatus !== 'todos' && search.status !== filterStatus) {
                                    return false;
                                  }
                                  
                                  return true;
                                })
                                .map((search) => (
                                <div 
                                  key={search.id}
                                  className={`p-4 cursor-pointer hover:bg-accent ${activeSearch === search.id ? 'bg-accent' : ''}`}
                                  onClick={() => setActiveSearch(search.id)}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-medium">{search.segment}</h3>
                                    {renderStatus(search.status)}
                                  </div>
                                  <div className="text-sm text-muted-foreground mb-1">
                                    {search.city && <span>{search.city} • </span>}
                                    {search.createdAt && (
                                      <span>{format(new Date(search.createdAt), "dd MMM yyyy", { locale: ptBR })}</span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                      {search.leadsFound} encontrados
                                    </span>
                                    {search.dispatchesDone > 0 && (
                                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                        {search.dispatchesDone} enviados
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center">
                              <p className="text-muted-foreground">Nenhuma busca encontrada</p>
                              <Button 
                                variant="link" 
                                className="mt-2" 
                                onClick={() => setActiveTab("new")}
                              >
                                Criar nova busca
                              </Button>
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="md:col-span-2">
                    {activeSearch && searches ? (
                      <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                          <div>
                            <CardTitle>
                              {searches.find(s => s.id === activeSearch)?.segment}
                            </CardTitle>
                            <CardDescription>
                              {searches.find(s => s.id === activeSearch)?.city || "Todas as cidades"} • 
                              Criado em {format(
                                new Date(searches.find(s => s.id === activeSearch)?.createdAt || new Date()), 
                                "dd 'de' MMMM 'de' yyyy", 
                                { locale: ptBR }
                              )}
                              {searches.find(s => s.id === activeSearch)?.filters && (
                                <>
                                  <div className="mt-2 pt-2 border-t">
                                    <span className="font-semibold">Filtros adicionais:</span> 
                                    <span className="text-sm">{searches.find(s => s.id === activeSearch)?.filters}</span>
                                  </div>
                                </>
                              )}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">

                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => {
                                if (confirm("Tem certeza que deseja excluir esta busca?")) {
                                  deleteSearchMutation.mutate(activeSearch);
                                }
                              }}
                              disabled={deleteSearchMutation.isPending}
                            >
                              {deleteSearchMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4 grid grid-cols-3 gap-4">
                            <div className="bg-primary/5 p-3 rounded-lg">
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Leads Encontrados</h4>
                              <p className="text-xl font-bold">{searches.find(s => s.id === activeSearch)?.leadsFound || 0}</p>
                            </div>
                            <div className="bg-primary/5 p-3 rounded-lg">
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Já Enviados</h4>
                              <p className="text-xl font-bold">{searches.find(s => s.id === activeSearch)?.dispatchesDone || 0}</p>
                            </div>
                            <div className="bg-primary/5 p-3 rounded-lg">
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Pendentes</h4>
                              <p className="text-xl font-bold">{searches.find(s => s.id === activeSearch)?.dispatchesPending || 0}</p>
                            </div>
                          </div>

                          {/* Filtros dos Prospectos */}
                          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="prospect-filter">Buscar por nome, telefone ou email</Label>
                              <Input
                                id="prospect-filter"
                                placeholder="Digite para filtrar..."
                                value={prospectFilter}
                                onChange={(e) => {
                                  setProspectFilter(e.target.value);
                                  setCurrentPage(1); // Reset para primeira página
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="city-filter">Filtrar por cidade</Label>
                              <Input
                                id="city-filter"
                                placeholder="Cidade..."
                                value={cityFilter}
                                onChange={(e) => {
                                  setCityFilter(e.target.value);
                                  setCurrentPage(1);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="type-filter">Filtrar por tipo</Label>
                              <Input
                                id="type-filter"
                                placeholder="Tipo de negócio..."
                                value={typeFilter}
                                onChange={(e) => {
                                  setTypeFilter(e.target.value);
                                  setCurrentPage(1);
                                }}
                              />
                            </div>
                          </div>

                          <div className="rounded-md border overflow-auto">
                            <ScrollArea className="h-[500px] w-full">
                              <div className="min-w-[1000px]">
                                <Table>
                                  <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                      <TableHead className="w-[200px]">NOME</TableHead>
                                      <TableHead className="w-[150px]">TELEFONE</TableHead>
                                      <TableHead className="w-[200px]">EMAIL</TableHead>
                                      <TableHead className="w-[250px]">ENDEREÇO</TableHead>
                                      <TableHead className="w-[150px]">SITE</TableHead>
                                      <TableHead className="w-[100px] text-center">AÇÕES</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                <TableBody>
                                  {isLoadingResults ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                      </TableCell>
                                    </TableRow>
                                  ) : paginatedResults && paginatedResults.length > 0 ? (
                                    paginatedResults.map((result) => (
                                      <TableRow 
                                        key={result.id}
                                        className="hover:bg-accent"
                                      >
                                        <TableCell 
                                          className="font-medium cursor-pointer"
                                          onClick={() => {
                                            setSelectedResult(result);
                                            setShowResultDialog(true);
                                          }}
                                        >
                                          {result.name || '-'}
                                        </TableCell>
                                        <TableCell 
                                          className="cursor-pointer"
                                          onClick={() => {
                                            setSelectedResult(result);
                                            setShowResultDialog(true);
                                          }}
                                        >
                                          {result.phone || '-'}
                                        </TableCell>
                                        <TableCell 
                                          className="cursor-pointer"
                                          onClick={() => {
                                            setSelectedResult(result);
                                            setShowResultDialog(true);
                                          }}
                                        >
                                          {result.email || '-'}
                                        </TableCell>
                                        <TableCell 
                                          className="max-w-[200px] truncate cursor-pointer"
                                          onClick={() => {
                                            setSelectedResult(result);
                                            setShowResultDialog(true);
                                          }}
                                        >
                                          {result.address || '-'}
                                        </TableCell>
                                        <TableCell 
                                          className="cursor-pointer"
                                          onClick={() => {
                                            setSelectedResult(result);
                                            setShowResultDialog(true);
                                          }}
                                        >
                                          {result.site || '-'}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                startEditProspect(result);
                                              }}
                                              title="Editar prospecto"
                                            >
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteProspect(result.id);
                                              }}
                                              title="Excluir prospecto"
                                              disabled={deleteProspectMutation.isPending}
                                            >
                                              {deleteProspectMutation.isPending ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  ) : (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-24 text-center">
                                        {prospectFilter || cityFilter || typeFilter 
                                          ? "Nenhum resultado encontrado com os filtros aplicados" 
                                          : "Nenhum resultado encontrado para esta busca"
                                        }
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                                </Table>
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Controles de Paginação */}
                          {results && results.length > 0 && (
                            <div className="mt-4 flex items-center justify-between px-2">
                              <div className="text-sm text-muted-foreground">
                                Mostrando {startIndex + 1} a {Math.min(endIndex, totalResults)} de {totalResults} resultados
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={goToPreviousPage}
                                  disabled={currentPage === 1}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                  Anterior
                                </Button>
                                
                                <div className="flex items-center space-x-1">
                                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    let pageNumber;
                                    if (totalPages <= 5) {
                                      pageNumber = i + 1;
                                    } else if (currentPage <= 3) {
                                      pageNumber = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                      pageNumber = totalPages - 4 + i;
                                    } else {
                                      pageNumber = currentPage - 2 + i;
                                    }
                                    
                                    if (pageNumber < 1 || pageNumber > totalPages) return null;
                                    
                                    return (
                                      <Button
                                        key={pageNumber}
                                        variant={pageNumber === currentPage ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => goToPage(pageNumber)}
                                        className="w-8 h-8 p-0"
                                      >
                                        {pageNumber}
                                      </Button>
                                    );
                                  }).filter(Boolean)}
                                </div>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={goToNextPage}
                                  disabled={currentPage === totalPages}
                                >
                                  Próxima
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="shadow-md">
                        <CardContent className="flex flex-col items-center justify-center p-6 h-[400px]">
                          <Search className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-xl font-medium mb-2">Selecione uma busca</h3>
                          <p className="text-muted-foreground text-center max-w-md">
                            Escolha uma busca na lista ao lado para visualizar seus resultados ou crie uma nova busca de prospecção.
                          </p>
                          <Button 
                            className="mt-6 bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold" 
                            onClick={() => setActiveTab("new")}
                          >
                            <FilePlus2 className="h-4 w-4 mr-2" />
                            Criar Nova Busca
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab de nova busca */}
              <TabsContent value="new" className="p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="flex flex-col md:flex-row mb-8 bg-primary/5 rounded-lg p-6 gap-6">
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <Search className="h-16 w-16 text-primary/60" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Como funciona a prospecção?</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start">
                          <span className="text-primary mr-2 mt-0.5">✓</span> 
                          <span>Defina um segmento específico para encontrar empresas e profissionais relevantes</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2 mt-0.5">✓</span> 
                          <span>Adicione filtros como localização, porte da empresa ou critérios específicos</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2 mt-0.5">✓</span> 
                          <span>Nossa automação irá buscar leads qualificados e entregar os resultados em até 24h</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2 mt-0.5">✓</span> 
                          <span>Adicione um webhook para receber os dados diretamente em outras ferramentas</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <Card className="shadow-md border">
                    <CardHeader>
                      <CardTitle className="text-center">Nova Busca de Prospecção</CardTitle>
                      <CardDescription className="text-center">
                        Configure os parâmetros para encontrar leads qualificados
                      </CardDescription>
                      <div className="flex justify-center mt-4">
                        <div className="inline-flex items-center rounded-md bg-muted p-1 text-muted-foreground">
                          <button
                            type="button"
                            className={`${
                              importMethod === "form" 
                                ? "bg-background text-foreground" 
                                : ""
                            } rounded-sm px-3 py-1.5 text-sm font-medium transition-all`}
                            onClick={() => setImportMethod("form")}
                          >
                            Formulário Manual
                          </button>
                          <button
                            type="button" 
                            className={`${
                              importMethod === "import" 
                                ? "bg-background text-foreground" 
                                : ""
                            } rounded-sm px-3 py-1.5 text-sm font-medium transition-all`}
                            onClick={() => setImportMethod("import")}
                          >
                            Importar Lista
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {importMethod === "form" ? (
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <div className="grid grid-cols-1 gap-6">
                            <FormField
                              control={form.control}
                              name="segment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Segmento *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: Restaurantes, Médicos, Advocacia" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    Informe o segmento ou nicho de mercado para a prospecção
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
          
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Cidade</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Ex: São Paulo, Rio de Janeiro" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormDescription>
                                      Opcional. Deixe em branco para todo o país
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
          
                              {/* Webhook URL é obtido automaticamente do perfil do usuário */}
                              <input type="hidden" {...form.register("webhookUrl")} />
                            </div>
          
                            <FormField
                              control={form.control}
                              name="filters"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Filtros adicionais</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Ex: +50 funcionários, faturamento anual > 1M, fundada após 2010" 
                                      className="min-h-[120px]"
                                      rows={4}
                                      {...field}
                                      value={field.value || ""} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Opcional. Adicione critérios específicos para refinar sua busca
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
          
                          {/* Interface de Progresso */}
                          {isSearchInProgress && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                              <div className="flex items-center justify-center mb-2">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                                <span className="text-blue-700 font-medium">Processando busca de prospecção</span>
                              </div>
                              <p className="text-sm text-blue-600">{progressMessage}</p>
                              <p className="text-xs text-blue-500 mt-1">Esta operação pode demorar alguns minutos...</p>
                            </div>
                          )}
          
                          <div className="flex justify-center pt-4">
                            <div className="flex flex-col md:flex-row gap-4 w-full md:w-3/4 mx-auto">
                              <Button 
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => setActiveTab("searches")}
                              >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar para Buscas
                              </Button>
                              
                              <Button 
                                type="submit" 
                                disabled={createSearchMutation.isPending || isSearchInProgress}
                                className="w-full bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                                size="lg"
                              >
                                {createSearchMutation.isPending || isSearchInProgress ? (
                                  <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processando...
                                  </>
                                ) : (
                                  <>Iniciar Busca de Prospecção</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </form>
                      </Form>
                      ) : (
                        <div className="space-y-6">
                          <form onSubmit={handleImportSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                              <div>
                                <Label htmlFor="segment">Segmento *</Label>
                                <Input 
                                  id="segment" 
                                  placeholder="Ex: Restaurantes, Médicos, Advocacia" 
                                  className="mt-1.5"
                                  value={form.watch("segment") || ""}
                                  onChange={(e) => form.setValue("segment", e.target.value)}
                                  required
                                />
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  Informe o segmento ou nicho de mercado para a prospecção
                                </p>
                              </div>
                              
                              <div>
                                <Label htmlFor="city">Cidade</Label>
                                <Input 
                                  id="city" 
                                  placeholder="Ex: São Paulo, Rio de Janeiro" 
                                  className="mt-1.5"
                                  value={form.watch("city") || ""}
                                  onChange={(e) => form.setValue("city", e.target.value)}
                                />
                                <p className="text-sm text-muted-foreground mt-1.5">
                                  Opcional. Deixe em branco para todo o país
                                </p>
                              </div>
                              
                              <div className="mt-2 space-y-3">
                                <Label htmlFor="file">Arquivo de Leads (CSV ou Excel)</Label>
                                
                                <div className="flex items-center justify-center w-full">
                                  <label
                                    htmlFor="dropzone-file"
                                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 border-muted-foreground/25 hover:bg-muted/40"
                                  >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      {importFile ? (
                                        <>
                                          <FileSpreadsheet className="w-10 h-10 mb-3 text-primary" />
                                          <p className="mb-2 text-sm text-foreground"><span className="font-semibold">{importFile.name}</span></p>
                                          <p className="text-xs text-muted-foreground">{Math.round(importFile.size / 1024)} KB • Clique para trocar</p>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                          <p className="mb-2 text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                                          <p className="text-xs text-muted-foreground">PDF ou CSV (máx. 10MB)</p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Formato: colunas com nome, email, telefone ou qualquer dados de contato
                                          </p>
                                          <p className="text-xs text-primary/70 mt-1">
                                            O sistema detecta automaticamente as colunas
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    <input
                                      id="dropzone-file"
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.csv"
                                      onChange={handleFileChange}
                                      ref={fileInputRef}
                                    />
                                  </label>
                                </div>
                                
                                {importError && (
                                  <Alert variant="destructive" className="mt-3">
                                    <AlertCircle className="h-4 w-4" />
                                    <div className="ml-2">
                                      <p className="font-medium">{importError}</p>
                                      <p className="text-xs mt-1">
                                        Dica: O sistema detectará automaticamente as colunas com nomes como 
                                        "nome", "name", "email", "telefone", "phone", etc. Mesmo se não puder  
                                        identificar automaticamente, tentaremos usar as primeiras colunas.
                                      </p>
                                    </div>
                                  </Alert>
                                )}
                                

                              </div>
                            </div>
                            
                            <div className="flex flex-col space-y-2">
                              <Alert className="bg-muted mb-4">
                                <FileType className="h-4 w-4" />
                                <AlertTitle>Formato do arquivo</AlertTitle>
                                <AlertDescription>
                                  <p className="mb-2">O arquivo deve estar no formato PDF ou CSV com as seguintes colunas:</p>
                                  <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li><strong>nome/name</strong>: Nome da empresa ou contato</li>
                                    <li><strong>email</strong>: Endereço de email</li>
                                    <li><strong>telefone/phone</strong>: Número de telefone com DDD</li>
                                    <li><strong>endereco/address</strong>: Endereço completo (opcional)</li>
                                    <li><strong>cidade/city</strong>: Cidade (opcional)</li>
                                    <li><strong>estado/state</strong>: Estado/UF (opcional)</li>
                                    <li><strong>site</strong>: Site ou URL (opcional)</li>
                                    <li><strong>tipo/type</strong>: Categoria ou tipo do lead (opcional)</li>
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            </div>

                            {/* Interface de Progresso para Importação */}
                            {isSearchInProgress && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                <div className="flex items-center justify-center mb-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                                  <span className="text-blue-700 font-medium">Processando importação</span>
                                </div>
                                <p className="text-sm text-blue-600">{progressMessage}</p>
                                <p className="text-xs text-blue-500 mt-1">Esta operação pode demorar alguns minutos...</p>
                              </div>
                            )}

                            <div className="flex justify-center pt-4">
                              <div className="flex flex-col md:flex-row gap-4 w-full md:w-3/4 mx-auto">
                                <Button 
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => {
                                    setImportMethod("form");
                                    setImportError(null);
                                    setImportFile(null);
                                  }}
                                >
                                  <ArrowLeft className="mr-2 h-4 w-4" />
                                  Voltar para Formulário
                                </Button>
                                
                                <Button 
                                  type="submit" 
                                  disabled={importListMutation.isPending || isSearchInProgress || !importFile}
                                  className="w-full bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                                  size="lg"
                                >
                                  {importListMutation.isPending || isSearchInProgress ? (
                                    <>
                                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                      Importando...
                                    </>
                                  ) : (
                                    <>
                                      <FileSpreadsheet className="mr-2 h-5 w-5" />
                                      Importar Lista
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground border-t py-4">
                      <p>Após iniciar a busca, o processamento pode levar até 24 horas.</p>
                      <p>Você será notificado quando os resultados estiverem disponíveis.</p>
                    </CardFooter>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para visualizar resultado */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              Informações completas do lead encontrado
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Nome</h3>
                <p className="text-lg">{selectedResult.name || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                <p className="text-lg">{selectedResult.email || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Site</h3>
                <p className="text-lg">{selectedResult.site || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Telefone</h3>
                <p className="text-lg">{selectedResult.phone || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
                <p className="text-lg">{selectedResult.address || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Cidade/Estado</h3>
                <p className="text-lg">
                  {selectedResult.cidade ? (
                    `${selectedResult.cidade}${selectedResult.estado ? ` - ${selectedResult.estado}` : ''}`
                  ) : (
                    "Não informado"
                  )}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Tipo</h3>
                <p className="text-lg">{selectedResult.type || "Não informado"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Data de Criação</h3>
                <p className="text-lg">
                  {selectedResult.createdAt ? format(new Date(selectedResult.createdAt), "dd/MM/yyyy HH:mm") : "Não informado"}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <div className="mt-1">
                  {selectedResult.dispatchedAt ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Enviado em {format(new Date(selectedResult.dispatchedAt), "dd/MM/yyyy HH:mm")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                      Pendente de envio
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-end">
            <Button variant="secondary" onClick={() => setShowResultDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Prospecto */}
      <Dialog open={editingProspect !== null} onOpenChange={(open) => !open && cancelEditProspect()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Prospecto</DialogTitle>
            <DialogDescription>
              Altere as informações do prospecto conforme necessário
            </DialogDescription>
          </DialogHeader>
          
          {editingProspect && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nome da empresa ou pessoa"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Telefone de contato"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="Email de contato"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-type">Tipo</Label>
                <Input
                  id="edit-type"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  placeholder="Tipo de negócio"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-cidade">Cidade</Label>
                <Input
                  id="edit-cidade"
                  value={editForm.cidade}
                  onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-estado">Estado</Label>
                <Input
                  id="edit-estado"
                  value={editForm.estado}
                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                  placeholder="Estado"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-address">Endereço</Label>
                <Textarea
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Endereço completo"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-site">Site</Label>
                <Input
                  id="edit-site"
                  value={editForm.site}
                  onChange={(e) => setEditForm({ ...editForm, site: e.target.value })}
                  placeholder="Website ou URL"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={cancelEditProspect}
              disabled={editProspectMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveEditProspect}
              disabled={editProspectMutation.isPending}
            >
              {editProspectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}