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
import { useState, useEffect, useMemo } from "react";
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
  ChevronLeft, ChevronRight, Download, Filter, Loader2, MinusCircle, Pencil, PlusCircle, RefreshCw, Search, Trash2, Users, X 
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
  aiAgentName: z.string().nullable().optional(),
  aiAgentWebhookUrl: z.string().nullable().optional(),
  prospectingWebhookUrl: z.string().nullable().optional(),
  contactsWebhookUrl: z.string().nullable().optional(),
  schedulingWebhookUrl: z.string().nullable().optional(),
  crmWebhookUrl: z.string().nullable().optional(),
  messageSendingWebhookUrl: z.string().nullable().optional(),

  active: z.boolean().default(true),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

// Esquema para o formulário de agentes IA
const aiAgentFormSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  description: z.string().optional(),
  webhookUrl: z.string().min(1, { message: "URL do webhook é obrigatório" }),
  cloudWebhookUrl: z.string().optional(),
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
  aiAgentName: string | null;
  aiAgentWebhookUrl: string | null;
  prospectingWebhookUrl: string | null;
  contactsWebhookUrl: string | null;
  schedulingWebhookUrl: string | null;
  crmWebhookUrl: string | null;
  messageSendingWebhookUrl: string | null;

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
  cloudWebhookUrl: string | null;
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
  
  // Estados para filtros avançados
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [providerFilter, setProviderFilter] = useState<"all" | "contabo" | "digitalocean" | "aws" | "outros">("all");
  
  // Estado para exportação
  const [isExporting, setIsExporting] = useState(false);
  
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const serversPerPage = 10;
  
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

          aiAgentWebhookUrl: data.aiAgentWebhookUrl || null,
          prospectingWebhookUrl: data.prospectingWebhookUrl || null,
          contactsWebhookUrl: data.contactsWebhookUrl || null,
          schedulingWebhookUrl: data.schedulingWebhookUrl || null,
          crmWebhookUrl: data.crmWebhookUrl || null,
        };
        
        console.log("Dados processados (VERIFICAR WEBHOOK URL):", JSON.stringify(processedData, null, 2));

        
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
    return result ? result.userCount : 0;
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
      cloudWebhookUrl: "",
      active: true,
    });
    
    setIsAgentCreateDialogOpen(true);
  };
  
  const handleEditAiAgent = (agent: ServerAiAgent) => {
    aiAgentForm.reset({
      name: agent.name,
      description: agent.description || "",
      webhookUrl: agent.webhookUrl || "",
      cloudWebhookUrl: agent.cloudWebhookUrl || "",
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
      aiAgentName: server.aiAgentName || "",
      aiAgentWebhookUrl: server.aiAgentWebhookUrl || "",
      prospectingWebhookUrl: server.prospectingWebhookUrl || "",
      contactsWebhookUrl: server.contactsWebhookUrl || "",
      schedulingWebhookUrl: server.schedulingWebhookUrl || "",
      crmWebhookUrl: server.crmWebhookUrl || "",
      messageSendingWebhookUrl: server.messageSendingWebhookUrl || "",

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
  
  // Função para exportar servidores para Excel
  const handleExportExcel = async () => {
    if (!filteredServers || filteredServers.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum servidor disponível para exportação",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Importação dinâmica da biblioteca XLSX
      const XLSX = await import('xlsx');
      
      // Preparar dados dos servidores para exportação
      const serversForExport = filteredServers.map((server: Server) => ({
        ID: server.id,
        Nome: server.name || '',
        'Endereço IP': server.ipAddress || '',
        Provedor: server.provider || '',
        'URL da API': server.apiUrl || '',
        'Token da API': server.apiToken ? '***Token Configurado***' : 'Não Configurado',
        'URL N8N': server.n8nApiUrl || '',
        'Token WhatsApp Meta': server.whatsappMetaToken ? '***Token Configurado***' : 'Não Configurado',
        'Business ID Meta': server.whatsappMetaBusinessId || '',
        'Versão API Meta': server.whatsappMetaApiVersion || '',
        'Nome Agente IA': server.aiAgentName || '',
        'Webhook Agente IA': server.aiAgentWebhookUrl || '',
        'Webhook Prospecção': server.prospectingWebhookUrl || '',
        'Webhook Contatos': server.contactsWebhookUrl || '',
        'Webhook Agendamento': server.schedulingWebhookUrl || '',
        'Webhook CRM': server.crmWebhookUrl || '',
        'Máximo de Usuários': server.maxUsers || 0,
        Status: server.active ? 'Ativo' : 'Inativo',
        'Data de Criação': server.createdAt ? format(new Date(server.createdAt), 'dd/MM/yyyy HH:mm') : '',
        'Última Atualização': server.updatedAt ? format(new Date(server.updatedAt), 'dd/MM/yyyy HH:mm') : ''
      }));

      // Criar planilha
      const worksheet = XLSX.utils.json_to_sheet(serversForExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Servidores');

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 10 }, // ID
        { wch: 25 }, // Nome
        { wch: 18 }, // Endereço IP
        { wch: 15 }, // Provedor
        { wch: 40 }, // URL da API
        { wch: 20 }, // Token da API
        { wch: 40 }, // URL N8N
        { wch: 25 }, // Token WhatsApp Meta
        { wch: 25 }, // Business ID Meta
        { wch: 15 }, // Versão API Meta
        { wch: 20 }, // Nome Agente IA
        { wch: 40 }, // Webhook Agente IA
        { wch: 40 }, // Webhook Prospecção
        { wch: 40 }, // Webhook Contatos
        { wch: 40 }, // Webhook Agendamento
        { wch: 40 }, // Webhook CRM
        { wch: 15 }, // Máximo de Usuários
        { wch: 12 }, // Status
        { wch: 18 }, // Data de Criação
        { wch: 18 }  // Última Atualização
      ];
      worksheet['!cols'] = columnWidths;

      // Gerar nome do arquivo com data e hora
      const now = new Date();
      const fileName = `servidores_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.xlsx`;

      // Fazer download do arquivo
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Sucesso",
        description: `${filteredServers.length} servidores exportados para Excel com sucesso!`,
      });

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar servidores para Excel",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Aplicar filtros avançados aos servidores
  const filteredServers = useMemo(() => {
    if (!servers) return [];

    return servers.filter((server: Server) => {
      // Filtro de busca (nome, IP, provedor, URL da API)
      const matchesSearch = searchTerm === "" || 
        (server.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (server.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (server.provider?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (server.apiUrl?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro de status
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && server.active) ||
        (statusFilter === "inactive" && !server.active);

      // Filtro de provedor
      const matchesProvider = providerFilter === "all" || 
        (providerFilter === "contabo" && server.provider?.toLowerCase().includes("contabo")) ||
        (providerFilter === "digitalocean" && server.provider?.toLowerCase().includes("digitalocean")) ||
        (providerFilter === "aws" && server.provider?.toLowerCase().includes("aws")) ||
        (providerFilter === "outros" && 
          !server.provider?.toLowerCase().includes("contabo") &&
          !server.provider?.toLowerCase().includes("digitalocean") &&
          !server.provider?.toLowerCase().includes("aws"));

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [servers, searchTerm, statusFilter, providerFilter]);
  
  // Efeito para resetar página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, providerFilter]);
  
  // Cálculos de paginação
  const totalPages = Math.ceil(filteredServers.length / serversPerPage);
  const startIndex = (currentPage - 1) * serversPerPage;
  const endIndex = startIndex + serversPerPage;
  const paginatedServers = filteredServers.slice(startIndex, endIndex);
  
  // Funções de navegação da paginação
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  return (
    <div className="px-4 md:px-6 w-full max-w-7xl mx-auto space-y-4 py-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Servidores</h1>
          <p className="text-muted-foreground">
            Adicione, edite e gerencie servidores para a plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportExcel}
            disabled={isExporting || !filteredServers || filteredServers.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Servidor
          </Button>
        </div>
      </div>
      
      {/* Filtros de busca avançados */}
      <Card className="shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Campo de busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nome, IP, provedor ou URL da API..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 lg:gap-2">
              {/* Filtro de Status */}
              <div className="w-full sm:w-40">
                <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro de Provedor */}
              <div className="w-full sm:w-40">
                <Select value={providerFilter} onValueChange={(value: "all" | "contabo" | "digitalocean" | "aws" | "outros") => setProviderFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="contabo">Contabo</SelectItem>
                    <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Contador de resultados */}
              <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                <Filter className="h-4 w-4 mr-2" />
                {filteredServers.length} de {servers?.length || 0} servidores
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
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
                  {servers?.length === 0 
                    ? "Nenhum servidor encontrado. Adicione o primeiro servidor."
                    : "Nenhum servidor corresponde aos filtros aplicados."
                  }
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paginatedServers.map((server: Server) => {
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
      
      {/* Paginação */}
      {filteredServers.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-background">
          {/* Contador de resultados */}
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredServers.length)} de {filteredServers.length} servidores
          </div>

          {/* Controles de navegação */}
          <div className="flex items-center gap-2">
            {/* Botão Anterior */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            {/* Numeração das páginas */}
            <div className="flex items-center gap-1">
              {(() => {
                const pages = [];
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, currentPage + 2);

                if (startPage > 1) {
                  pages.push(
                    <Button
                      key={1}
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      className="w-8 h-8 p-0"
                    >
                      1
                    </Button>
                  );
                  if (startPage > 2) {
                    pages.push(<span key="start-ellipsis" className="px-2">...</span>);
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <Button
                      key={i}
                      variant={currentPage === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(i)}
                      className={`w-8 h-8 p-0 ${
                        currentPage === i 
                          ? "bg-gradient-to-r from-orange-500 to-yellow-400 text-white hover:from-orange-600 hover:to-yellow-500"
                          : ""
                      }`}
                    >
                      {i}
                    </Button>
                  );
                }

                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(<span key="end-ellipsis" className="px-2">...</span>);
                  }
                  pages.push(
                    <Button
                      key={totalPages}
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      className="w-8 h-8 p-0"
                    >
                      {totalPages}
                    </Button>
                  );
                }

                return pages;
              })()}
            </div>

            {/* Botão Próxima */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
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
                        <FormLabel>Webhook de Configuração Instancia Evolution</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para configuração da instância Evolution" {...field} value={field.value || ""} />
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

                  <FormField
                    control={form.control}
                    name="messageSendingWebhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook Envio de mensagens</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para envio de mensagens QR Code" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL utilizada pelo botão "Criar Envio" para processar mensagens via QR Code
                        </FormDescription>
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
                <Button 
                  type="submit" 
                  disabled={createServerMutation.isPending}
                  className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                >
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
                        <FormLabel>Webhook de Configuração Instancia Evolution</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para configuração da instância Evolution" {...field} value={field.value || ""} />
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
                        <FormLabel>Webhook Envio de mensagens</FormLabel>
                        <FormControl>
                          <Input placeholder="URL do webhook para envio de mensagens QR Code" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          URL utilizada pelo botão "Criar Envio" para processar mensagens via QR Code
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                </TabsContent>
                
                <TabsContent value="avancado" className="space-y-4 pt-4">
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
                <Button 
                  type="submit" 
                  disabled={updateServerMutation.isPending}
                  className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                >
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
                name="cloudWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Cloud</FormLabel>
                    <FormControl>
                      <Input placeholder="URL específica para integração Cloud API" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL específica para integrações com WhatsApp Cloud API
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
                <Button 
                  type="submit" 
                  disabled={createAiAgentMutation.isPending}
                  className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                >
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
                name="cloudWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook Cloud</FormLabel>
                    <FormControl>
                      <Input placeholder="URL específica para integração Cloud API" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL específica para integrações com WhatsApp Cloud API
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
                <Button 
                  type="submit" 
                  disabled={updateAiAgentMutation.isPending}
                  className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                >
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