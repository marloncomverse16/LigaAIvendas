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
import { useState, useEffect } from "react";
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
  whatsappMetaToken: z.string().nullable().optional(), // Token para a API da Meta
  whatsappMetaBusinessId: z.string().nullable().optional(), // ID do negócio na plataforma Meta
  whatsappMetaApiVersion: z.string().nullable().optional(), // Versão da API da Meta
  whatsappWebhookUrl: z.string().nullable().optional(),
  aiAgentName: z.string().nullable().optional(),
  aiAgentWebhookUrl: z.string().nullable().optional(),
  prospectingWebhookUrl: z.string().nullable().optional(),
  contactsWebhookUrl: z.string().nullable().optional(),
  schedulingWebhookUrl: z.string().nullable().optional(),
  crmWebhookUrl: z.string().nullable().optional(),
  messageSendingWebhookUrl: z.string().nullable().optional(), // Webhook para envio de mensagens
  instanceId: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

// Esquema para o formulário de agentes IA
const aiAgentFormSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  description: z.string().optional(),
  webhookUrl: z.string().min(1, { message: "URL do webhook é obrigatório" }),
  active: z.boolean().default(true),
});

type AiAgentFormValues = z.infer<typeof aiAgentFormSchema>;

interface Server {
  id: number;
  name: string;
  ipAddress: string;
  provider: string;
  apiUrl: string;
  apiToken: string | null;
  n8nApiUrl: string | null;
  whatsappMetaToken: string | null;
  whatsappMetaBusinessId: string | null;
  whatsappMetaApiVersion: string | null;
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

// Interface para agentes de IA vinculados a servidores
interface ServerAiAgent {
  id: number;
  serverId: number;
  name: string;
  description: string | null;
  webhookUrl: string | null;
  active: boolean;
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
  
  // Estados específicos para agentes IA
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [isAgentCreateDialogOpen, setIsAgentCreateDialogOpen] = useState(false);
  const [isAgentEditDialogOpen, setIsAgentEditDialogOpen] = useState(false);
  const [isAgentDeleteDialogOpen, setIsAgentDeleteDialogOpen] = useState(false);
  
  // Formulário para criar/editar agente IA
  const aiAgentForm = useForm<AiAgentFormValues>({
    resolver: zodResolver(aiAgentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      webhookUrl: "",
      active: true,
    },
  });
  
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
      whatsappMetaToken: "",
      whatsappMetaBusinessId: "",
      whatsappMetaApiVersion: "v18.0",
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
      whatsappMetaToken: "",
      whatsappMetaBusinessId: "",
      whatsappMetaApiVersion: "v18.0",
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
  
