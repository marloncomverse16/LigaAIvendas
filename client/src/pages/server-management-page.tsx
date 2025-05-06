import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Server, RefreshCw, Pencil, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

// Define o schema para o formulário de servidor
const serverFormSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres" }),
  ipAddress: z.string().min(1, { message: "O endereço IP é obrigatório" }),
  provider: z.string().min(1, { message: "O nome do provedor é obrigatório" }),
  apiUrl: z.string().min(1, { message: "A URL da API é obrigatória" }),
  apiToken: z.string().optional(),
  whatsappWebhookUrl: z.string().optional(),
  aiAgentWebhookUrl: z.string().optional(),
  prospectingWebhookUrl: z.string().optional(),
  contactsWebhookUrl: z.string().optional(),
  schedulingWebhookUrl: z.string().optional(),
  crmWebhookUrl: z.string().optional(),
  instanceId: z.string().optional(),
  active: z.boolean().default(true),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface Server {
  id: number;
  name: string;
  ipAddress: string;
  provider: string;
  apiUrl: string;
  apiToken: string | null;
  whatsappWebhookUrl: string | null;
  aiAgentWebhookUrl: string | null;
  prospectingWebhookUrl: string | null;
  contactsWebhookUrl: string | null;
  schedulingWebhookUrl: string | null;
  crmWebhookUrl: string | null;
  instanceId: string | null;
  active: boolean | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

export default function ServerManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userServerDialogOpen, setUserServerDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Busca todos os servidores
  const { data: servers, isLoading } = useQuery<Server[]>({
    queryKey: ["/api/servers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/servers");
      return res.json();
    },
  });

  // Busca usuários (apenas para admin associar servidores a usuários)
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      if (!user?.isAdmin) return [];
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Formulário para criar/editar servidor
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      ipAddress: "",
      provider: "",
      apiUrl: "",
      apiToken: "",
      whatsappWebhookUrl: "",
      aiAgentWebhookUrl: "",
      prospectingWebhookUrl: "",
      contactsWebhookUrl: "",
      schedulingWebhookUrl: "",
      crmWebhookUrl: "",
      instanceId: "",
      active: true,
    },
  });

  // Mutação para criar servidor
  const createServerMutation = useMutation({
    mutationFn: async (data: ServerFormValues) => {
      const res = await apiRequest("POST", "/api/servers", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Servidor criado com sucesso",
        description: "O novo servidor foi adicionado ao sistema.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar servidor",
        description: error.message || "Ocorreu um erro ao criar o servidor",
        variant: "destructive",
      });
    },
  });

  // Mutação para atualizar servidor
  const updateServerMutation = useMutation({
    mutationFn: async (data: ServerFormValues & { id: number }) => {
      const { id, ...serverData } = data;
      const res = await apiRequest("PUT", `/api/servers/${id}`, serverData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Servidor atualizado com sucesso",
        description: "As informações do servidor foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setSelectedServer(null);
      setIsEditMode(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar servidor",
        description: error.message || "Ocorreu um erro ao atualizar o servidor",
        variant: "destructive",
      });
    },
  });

  // Mutação para excluir servidor
  const deleteServerMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/servers/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Servidor excluído com sucesso",
        description: "O servidor foi removido do sistema.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setSelectedServer(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir servidor",
        description: error.message || "Ocorreu um erro ao excluir o servidor",
        variant: "destructive",
      });
    },
  });

  // Mutação para adicionar servidor a um usuário
  const addUserServerMutation = useMutation({
    mutationFn: async ({ userId, serverId }: { userId: number; serverId: number }) => {
      const res = await apiRequest("POST", "/api/user-servers", { userId, serverId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Servidor associado com sucesso",
        description: "O servidor foi associado ao usuário.",
      });
      setUserServerDialogOpen(false);
      setSelectedUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar servidor",
        description: error.message || "Ocorreu um erro ao associar o servidor ao usuário",
        variant: "destructive",
      });
    },
  });

  // Mutação para remover servidor de um usuário
  const removeUserServerMutation = useMutation({
    mutationFn: async ({ userId, serverId }: { userId: number; serverId: number }) => {
      await apiRequest("DELETE", `/api/user-servers/${serverId}?userId=${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Associação removida com sucesso",
        description: "O servidor foi desassociado do usuário.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover associação",
        description: error.message || "Ocorreu um erro ao remover a associação",
        variant: "destructive",
      });
    },
  });
  
  // Mutação para selecionar um servidor como padrão do usuário
  const selectServerMutation = useMutation({
    mutationFn: async (serverId: number) => {
      const res = await apiRequest("POST", "/api/user/select-server", { serverId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Servidor selecionado como padrão",
        description: "Este servidor agora é o seu servidor padrão para todas as operações.",
      });
      // Atualiza os dados do usuário
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao selecionar servidor",
        description: error.message || "Ocorreu um erro ao selecionar o servidor como padrão",
        variant: "destructive",
      });
    },
  });

  // Função para abrir o modal de edição com os dados do servidor selecionado
  const handleEditServer = (server: Server) => {
    setSelectedServer(server);
    setIsEditMode(true);
    
    form.reset({
      name: server.name,
      ipAddress: server.ipAddress,
      provider: server.provider,
      apiUrl: server.apiUrl,
      apiToken: server.apiToken || "",
      whatsappWebhookUrl: server.whatsappWebhookUrl || "",
      aiAgentWebhookUrl: server.aiAgentWebhookUrl || "",
      prospectingWebhookUrl: server.prospectingWebhookUrl || "",
      contactsWebhookUrl: server.contactsWebhookUrl || "",
      schedulingWebhookUrl: server.schedulingWebhookUrl || "",
      crmWebhookUrl: server.crmWebhookUrl || "",
      instanceId: server.instanceId || "",
      active: server.active === null ? true : server.active,
    });
  };

  // Função para confirmar a exclusão de um servidor
  const handleDeleteServer = (server: Server) => {
    setSelectedServer(server);
    setIsDeleteDialogOpen(true);
  };

  // Função para confirmar a criação do servidor
  const onCreateSubmit = (data: ServerFormValues) => {
    createServerMutation.mutate(data);
  };

  // Função para confirmar a atualização do servidor
  const onUpdateSubmit = (data: ServerFormValues) => {
    if (!selectedServer) return;
    updateServerMutation.mutate({ ...data, id: selectedServer.id });
  };

  // Função para adicionar servidor a um usuário
  const handleAddUserServer = () => {
    if (!selectedServer || !selectedUserId) return;
    
    addUserServerMutation.mutate({
      userId: selectedUserId,
      serverId: selectedServer.id
    });
  };

  const filterServersByTab = (servers: Server[] = []) => {
    switch (selectedTab) {
      case "evolution":
        return servers.filter(server => server.provider === "evolution-api");
      case "n8n":
        return servers.filter(server => server.provider === "n8n");
      case "active":
        return servers.filter(server => server.active);
      case "inactive":
        return servers.filter(server => !server.active);
      default:
        return servers;
    }
  };

  // Formatação de data para exibição
  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Servidores</h1>
        {user?.isAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Servidor
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setSelectedTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="evolution">Evolution API</TabsTrigger>
          <TabsTrigger value="n8n">n8n</TabsTrigger>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="inactive">Inativos</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : servers && servers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Servidores {selectedTab !== "all" && `(${selectedTab})`}</CardTitle>
                <CardDescription>
                  Lista de servidores disponíveis no sistema. {user?.isAdmin && "Como administrador, você pode gerenciar todos os servidores."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableCaption>Lista de servidores</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>URL da API</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterServersByTab(servers).map((server) => (
                      <TableRow key={server.id}>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell>{server.ipAddress}</TableCell>
                        <TableCell>
                          <Badge variant={server.provider === "evolution-api" ? "default" : "secondary"}>
                            {server.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{server.apiUrl}</TableCell>
                        <TableCell>
                          {server.active ? (
                            <Badge variant="success" className="bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3 mr-1" /> Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(server.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditServer(server)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar servidor</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={user?.serverId === server.id ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => selectServerMutation.mutate(server.id)}
                                    disabled={selectServerMutation.isPending}
                                  >
                                    {selectServerMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{user?.serverId === server.id ? "Servidor padrão atual" : "Selecionar como servidor padrão"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {user?.isAdmin && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedServer(server);
                                          setUserServerDialogOpen(true);
                                        }}
                                      >
                                        <Server className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Associar a usuário</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteServer(server)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Excluir servidor</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum servidor encontrado</CardTitle>
                <CardDescription>
                  Não há servidores cadastrados. {user?.isAdmin && "Clique em 'Novo Servidor' para adicionar."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal para criar novo servidor */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Servidor</DialogTitle>
            <DialogDescription>
              Preencha os detalhes para adicionar um novo servidor ao sistema.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Servidor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Servidor Principal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ipAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço IP</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Evolution API, n8n, outro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da API</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: https://api.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da API</FormLabel>
                    <FormControl>
                      <Input placeholder="Token de autenticação da API" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="instanceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID da Instância (Evolution API)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: liguia" {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Identificador único da instância na Evolution API.
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              {/* URLs de Webhook específicos */}
              <Separator className="my-4" />
              <h3 className="text-lg font-medium mb-2">URLs de Webhook</h3>
              
              <FormField
                control={form.control}
                name="whatsappWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para integrações de WhatsApp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="aiAgentWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook AI Agent</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para AI Agent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prospectingWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Prospecção</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para prospecção" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactsWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Contatos</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para gestão de contatos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="schedulingWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Agendamento</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para agendamentos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="crmWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook CRM</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para CRM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <FormDescription>
                        Servidores ativos serão usados para conexões.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar Servidor</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal para editar servidor */}
      <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Servidor</DialogTitle>
            <DialogDescription>
              Atualize as informações do servidor selecionado.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Servidor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Servidor Principal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ipAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço IP</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provedor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Evolution API, n8n, outro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da API</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: https://api.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da API</FormLabel>
                    <FormControl>
                      <Input placeholder="Token de autenticação da API" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="instanceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID da Instância (Evolution API)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: liguia" {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Identificador único da instância na Evolution API.
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              {/* URLs de Webhook específicos */}
              <Separator className="my-4" />
              <h3 className="text-lg font-medium mb-2">URLs de Webhook</h3>
              
              <FormField
                control={form.control}
                name="whatsappWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para integrações de WhatsApp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="aiAgentWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook AI Agent</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para AI Agent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prospectingWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Prospecção</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para prospecção" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactsWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Contatos</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para gestão de contatos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="schedulingWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Agendamento</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para agendamentos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="crmWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook CRM</FormLabel>
                    <FormControl>
                      <Input placeholder="URL do webhook para CRM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <FormDescription>
                        Servidores ativos serão usados para conexões.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditMode(false);
                  setSelectedServer(null);
                }}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Alterações</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação para excluir servidor */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir este servidor? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedServer) {
                  deleteServerMutation.mutate(selectedServer.id);
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para associar usuário a servidor */}
      <Dialog open={userServerDialogOpen} onOpenChange={setUserServerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associar Usuário ao Servidor</DialogTitle>
            <DialogDescription>
              Selecione um usuário para associar ao servidor {selectedServer?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingUsers ? (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users && users.length > 0 ? (
              <Select onValueChange={(value) => setSelectedUserId(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p>Nenhum usuário disponível para associar.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUserServerDialogOpen(false);
                setSelectedUserId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddUserServer}
              disabled={!selectedUserId}
            >
              Associar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}