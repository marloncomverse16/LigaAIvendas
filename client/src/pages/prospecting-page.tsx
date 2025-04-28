import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Search, FilePlus2, Download, Send, X, Edit, Trash2, CheckCircle2, AlarmClock } from "lucide-react";
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
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string | null;
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
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ProspectingResult | null>(null);

  // Query para buscar dados de prospecção
  const { data: searches, isLoading: isLoadingSearches } = useQuery({
    queryKey: ["/api/prospecting/searches"],
    queryFn: async () => {
      const res = await fetch("/api/prospecting/searches");
      if (!res.ok) throw new Error("Falha ao carregar buscas de prospecção");
      return await res.json() as ProspectingSearch[];
    }
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

  // Form para editar webhook
  const webhookForm = useForm<{ webhookUrl: string }>({
    defaultValues: {
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

  // Mutação para atualizar webhook
  const updateWebhookMutation = useMutation({
    mutationFn: async (data: { webhookUrl: string }) => {
      const res = await apiRequest("PATCH", "/api/user", { prospectingWebhookUrl: data.webhookUrl });
      if (!res.ok) throw new Error("Falha ao atualizar webhook");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook atualizado",
        description: "URL do webhook foi atualizada com sucesso",
      });
      setShowWebhookDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  });

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
  };

  const onWebhookSubmit = (data: { webhookUrl: string }) => {
    updateWebhookMutation.mutate(data);
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
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Prospecção</h1>
          <p className="text-muted-foreground">Gerencie suas buscas e resultados de prospecção</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowWebhookDialog(true)}
          >
            Configurar Webhook
          </Button>
        </div>
      </div>

      <Tabs defaultValue="searches" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="searches">Buscas</TabsTrigger>
          <TabsTrigger value="new" className="gap-1">
            <FilePlus2 className="h-4 w-4" />
            Nova Busca
          </TabsTrigger>
        </TabsList>

        {/* Tab de listagem de buscas */}
        <TabsContent value="searches">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Buscas</CardTitle>
                    <CardDescription>Selecione uma busca para ver os resultados</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {isLoadingSearches ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : searches && searches.length > 0 ? (
                        <div className="divide-y">
                          {searches.map((search) => (
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
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="md:col-span-2">
              {activeSearch && searches ? (
                <Card>
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
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => exportToCSV(activeSearch)}
                        disabled={!results || results.length === 0}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Exportar
                      </Button>
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
                            <TableHead>Nome</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
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
                              <TableRow key={result.id}>
                                <TableCell className="font-medium">{result.name || "N/A"}</TableCell>
                                <TableCell>
                                  {result.email && <div className="text-sm">{result.email}</div>}
                                  {result.phone && <div className="text-sm">{result.phone}</div>}
                                </TableCell>
                                <TableCell>{result.type || "N/A"}</TableCell>
                                <TableCell>
                                  {result.dispatchedAt ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                      Enviado
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                      Pendente
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedResult(result);
                                      setShowResultDialog(true);
                                    }}
                                  >
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </TableCell>
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
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-6 h-[400px]">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">Selecione uma busca</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Escolha uma busca na lista ao lado para visualizar seus resultados ou crie uma nova busca de prospecção.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab de nova busca */}
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Nova Busca de Prospecção</CardTitle>
              <CardDescription>
                Configure os parâmetros para iniciar uma nova busca de leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="segment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Segmento*</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Restaurantes, Contabilidade, E-commerce" {...field} />
                          </FormControl>
                          <FormDescription>
                            Defina o segmento principal para a busca
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: São Paulo, Belo Horizonte" {...field} />
                          </FormControl>
                          <FormDescription>
                            Opcional. Deixe em branco para buscar em qualquer local
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="filters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filtros adicionais</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ex: empresas com mais de 10 funcionários, faturamento estimado acima de 1M, etc." 
                            {...field}
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription>
                          Opcional. Adicione critérios específicos para refinar sua busca
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Webhook</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://seu-webhook.com/endpoint" 
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Opcional. URL para onde os resultados serão enviados automaticamente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full md:w-auto"
                    disabled={createSearchMutation.isPending}
                  >
                    {createSearchMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Iniciar Busca
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para visualizar detalhes de um resultado */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              Informações detalhadas sobre o lead encontrado
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Nome</h4>
                <p className="text-base">{selectedResult.name || "Não disponível"}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                <p className="text-base">{selectedResult.email || "Não disponível"}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Telefone</h4>
                <p className="text-base">{selectedResult.phone || "Não disponível"}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Endereço</h4>
                <p className="text-base">{selectedResult.address || "Não disponível"}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tipo</h4>
                <p className="text-base">{selectedResult.type || "Não disponível"}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Data</h4>
                <p className="text-base">
                  {selectedResult.createdAt && format(new Date(selectedResult.createdAt), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-end">
            <Button variant="secondary" onClick={() => setShowResultDialog(false)}>
              Fechar
            </Button>
            {selectedResult && !selectedResult.dispatchedAt && (
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Enviar para CRM
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para configurar webhook */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Webhook</DialogTitle>
            <DialogDescription>
              Configure a URL do webhook para receber automaticamente os resultados das prospecções
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={webhookForm.handleSubmit(onWebhookSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">URL do Webhook</Label>
              <Input
                id="webhookUrl"
                placeholder="https://seu-webhook.com/endpoint"
                {...webhookForm.register("webhookUrl")}
              />
              <p className="text-sm text-muted-foreground">
                Esta URL será usada para todas as suas prospecções. Os resultados serão enviados via POST como JSON.
              </p>
            </div>
            
            <DialogFooter className="sm:justify-end">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setShowWebhookDialog(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateWebhookMutation.isPending}
              >
                {updateWebhookMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}