  // Busca os agentes IA associados ao servidor selecionado
  const { data: serverAiAgents = [], isLoading: isLoadingAiAgents, refetch: refetchServerAiAgents } = useQuery({
    queryKey: ["/api/servers/ai-agents", selectedServer?.id],
    queryFn: async () => {
      if (!selectedServer) return [];
      try {
        const res = await apiRequest("GET", `/api/servers/${selectedServer.id}/ai-agents`);
        const data = await res.json();
        console.log("Agentes IA do servidor:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar agentes IA do servidor:", error);
        return [];
      }
    },
    enabled: !!selectedServer && isEditDialogOpen,
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
      console.log("Fazendo requisição PUT para:", `/api/servers/${id}`);
      console.log("Dados enviados:", JSON.stringify(data, null, 2));
      
      try {
        // Garantir que todos os campos importantes sejam tratados corretamente
        const processedData = {
          ...data,
          maxUsers: Number(data.maxUsers),
          // Garantir que os campos de webhook sejam incluídos mesmo que sejam null
          messageSendingWebhookUrl: data.messageSendingWebhookUrl || null,
          whatsappWebhookUrl: data.whatsappWebhookUrl || null,
          aiAgentWebhookUrl: data.aiAgentWebhookUrl || null,
          prospectingWebhookUrl: data.prospectingWebhookUrl || null,
          contactsWebhookUrl: data.contactsWebhookUrl || null,
          schedulingWebhookUrl: data.schedulingWebhookUrl || null,
          crmWebhookUrl: data.crmWebhookUrl || null,
        };
        
        console.log("Dados processados (VERIFICAR WEBHOOK URL):", JSON.stringify(processedData, null, 2));
        console.log("messageSendingWebhookUrl:", processedData.messageSendingWebhookUrl);
        
        const res = await apiRequest("PUT", `/api/servers/${id}`, processedData);
        console.log("Resposta recebida com status:", res.status);
        
        if (!res.ok) {
          // Se o servidor retornou um erro, tente extrair a mensagem de erro
          const errorData = await res.json().catch(() => null);
          console.error("Erro do servidor:", errorData);
          
          if (errorData && errorData.message) {
            throw new Error(errorData.message);
          } else {
            throw new Error(`Erro do servidor: ${res.status}`);
          }
        }
        
        return res.json();
      } catch (error) {
        console.error("Erro na requisição para atualizar servidor:", error);
        
        // Propagar o erro para ser tratado pelo onError
        if (error instanceof Error) {
          throw error;
        } else {
          throw new Error("Erro desconhecido ao atualizar servidor");
        }
      }
    },
    onSuccess: (data) => {
      console.log("Atualização bem-sucedida:", JSON.stringify(data, null, 2));
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
      console.error("Erro tratado na mutação:", error);
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
  
  // Mutação para criar agente IA
  const createAiAgentMutation = useMutation({
    mutationFn: async (data: AiAgentFormValues) => {
      if (!selectedServer) throw new Error("Nenhum servidor selecionado");
      const res = await apiRequest("POST", `/api/servers/${selectedServer.id}/ai-agents`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Agente IA criado com sucesso",
        description: "O novo agente IA foi adicionado ao servidor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers/ai-agents", selectedServer?.id] });
      setIsAgentCreateDialogOpen(false);
      aiAgentForm.reset();
      refetchServerAiAgents();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar agente IA",
        description: error.message || "Ocorreu um erro ao criar o agente IA",
        variant: "destructive",
      });
    },
  });
  
  // Mutação para atualizar agente IA
  const updateAiAgentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AiAgentFormValues }) => {
      const res = await apiRequest("PUT", `/api/server-ai-agents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Agente IA atualizado com sucesso",
        description: "As informações do agente IA foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers/ai-agents", selectedServer?.id] });
      setIsAgentEditDialogOpen(false);
      aiAgentForm.reset();
      refetchServerAiAgents();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar agente IA",
        description: error.message || "Ocorreu um erro ao atualizar o agente IA",
        variant: "destructive",
      });
    },
  });
  
  // Mutação para excluir agente IA
  const deleteAiAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/server-ai-agents/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Agente IA excluído com sucesso",
        description: "O agente IA foi removido do servidor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/servers/ai-agents", selectedServer?.id] });
      setSelectedAgentId(null);
      setIsAgentDeleteDialogOpen(false);
      refetchServerAiAgents();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir agente IA",
        description: error.message || "Ocorreu um erro ao excluir o agente IA",
        variant: "destructive",
      });
    },
  });
  
  // Verificar se um usuário está associado ao servidor selecionado
  function isUserAssociatedWithServer(userId: number) {
    return serverUsers.some((su: any) => {
      // Check both direct or nested structure
      return (su.userId === userId) || (su.user && su.user.id === userId);
    });
  }
  
  function handleAddUserToServer(userId: number) {
    if (!selectedServer) return;
    
    const serverUserCount = getServerUserCount(selectedServer.id);
    if (serverUserCount >= selectedServer.maxUsers) {
      toast({
        title: "Limite de usuários atingido",
        description: `Este servidor está configurado para um máximo de ${selectedServer.maxUsers} usuários.`,
        variant: "destructive",
      });
      return;
    }
    
    addUserServerMutation.mutate({ userId, serverId: selectedServer.id });
  }
  
  function handleRemoveUserFromServer(relationId: number) {
    if (!selectedServer) return;
    
    removeUserServerMutation.mutate({ relationId, serverId: selectedServer.id });
  }
  
  function getServerUserCount(serverId: number) {
    const result = allServerUsers.find((item: any) => item.serverId === serverId);
    return result ? result.count : 0;
  }

  // Handlers para Agentes IA
  const handleCreateAiAgent = () => {
    if (!selectedServer) {
      toast({
        title: "Erro",
        description: "Selecione um servidor primeiro",
        variant: "destructive",
      });
      return;
    }
    
    aiAgentForm.reset({
      name: "",
      description: "",
      webhookUrl: "",
      active: true,
    });
    
    setIsAgentCreateDialogOpen(true);
  };
  
  const handleEditAiAgent = (agent: ServerAiAgent) => {
    aiAgentForm.reset({
      name: agent.name,
      description: agent.description || "",
      webhookUrl: agent.webhookUrl || "",
      active: agent.active,
    });
    
    setSelectedAgentId(agent.id);
    setIsAgentEditDialogOpen(true);
  };
  
  const handleDeleteAiAgent = (id: number) => {
    setSelectedAgentId(id);
    setIsAgentDeleteDialogOpen(true);
  };
  
  const onCreateAiAgentSubmit = (data: AiAgentFormValues) => {
    createAiAgentMutation.mutate(data);
  };
  
  const onEditAiAgentSubmit = (data: AiAgentFormValues) => {
    if (selectedAgentId) {
      updateAiAgentMutation.mutate({ id: selectedAgentId, data });
    }
  };
  
  const handleEditServer = (server: Server) => {
    setSelectedServer(server);
    
    console.log("Configurando formulário com dados do servidor:", JSON.stringify(server, null, 2));
    
    // Garantir que todos os campos tenham valores válidos
    const formData = {
      name: server.name || "",
      ipAddress: server.ipAddress || "",
      provider: server.provider || "",
      apiUrl: server.apiUrl || "",
      apiToken: server.apiToken || "",
      n8nApiUrl: server.n8nApiUrl || "",
      maxUsers: server.maxUsers || 10, // Valor padrão se for nulo
      whatsappWebhookUrl: server.whatsappWebhookUrl || "",
      aiAgentName: server.aiAgentName || "",
      aiAgentWebhookUrl: server.aiAgentWebhookUrl || "",
      prospectingWebhookUrl: server.prospectingWebhookUrl || "",
      contactsWebhookUrl: server.contactsWebhookUrl || "",
      schedulingWebhookUrl: server.schedulingWebhookUrl || "",
      crmWebhookUrl: server.crmWebhookUrl || "",
      // Adicionado campo de webhook de envio de mensagens
      messageSendingWebhookUrl: server.messageSendingWebhookUrl || "",
      instanceId: server.instanceId || "",
      // Garantir que active seja um boolean válido
      active: server.active === null ? false : Boolean(server.active),
      // Adicionar os campos Meta WhatsApp
      whatsappMetaToken: server.whatsappMetaToken || "",
      whatsappMetaBusinessId: server.whatsappMetaBusinessId || "",
      whatsappMetaApiVersion: server.whatsappMetaApiVersion || "v18.0", // Valor padrão
    };
    
    console.log("Dados do formulário configurados:", JSON.stringify(formData, null, 2));
    
    editForm.reset(formData);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteServer = (server: Server) => {
    setSelectedServer(server);
    setIsDeleteDialogOpen(true);
  };
  
  const handleManageServerUsers = (server: Server) => {
    setSelectedServer(server);
    setUserServerDialogOpen(true);
  };
  
  const onCreateSubmit = (data: ServerFormValues) => {
    createServerMutation.mutate(data);
  };
  
  const onEditSubmit = (data: ServerFormValues) => {
    if (selectedServer) {
      console.log("Enviando atualização para o servidor:", selectedServer.id);
      console.log("Dados do formulário:", JSON.stringify(data, null, 2));
      
      // Garantir que todos os campos obrigatórios estejam presentes
      if (!data.name || !data.ipAddress || !data.provider || !data.apiUrl) {
        toast({
          title: "Dados incompletos",
          description: "Por favor, preencha todos os campos obrigatórios",
          variant: "destructive",
        });
        return;
      }
      
      // Garantir que maxUsers seja um número
      const processedData = {
        ...data,
        maxUsers: Number(data.maxUsers),
        // Se active for null, defina como false
        active: data.active === null ? false : data.active,
      };
      
      console.log("Dados processados:", JSON.stringify(processedData, null, 2));
      
      try {
        updateServerMutation.mutate({ 
          id: selectedServer.id, 
          data: processedData 
        });
      } catch (error) {
        console.error("Erro ao enviar dados:", error);
        toast({
          title: "Erro ao atualizar servidor",
          description: "Ocorreu um erro ao enviar os dados do servidor",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Erro",
        description: "Nenhum servidor selecionado para edição",
        variant: "destructive",
      });
    }
  };
  
  const filteredServers = servers.filter((server: Server) => {
    // Primeiro filtramos pelo estado (ativo/inativo)
    if (filter === "active" && !server.active) return false;
    if (filter === "inactive" && server.active) return false;
    
    // Depois filtramos pela busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        server.name.toLowerCase().includes(query) ||
        server.ipAddress.toLowerCase().includes(query) ||
        server.provider.toLowerCase().includes(query)
      );
    }
    
    return true;
  });
  
  return (
    <div className="px-4 md:px-6 w-full max-w-7xl mx-auto space-y-4 py-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Servidores</h1>
          <p className="text-muted-foreground">
            Adicione, edite e gerencie servidores para a plataforma.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Servidor
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todos
          </Button>
          <Button 
            variant={filter === "active" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilter("active")}
            className={filter === "active" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Ativos
          </Button>
          <Button 
            variant={filter === "inactive" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilter("inactive")}
            className={filter === "inactive" ? "bg-gray-500 hover:bg-gray-600" : ""}
          >
            Inativos
          </Button>
        </div>
        
        <div className="w-full sm:w-auto relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar servidores..." 
            className="pl-8 w-full sm:w-auto min-w-[200px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="border rounded-md shadow-sm">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Nome / Endereço</TableHead>
              <TableHead className="hidden md:table-cell">Provider</TableHead>
              <TableHead className="hidden md:table-cell">Usuários</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredServers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? (
                    <p>Nenhum servidor encontrado para "{searchQuery}"</p>
                  ) : (
                    <p>Nenhum servidor disponível</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredServers.map((server: Server) => {
                  const userCount = getServerUserCount(server.id);
                  const isOverLimit = userCount > server.maxUsers;
                  
                  return (
                    <TableRow key={server.id}>
                      <TableCell>
                        <div className="font-medium">{server.name}</div>
                        <div className="text-xs text-muted-foreground">{server.ipAddress}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{server.provider}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge 
                          variant="outline" 
                          className={
                            isOverLimit ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : ""
                          }
                        >
                          {userCount}/{server.maxUsers}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {server.active ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {server.createdAt ? (
                          typeof server.createdAt === 'string'
                            ? format(new Date(server.createdAt), 'dd/MM/yyyy')
                            : format(server.createdAt, 'dd/MM/yyyy')
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleEditServer(server)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => handleManageServerUsers(server)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteServer(server)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Modal para criar servidor */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Servidor</DialogTitle>
            <DialogDescription>
              Configure os detalhes do novo servidor para a plataforma.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="general">Geral</TabsTrigger>
                  <TabsTrigger value="api">API e Conexão</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  <TabsTrigger value="avancado">Avançado</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Servidor</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do servidor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço IP</FormLabel>
                        <FormControl>
                          <Input placeholder="Endereço IP do servidor" {...field} />
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o provedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="aws">AWS</SelectItem>
                            <SelectItem value="azure">Azure</SelectItem>
                            <SelectItem value="gcp">Google Cloud</SelectItem>
                            <SelectItem value="digital_ocean">Digital Ocean</SelectItem>
                            <SelectItem value="vps">VPS</SelectItem>
                            <SelectItem value="dedicated">Servidor Dedicado</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máximo de Usuários</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="api" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="apiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da API</FormLabel>
                        <FormControl>
                          <Input placeholder="URL da API do servidor" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL da API para integração com o servidor.
                        </FormDescription>
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
                          <Input placeholder="Token de autenticação da API" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          Token de autenticação para acessar a API do servidor.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="n8nApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da API do n8n</FormLabel>
                        <FormControl>
                          <Input placeholder="URL da API do n8n (para Cloud API)" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL da API do n8n para integrações com WhatsApp Cloud API.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="webhooks" className="space-y-4 pt-4">
                  <div className="border p-4 rounded-md mb-4 bg-secondary/20">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-semibold">Agentes de IA</h3>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={() => handleCreateAiAgent()}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" /> Novo Agente
                      </Button>
                    </div>
                    
                    {isLoadingAiAgents ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : serverAiAgents.length > 0 ? (
                      <div className="space-y-3">
                        {serverAiAgents.map((agent: ServerAiAgent) => (
                          <div key={agent.id} className="p-3 border rounded-md flex justify-between items-center">
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[250px]" title={agent.webhookUrl || ''}>
                                {agent.webhookUrl}
                              </div>
                              {agent.active ? (
                                <Badge variant="outline" className="mt-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>
                              ) : (
                                <Badge variant="outline" className="mt-1 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Inativo</Badge>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditAiAgent(agent)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteAiAgent(agent.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Nenhum agente IA configurado</p>
                        <p className="text-sm">Clique em "Novo Agente" para adicionar</p>
                      </div>
                    )}
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
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Editar Servidor: {selectedServer?.name}</DialogTitle>
            <DialogDescription>
              Atualize as configurações do servidor selecionado.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="general">Geral</TabsTrigger>
                  <TabsTrigger value="api">API e Conexão</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  <TabsTrigger value="avancado">Avançado</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4 pt-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Servidor</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do servidor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço IP</FormLabel>
                        <FormControl>
                          <Input placeholder="Endereço IP do servidor" {...field} />
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o provedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="aws">AWS</SelectItem>
                            <SelectItem value="azure">Azure</SelectItem>
                            <SelectItem value="gcp">Google Cloud</SelectItem>
                            <SelectItem value="digital_ocean">Digital Ocean</SelectItem>
                            <SelectItem value="vps">VPS</SelectItem>
                            <SelectItem value="dedicated">Servidor Dedicado</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máximo de Usuários</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="api" className="space-y-4 pt-4">
                  <FormField
                    control={editForm.control}
                    name="apiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da API</FormLabel>
                        <FormControl>
                          <Input placeholder="URL da API do servidor" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL da API para integração com o servidor.
                        </FormDescription>
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
                          <Input placeholder="Token de autenticação da API" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          Token de autenticação para acessar a API do servidor.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="n8nApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da API do n8n</FormLabel>
                        <FormControl>
                          <Input placeholder="URL da API do n8n (para Cloud API)" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL da API do n8n para integrações com WhatsApp Cloud API.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Seção de WhatsApp Cloud API removida - agora nas configurações do usuário */}
                </TabsContent>
                
                <TabsContent value="webhooks" className="space-y-4 pt-4">
                  <div className="border p-4 rounded-md mb-4 bg-secondary/20">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-semibold">Agentes de IA</h3>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={() => handleCreateAiAgent()}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" /> Novo Agente
                      </Button>
                    </div>
                    
                    {isLoadingAiAgents ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : serverAiAgents.length > 0 ? (
                      <div className="space-y-3">
                        {serverAiAgents.map((agent: ServerAiAgent) => (
                          <div key={agent.id} className="p-3 border rounded-md flex justify-between items-center">
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[250px]" title={agent.webhookUrl || ''}>
                                {agent.webhookUrl}
                              </div>
                              {agent.active ? (
                                <Badge variant="outline" className="mt-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>
                              ) : (
                                <Badge variant="outline" className="mt-1 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Inativo</Badge>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditAiAgent(agent)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteAiAgent(agent.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Nenhum agente IA configurado</p>
                        <p className="text-sm">Clique em "Novo Agente" para adicionar</p>
                      </div>
                    )}
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
                  
                  <FormField
                    control={editForm.control}
                    name="messageSendingWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook de Envio de Mensagens</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para envio de mensagens em massa" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          Este webhook será usado quando o envio via QR code for selecionado
                        </FormDescription>
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
      
      {/* Modal para criar agente IA */}
      <Dialog open={isAgentCreateDialogOpen} onOpenChange={setIsAgentCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Agente IA</DialogTitle>
            <DialogDescription>
              Configure um novo agente de IA para o servidor {selectedServer?.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...aiAgentForm}>
            <form onSubmit={aiAgentForm.handleSubmit(onCreateAiAgentSubmit)} className="space-y-4">
              <FormField
                control={aiAgentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Agente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Assistente de Vendas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição do agente IA e suas funcionalidades" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook</FormLabel>
                    <FormControl>
                      <Input placeholder="URL para integração do agente IA" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL para onde serão enviadas as notificações do agente IA
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Agente Ativo</FormLabel>
                      <FormDescription>
                        Agentes inativos não processarão mensagens.
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAgentCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createAiAgentMutation.isPending}>
                  {createAiAgentMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar Agente
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal para editar agente IA */}
      <Dialog open={isAgentEditDialogOpen} onOpenChange={setIsAgentEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agente IA</DialogTitle>
            <DialogDescription>
              Modifique as configurações do agente IA selecionado.
            </DialogDescription>
          </DialogHeader>
          <Form {...aiAgentForm}>
            <form onSubmit={aiAgentForm.handleSubmit(onEditAiAgentSubmit)} className="space-y-4">
              <FormField
                control={aiAgentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Agente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Assistente de Vendas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição do agente IA e suas funcionalidades" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook</FormLabel>
                    <FormControl>
                      <Input placeholder="URL para integração do agente IA" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL para onde serão enviadas as notificações do agente IA
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={aiAgentForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Agente Ativo</FormLabel>
                      <FormDescription>
                        Agentes inativos não processarão mensagens.
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAgentEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateAiAgentMutation.isPending}>
                  {updateAiAgentMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Modal para excluir agente IA */}
      <AlertDialog open={isAgentDeleteDialogOpen} onOpenChange={setIsAgentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agente IA</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agente IA? 
              Esta ação não pode ser desfeita e pode afetar integrações existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedAgentId && deleteAiAgentMutation.mutate(selectedAgentId)}>
              {deleteAiAgentMutation.isPending ? "Excluindo..." : "Excluir"}
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