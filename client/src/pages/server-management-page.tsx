import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Filter, Loader2, MinusCircle, Pencil, PlusCircle, RefreshCw, Search, Trash2, Users, X 
} from "lucide-react";
import { format } from "date-fns";

// Esquema para o formulário do servidor
const serverFormSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  ipAddress: z.string().min(1, { message: "Endereço IP é obrigatório" }),
  provider: z.string().min(1, { message: "Provedor é obrigatório" }),
  apiUrl: z.string().min(1, { message: "A URL da API é obrigatória" }),
  apiToken: z.string().optional(),
  n8nApiUrl: z.string().nullable().optional(),
  maxUsers: z.coerce.number().min(1, { message: "Defina pelo menos 1 usuário" }).default(10),
  whatsappWebhookUrl: z.string().nullable().optional(),
  aiAgentName: z.string().nullable().optional(),
  aiAgentWebhookUrl: z.string().nullable().optional(),
  prospectingWebhookUrl: z.string().nullable().optional(),
  contactsWebhookUrl: z.string().nullable().optional(),
  schedulingWebhookUrl: z.string().nullable().optional(),
  crmWebhookUrl: z.string().nullable().optional(),
  instanceId: z.string().nullable().optional(),
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
  n8nApiUrl: string | null;
  whatsappWebhookUrl: string | null;
  aiAgentName: string | null;
  aiAgentWebhookUrl: string | null;
  prospectingWebhookUrl: string | null;
  contactsWebhookUrl: string | null;
  schedulingWebhookUrl: string | null;
  crmWebhookUrl: string | null;
  instanceId: string | null;
  maxUsers: number;
  active: boolean | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

