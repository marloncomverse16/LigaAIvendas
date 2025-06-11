import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Search, FilePlus2, Download, X, Edit, Trash2, CheckCircle2, AlarmClock, ArrowLeft, Upload, FileSpreadsheet, AlertCircle, FileType } from "lucide-react";
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

  // Query para buscar dados de prospecção - VERSÃO SEGURA ESTÁVEL
  const { data: searches, isLoading: isLoadingSearches } = useQuery({
    queryKey: ["/api/prospecting/searches", user?.id], // Usar ID do usuário como chave
    queryFn: async () => {
      console.log(`🔍 Frontend: Buscando pesquisas para usuário ${user?.id} (${user?.username})`);
      const res = await fetch("/api/prospecting/searches", {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error("Falha ao carregar buscas de prospecção");
      const data = await res.json() as ProspectingSearch[];
      
      // Verificação de segurança no frontend
      const invalidSearches = data.filter(search => search.userId !== user?.id);
      if (invalidSearches.length > 0) {
        console.error(`🚨 Frontend: ${invalidSearches.length} pesquisas de outros usuários detectadas:`, invalidSearches);
        toast({
          title: "Erro de segurança detectado",
          description: "Dados de outros usuários foram bloqueados",
          variant: "destructive"
        });
        return data.filter(search => search.userId === user?.id);
      }
      
      console.log(`✅ Frontend: ${data.length} pesquisas válidas carregadas`);
      return data;
    },
    enabled: !!user?.id // Só executar quando o usuário estiver logado
  });

  // Query para buscar resultados de uma busca específica
  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: ["/api/prospecting/results", activeSearch],
    queryFn: async () => {
      if (!activeSearch) return [];
      const res = await fetch(`/api/prospecting/results/${activeSearch}`);
      if (!res.ok) throw new Error("Falha ao carregar resultados de prospecção");
      return await res.json() as ProspectingResult[];
    },
    enabled: !!activeSearch
  });

  // Form para criar nova busca
  const form = useForm<z.infer<typeof prospectingSearchSchema>>({
    resolver: zodResolver(prospectingSearchSchema),
    defaultValues: {
      segment: "",
      city: "",
      filters: "",
      webhookUrl: user?.prospectingWebhookUrl || ""
    }
  });



  // Mutação para criar nova busca
  const createSearchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof prospectingSearchSchema>) => {
      const res = await apiRequest("POST", "/api/prospecting/searches", data);
      if (!res.ok) throw new Error("Falha ao criar busca");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Busca criada",
        description: "Sua busca de prospecção foi criada com sucesso",
      });
      form.reset();
      setImportFile(null);
      setPreviewData([]);
      setImportError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches"] });
    },
    onError: (error) => {
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
      toast({
        title: "Lista importada",
        description: `${data.leadsFound} leads importados com sucesso`,
      });
      setImportFile(null);
      setImportError(null);
      setImportMethod("form");
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches"] });
      setActiveTab("searches");
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar lista",
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
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches"] });
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
      if (!user?.dispatchesWebhookUrl) {
        throw new Error("URL de webhook de disparos não configurada");
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
      
      // Enviar requisição para o webhook configurado
      const res = await fetch(user.dispatchesWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchId: searchId,
          segment: search.segment,
          city: search.city,
          userId: user.id,
          count: search.dispatchesPending,
          callbackUrl: `${window.location.origin}/api/prospecting/webhook-callback/${user.id}`
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
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/searches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/results", searchId] });
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

                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>NOME</TableHead>
                                  <TableHead>TELEFONE</TableHead>
                                  <TableHead>EMAIL</TableHead>
                                  <TableHead>ENDEREÇO</TableHead>
                                  <TableHead>SITE</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {isLoadingResults ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                    </TableCell>
                                  </TableRow>
                                ) : results && results.length > 0 ? (
                                  results.map((result) => (
                                    <TableRow 
                                      key={result.id}
                                      className="cursor-pointer hover:bg-accent"
                                      onClick={() => {
                                        setSelectedResult(result);
                                        setShowResultDialog(true);
                                      }}
                                    >
                                      <TableCell className="font-medium">{result.name || '-'}</TableCell>
                                      <TableCell>{result.phone || '-'}</TableCell>
                                      <TableCell>{result.email || '-'}</TableCell>
                                      <TableCell className="max-w-[200px] truncate">{result.address || '-'}</TableCell>
                                      <TableCell>{result.site || '-'}</TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                      Nenhum resultado encontrado para esta busca
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
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
                                disabled={createSearchMutation.isPending}
                                className="w-full bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                                size="lg"
                              >
                                {createSearchMutation.isPending ? (
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
                                  disabled={importListMutation.isPending || !importFile}
                                  className="w-full"
                                  size="lg"
                                >
                                  {importListMutation.isPending ? (
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
                <p className="text-lg">
                  {selectedResult.dispatchedAt ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Enviado em {format(new Date(selectedResult.dispatchedAt), "dd/MM/yyyy HH:mm")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                      Pendente de envio
                    </Badge>
                  )}
                </p>
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
      

    </div>
  );
}