export default function ServerManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estados para controlar formulários e diálogos
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userServerDialogOpen, setUserServerDialogOpen] = useState(false);
  const [serverUserSearch, setServerUserSearch] = useState("");
  
  // Formulário para criar servidor
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      ipAddress: "",
      provider: "",
      apiUrl: "",
      apiToken: "",
      n8nApiUrl: "",
      maxUsers: 10,
      whatsappWebhookUrl: "",
      aiAgentName: "",
      aiAgentWebhookUrl: "",
      prospectingWebhookUrl: "",
      contactsWebhookUrl: "",
      schedulingWebhookUrl: "",
      crmWebhookUrl: "",
      instanceId: "",
      active: true,
    },
  });
  
  // Formulário para editar servidor
  const editForm = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      ipAddress: "",
      provider: "",
      apiUrl: "",
      apiToken: "",
      n8nApiUrl: "",
      maxUsers: 10,
      whatsappWebhookUrl: "",
      aiAgentName: "",
      aiAgentWebhookUrl: "",
      prospectingWebhookUrl: "",
      contactsWebhookUrl: "",
      schedulingWebhookUrl: "",
      crmWebhookUrl: "",
      instanceId: "",
      active: true,
    },
  });
  
  // Busca lista de servidores
  const { data: servers = [], isLoading, refetch: refetchServers } = useQuery({
    queryKey: ["/api/servers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/servers");
      const data = await res.json();
      return data;
    },
    enabled: !!user?.isAdmin,
  });
  
  // Busca usuários associados ao servidor selecionado
  const { data: serverUsers = [], isLoading: isLoadingServerUsers, refetch: refetchServerUsers } = useQuery({
    queryKey: ["/api/user-servers", selectedServer?.id],
    queryFn: async () => {
      if (!selectedServer) return [];
      console.log("Buscando usuários para o servidor:", selectedServer.id);
      try {
        // Usuários só podem ser gerenciados por admin, então usamos a rota de admin
        const res = await apiRequest("GET", `/api/user-servers/${selectedServer.id}`);
        const data = await res.json();
        console.log("Usuários do servidor retornados:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar usuários do servidor:", error);
        return [];
      }
    },
    enabled: !!selectedServer && userServerDialogOpen && !!user?.isAdmin,
  });
  
  // Busca a contagem de usuários para todos os servidores
  const { data: allServerUsers = [], refetch: refetchAllServerUsers } = useQuery({
    queryKey: ["/api/servers/users-count"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/servers/users-count");
        const data = await res.json();
        console.log("Contagem de usuários por servidor:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar contagem de usuários por servidor:", error);
        return [];
      }
    },
    enabled: true,
  });
  
  // Busca todos os usuários do sistema para associação
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/admin/users`);
        const data = await res.json();
        console.log("Dados dos usuários:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        return [];
      }
    },
    enabled: userServerDialogOpen && !!user?.isAdmin,
  });
  
  // Filtra usuários por nome ou email para o modal de associação
  const filteredAllUsers = allUsers.filter((user: any) => {
    return (
      user.username.toLowerCase().includes(serverUserSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(serverUserSearch.toLowerCase())
    );
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
      refetchServers();
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
    mutationFn: async ({ id, data }: { id: number; data: ServerFormValues }) => {
      const res = await apiRequest("PUT", `/api/servers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Servidor atualizado com sucesso",
        description: "As informações do servidor foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setIsEditDialogOpen(false);
      editForm.reset();
      refetchServers();
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
      refetchServers();
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
        title: "Usuário associado ao servidor",
        description: "O usuário foi associado com sucesso ao servidor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-servers", selectedServer?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
      refetchServerUsers();
      refetchAllServerUsers();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao associar usuário",
        description: error.message || "Ocorreu um erro ao associar o usuário ao servidor",
        variant: "destructive",
      });
    },
  });
  
  // Mutação para remover servidor de um usuário (usando relationId)
  const removeUserServerMutation = useMutation({
    mutationFn: async ({ relationId, serverId }: { relationId: number; serverId: number }) => {
      // Usando o ID da relação (user_server.id) em vez do ID do usuário
      await apiRequest("DELETE", `/api/user-servers/relation/${relationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Usuário removido do servidor",
        description: "O usuário foi desassociado do servidor com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-servers", selectedServer?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
      refetchServerUsers();
      refetchAllServerUsers();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover usuário",
        description: error.message || "Ocorreu um erro ao remover o usuário do servidor",
        variant: "destructive",
      });
    },
  });
  
  // Handler para criar servidor
  const onCreateSubmit = (data: ServerFormValues) => {
    createServerMutation.mutate(data);
  };
  
  // Handler para atualizar servidor
  const onEditSubmit = (data: ServerFormValues) => {
    if (selectedServer) {
      updateServerMutation.mutate({ id: selectedServer.id, data });
    }
  };
  
  // Abre o modal de edição e preenche o formulário com os dados do servidor
  const handleEditServer = (server: Server) => {
    setSelectedServer(server);
    editForm.reset({
      name: server.name,
      ipAddress: server.ipAddress,
      provider: server.provider,
      apiUrl: server.apiUrl,
      apiToken: server.apiToken || "",
      n8nApiUrl: server.n8nApiUrl || "",
      maxUsers: server.maxUsers,
      whatsappWebhookUrl: server.whatsappWebhookUrl || "",
      aiAgentName: server.aiAgentName || "",
      aiAgentWebhookUrl: server.aiAgentWebhookUrl || "",
      prospectingWebhookUrl: server.prospectingWebhookUrl || "",
      contactsWebhookUrl: server.contactsWebhookUrl || "",
      schedulingWebhookUrl: server.schedulingWebhookUrl || "",
      crmWebhookUrl: server.crmWebhookUrl || "",
      instanceId: server.instanceId || "",
      active: server.active || true,
    });
    setIsEditDialogOpen(true);
  };
  
  // Abre o modal de exclusão
  const handleDeleteServer = (server: Server) => {
    setSelectedServer(server);
    setIsDeleteDialogOpen(true);
  };
  
  // Abre o modal para associar usuários a um servidor
  const handleManageServerUsers = (server: Server) => {
    setSelectedServer(server);
    setUserServerDialogOpen(true);
  };
  
  // Handler para adicionar um usuário ao servidor
  const handleAddUserToServer = (userId: number) => {
    if (selectedServer) {
      // Verifica se o servidor já atingiu o limite de usuários
      const serverUserCount = allServerUsers.find((s: any) => s.serverId === selectedServer.id)?.userCount || 0;
      if (serverUserCount >= selectedServer.maxUsers) {
        toast({
          title: "Limite de usuários atingido",
          description: `Este servidor já atingiu o limite de ${selectedServer.maxUsers} usuários. Aumente o limite para adicionar mais usuários.`,
          variant: "destructive",
        });
        return;
      }
      
      addUserServerMutation.mutate({ userId, serverId: selectedServer.id });
    }
  };
  
  // Handler para remover um usuário do servidor
  const handleRemoveUserFromServer = (relationId: number) => {
    if (selectedServer) {
      removeUserServerMutation.mutate({ relationId, serverId: selectedServer.id });
    }
  };
  
  // Pega a contagem de usuários para um servidor específico
  const getServerUserCount = (serverId: number) => {
    const serverUserCount = allServerUsers.find((s: any) => s.serverId === serverId);
    return serverUserCount?.userCount || 0;
  };
  
  // Determina se um usuário já está associado ao servidor
  const isUserAssociatedWithServer = (userId: number) => {
    // Verifica primeiro se o usuário está no array serverUsers
    const directMatch = serverUsers.some((su: any) => su.userId === userId);
    if (directMatch) return true;
    
    // Verifica se o usuário está no objeto user dentro de serverUsers
    const nestedMatch = serverUsers.some((su: any) => su.user && su.user.id === userId);
    return nestedMatch;
  };
  
  // Filtra servidores baseado na aba selecionada e termo de busca
  const filteredServers = servers.filter((server: Server) => {
    const matchesTab = filter === "all" || 
                      (filter === "active" && server.active) || 
                      (filter === "inactive" && !server.active);
    
    const matchesSearch = searchQuery === "" ||
                         server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.provider.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Gerenciamento de Servidores</h1>
          {user?.isAdmin && (
            <Button onClick={() => {
              form.reset();
              setIsCreateDialogOpen(true);
            }}>
              Novo Servidor
            </Button>
          )}
        </div>
        
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, IP ou provedor..." 
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtrar:</span>
            <Tabs value={filter} onValueChange={setFilter} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="inactive">Inativos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredServers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>API URL</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServers.map((server: Server) => {
                    const userCount = getServerUserCount(server.id);
                    const percentageUsed = server.maxUsers > 0 ? (userCount / server.maxUsers) * 100 : 0;
                    const badgeColor = percentageUsed >= 90 ? "destructive" : percentageUsed >= 70 ? "warning" : "success";
                    
                    return (
                      <TableRow key={server.id} className={!server.active ? 'opacity-70' : ''}>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell>{server.ipAddress}</TableCell>
                        <TableCell>{server.provider}</TableCell>
                        <TableCell className="truncate max-w-[150px]" title={server.apiUrl}>
                          {server.apiUrl}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badgeColor as any} className="whitespace-nowrap">
                            {userCount}/{server.maxUsers} usuários
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {server.active ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleManageServerUsers(server)}
                              title="Usuários Conectados"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            
                            {user?.isAdmin && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditServer(server)}
                                  title="Editar servidor"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => handleDeleteServer(server)}
                                  title="Excluir servidor"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum servidor encontrado</CardTitle>
                <CardDescription>
                  {searchQuery 
                    ? `Nenhum servidor corresponde à busca "${searchQuery}"`
                    : filter !== "all" 
                      ? `Não há servidores ${filter === "active" ? "ativos" : "inativos"}`
                      : "Não há servidores cadastrados"}
                  {user?.isAdmin && ". Clique em 'Novo Servidor' para adicionar."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
      
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
              <Tabs defaultValue="geral">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  <TabsTrigger value="avancado">Configurações Avançadas</TabsTrigger>
                </TabsList>
                
                <TabsContent value="geral" className="space-y-4 pt-4">
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
                            <Input placeholder="Ex: AWS, GCP, Azure" {...field} />
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
                    name="n8nApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API do N8N</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: https://n8n.exemplo.com/api/v1" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL da API do N8N para integração com WhatsApp Cloud API
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="instanceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID da Instância</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: instance1 ou outro identificador" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          Identificador único da instância da Evolution API (necessário para conexão WhatsApp)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-primary">Quantidade Máxima de Usuários</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            placeholder="Ex: 10" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="webhooks" className="space-y-4 pt-4">
                  <div className="border p-4 rounded-md mb-4 bg-secondary/20">
                    <h3 className="text-md font-semibold mb-2">Configuração do Agente IA</h3>
                    <FormField
                      control={form.control}
                      name="aiAgentName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Agente IA</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do agente de IA (ex: Assistente de Vendas)" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>
                            Nome personalizado para o assistente de IA
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="aiAgentWebhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook de AI Agent</FormLabel>
                          <FormControl>
                            <Input placeholder="URL do webhook para integrações de IA" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <h3 className="text-md font-semibold">Outros Webhooks</h3>
                  <FormField
                    control={form.control}
                    name="whatsappWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para notificações do WhatsApp" {...field} value={field.value || ""} />
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
                        <FormLabel>Webhook de Prospecção</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para gestão de leads" {...field} value={field.value || ""} />
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
                        <FormLabel>Webhook de Contatos</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para sincronização de contatos" {...field} value={field.value || ""} />
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
                        <FormLabel>Webhook de Agendamento</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para agendamentos" {...field} value={field.value || ""} />
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
                        <FormLabel>Webhook de CRM</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para integrações de CRM" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="avancado" className="space-y-4 pt-4">
                  
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Servidor Ativo</FormLabel>
                          <FormDescription>
                            Servidores inativos não são usados para novas conexões.
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
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createServerMutation.isPending}>
                  {createServerMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Servidor
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal para editar servidor */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Servidor</DialogTitle>
            <DialogDescription>
              Atualize os detalhes do servidor.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <Tabs defaultValue="geral">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  <TabsTrigger value="avancado">Configurações Avançadas</TabsTrigger>
                </TabsList>
                
                <TabsContent value="geral" className="space-y-4 pt-4">
                  <FormField
                    control={editForm.control}
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
                      control={editForm.control}
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
                      control={editForm.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provedor</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: AWS, GCP, Azure" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={editForm.control}
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
                    control={editForm.control}
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
                    control={editForm.control}
                    name="n8nApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API do N8N</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: https://n8n.exemplo.com/api/v1" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL da API do N8N para integração com WhatsApp Cloud API
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-primary">Quantidade Máxima de Usuários</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            placeholder="Ex: 10" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="webhooks" className="space-y-4 pt-4">
                  <div className="border p-4 rounded-md mb-4 bg-secondary/20">
                    <h3 className="text-md font-semibold mb-2">Configuração do Agente IA</h3>
                    <FormField
                      control={editForm.control}
                      name="aiAgentName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Agente IA</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do agente de IA (ex: Assistente de Vendas)" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>
                            Nome personalizado para o assistente de IA
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="aiAgentWebhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook de AI Agent</FormLabel>
                          <FormControl>
                            <Input placeholder="URL do webhook para integrações de IA" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <h3 className="text-md font-semibold">Outros Webhooks</h3>
                  <FormField
                    control={editForm.control}
                    name="whatsappWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para notificações do WhatsApp" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="prospectingWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de Prospecção</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para gestão de leads" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="contactsWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de Contatos</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para sincronização de contatos" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="schedulingWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de Agendamento</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para agendamentos" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="crmWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de CRM</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para integrações de CRM" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="avancado" className="space-y-4 pt-4">
                  <FormField
                    control={editForm.control}
                    name="instanceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID da Instância (Evolution API)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: liguia" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          Identificador único da instância na Evolution API.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Servidor Ativo</FormLabel>
                          <FormDescription>
                            Servidores inativos não são usados para novas conexões.
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
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateServerMutation.isPending}>
                  {updateServerMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal para excluir servidor */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Servidor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o servidor "{selectedServer?.name}"? 
              Esta ação não pode ser desfeita e pode afetar usuários conectados a este servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedServer && deleteServerMutation.mutate(selectedServer.id)}>
              {deleteServerMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Modal para gerenciar usuários do servidor */}
      <Dialog open={userServerDialogOpen} onOpenChange={setUserServerDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Usuários Conectados a {selectedServer?.name}
              <Badge variant="outline">
                {getServerUserCount(selectedServer?.id || 0)}/{selectedServer?.maxUsers || 0} usuários
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Gerencie os usuários que têm acesso a este servidor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <div className="pb-4">
              <div className="relative">
                <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuários por nome ou email..."
                  value={serverUserSearch}
                  onChange={e => setServerUserSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-auto p-1">
              <div>
                <h3 className="font-medium text-sm mb-2">Usuários Conectados</h3>
                <ScrollArea className="h-[300px] rounded-md border p-2">
                  {isLoadingServerUsers ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : serverUsers.length > 0 ? (
                    <div className="space-y-2">
                      {serverUsers.map((userConnection: any) => {
                        // Verificar se os dados do usuário estão no nivel principal ou aninhados
                        const userData = userConnection.user || userConnection;
                        return (
                          <div 
                            key={userConnection.id} 
                            className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50"
                          >
                            <div>
                              <div className="font-medium">{userData.username || userData.name}</div>
                              <div className="text-sm text-muted-foreground">{userData.email}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveUserFromServer(userConnection.id)}
                            >
                              <MinusCircle className="h-5 w-5 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário conectado a este servidor.
                    </div>
                  )}
                </ScrollArea>
              </div>
              
              <div>
                <h3 className="font-medium text-sm mb-2">Todos os Usuários</h3>
                <ScrollArea className="h-[300px] rounded-md border p-2">
                  {!allUsers.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </div>
                  ) : filteredAllUsers.length > 0 ? (
                    <div className="space-y-2">
                      {filteredAllUsers.map((user: any) => (
                        <div 
                          key={user.id} 
                          className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50"
                        >
                          <div>
                            <div className="font-medium">{user.username || user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                          
                          {isUserAssociatedWithServer(user.id) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                // Encontrar o ID da relação para este usuário
                                const userConnection = serverUsers.find((su: any) => 
                                  (su.userId === user.id) || (su.user && su.user.id === user.id)
                                );
                                if (userConnection) {
                                  handleRemoveUserFromServer(userConnection.id);
                                }
                              }}
                            >
                              <MinusCircle className="h-5 w-5 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAddUserToServer(user.id)}
                              disabled={
                                addUserServerMutation.isPending || 
                                getServerUserCount(selectedServer?.id || 0) >= (selectedServer?.maxUsers || 0)
                              }
                            >
                              <PlusCircle className="h-5 w-5 text-primary" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado com o termo "{serverUserSearch}".
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserServerDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}