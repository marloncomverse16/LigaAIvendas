import React, { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, Users, MoreHorizontal, KeySquare, User as UserIcon, Bot, Download, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import UserPermissionsDialog from "@/components/admin/user-permissions-dialog";
import ModulePermissions from "@/components/admin/module-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { InsertUser, User as UserType } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserFormValues extends Omit<InsertUser, "password"> {
  password?: string;
  confirmPassword?: string;
  serverId?: number;
}

interface Server {
  id: number;
  name: string;
  ipAddress: string;
  provider: string;
  apiUrl: string;
  whatsappWebhookUrl: string | null;
  aiAgentWebhookUrl: string | null;
  prospectingWebhookUrl: string | null;
  contactsWebhookUrl: string | null;
  schedulingWebhookUrl: string | null;
  crmWebhookUrl: string | null;
  active: boolean | null;
}

interface UserServer {
  id: number;
  userId: number;
  serverId: number;
  createdAt: Date | null;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [formValues, setFormValues] = useState<UserFormValues>({
    username: "",
    email: "",
    name: "",
    company: "",
    phone: "",
    bio: "",
    availableTokens: 1000,
    tokenExpirationDays: 30,
    monthlyFee: "0",
    serverId: undefined,
    isAdmin: false,
    // Controles de acesso a módulos
    accessDashboard: true,
    accessLeads: true,
    accessProspecting: true,
    accessAiAgent: true,
    accessWhatsapp: true,
    accessContacts: true,
    accessScheduling: true,
    accessReports: true,
    accessSettings: true
  });
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  
  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  
  // Estados para filtros de servidor e agente IA
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  // Estados para gerenciar os agentes IA do usuário
  const [userAiAgents, setUserAiAgents] = useState<any[]>([]);
  const [availableAiAgents, setAvailableAiAgents] = useState<any[]>([]);
  

  
  // Query para buscar agentes IA disponíveis baseado no servidor selecionado
  const { data: availableAgentsForCreation = [] } = useQuery({
    queryKey: ["/api/servers", formValues.serverId, "available-ai-agents-creation"],
    queryFn: async () => {
      if (!formValues.serverId) return [];
      const res = await apiRequest("GET", `/api/servers/${formValues.serverId}/available-ai-agents-creation`);
      return await res.json();
    },
    enabled: !!formValues.serverId,
  });

  // Buscar todos os usuários com informações de servidor e agente
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users-complete"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      const usersData = await res.json();
      
      // Para cada usuário, buscar informações de servidor e agente IA
      const usersWithDetails = await Promise.all(usersData.map(async (user: any) => {
        try {
          // Buscar relação de servidor do usuário
          const serverRes = await apiRequest("GET", `/api/user-servers/user/${user.id}`);
          const serverRelations = await serverRes.json();
          
          // Buscar agentes IA do usuário
          const agentRes = await apiRequest("GET", `/api/users/${user.id}/ai-agents`);
          const aiAgents = await agentRes.json();
          
          return {
            ...user,
            serverRelation: serverRelations.length > 0 ? serverRelations[0] : null,
            aiAgents: aiAgents || []
          };
        } catch (error) {
          console.error(`Erro ao buscar detalhes do usuário ${user.id}:`, error);
          return {
            ...user,
            serverRelation: null,
            aiAgents: []
          };
        }
      }));
      
      return usersWithDetails;
    }
  });

  // Buscar lista de servidores para filtro
  const { data: servers = [] } = useQuery({
    queryKey: ["/api/servers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/servers");
      return await res.json();
    }
  });

  // Buscar lista de agentes IA para filtro
  const { data: allAgents = [] } = useQuery({
    queryKey: ["/api/server-ai-agents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/server-ai-agents");
      return await res.json();
    }
  });

  // Aplicar filtros aos usuários
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((user: any) => {
      // Filtro de busca (nome, email, empresa, username)
      const matchesSearch = searchTerm === "" || 
        (user.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.company?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.username?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro de status
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && user.active) ||
        (statusFilter === "inactive" && !user.active);

      // Filtro de role
      const matchesRole = roleFilter === "all" ||
        (roleFilter === "admin" && user.isAdmin) ||
        (roleFilter === "user" && !user.isAdmin);

      // Filtro de servidor
      const matchesServer = serverFilter === "all" ||
        (user.serverRelation && user.serverRelation.serverId?.toString() === serverFilter) ||
        (serverFilter === "none" && !user.serverRelation);

      // Filtro de agente IA
      const matchesAgent = agentFilter === "all" ||
        (user.aiAgents?.some((agent: any) => agent.agentId?.toString() === agentFilter)) ||
        (agentFilter === "none" && (!user.aiAgents || user.aiAgents.length === 0));

      return matchesSearch && matchesStatus && matchesRole && matchesServer && matchesAgent;
    });
  }, [users, searchTerm, statusFilter, roleFilter, serverFilter, agentFilter]);

  // Reset para página 1 quando filtros mudarem (em useEffect separado)
  React.useEffect(() => {
    if (currentPage > Math.ceil(filteredUsers.length / usersPerPage)) {
      setCurrentPage(1);
    }
  }, [filteredUsers.length, currentPage, usersPerPage]);

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Funções de navegação de páginas
  const goToPage = (page: number) => {
    setCurrentPage(page);
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


  
  // Função para buscar as relações de servidor de um usuário específico
  const getUserServerRelations = async (userId: number) => {
    try {
      const res = await apiRequest("GET", `/api/user-servers/user/${userId}`);
      return await res.json();
    } catch (error) {
      console.error(`Erro ao buscar relações do usuário ${userId}:`, error);
      toast({
        title: "Erro ao buscar relações de servidor",
        description: "Não foi possível obter as relações de servidor deste usuário.",
        variant: "destructive",
      });
      return [];
    }
  };
  
  // Função para buscar os agentes IA associados ao usuário
  const getUserAiAgents = async (userId: number) => {
    try {
      const res = await apiRequest("GET", `/api/users/${userId}/ai-agents`);
      const data = await res.json();
      setUserAiAgents(data);
      return data;
    } catch (error) {
      console.error(`Erro ao buscar agentes IA do usuário ${userId}:`, error);
      toast({
        title: "Erro ao buscar agentes IA",
        description: "Não foi possível obter os agentes IA deste usuário.",
        variant: "destructive",
      });
      return [];
    }
  };
  
  // Função para buscar os agentes IA disponíveis para o servidor que ainda não estão associados ao usuário
  const getAvailableServerAiAgents = async (serverId: number, userId: number) => {
    try {
      if (!serverId || !userId) {
        setAvailableAiAgents([]);
        return [];
      }
      
      const res = await apiRequest("GET", `/api/servers/${serverId}/available-ai-agents/${userId}`);
      const data = await res.json();
      setAvailableAiAgents(data);
      return data;
    } catch (error) {
      console.error(`Erro ao buscar agentes IA disponíveis para o servidor ${serverId}:`, error);
      toast({
        title: "Erro ao buscar agentes IA disponíveis",
        description: "Não foi possível obter os agentes IA disponíveis para este servidor.",
        variant: "destructive",
      });
      return [];
    }
  };

  // Função auxiliar para associar usuário ao servidor
  const updateUserServer = async (userId: number, serverId: number | undefined): Promise<boolean> => {
    try {
      if (!serverId) return false;
      
      // Criar associação na tabela de relações user_servers
      const response = await apiRequest("POST", "/api/user-servers", { userId, serverId });
      const result = await response.json();
      console.log(`Usuário ${userId} associado ao servidor ${serverId}`, result);
      
      return true;
    } catch (error) {
      console.error("Erro ao associar usuário ao servidor:", error);
      return false;
    }
  };

  // Criar um novo usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      const newUser = await res.json();
      
      // Se agentes IA foram selecionados, associá-los ao usuário
      if (selectedAgentIds.length > 0) {
        for (const agentId of selectedAgentIds) {
          await apiRequest("POST", `/api/user-ai-agents`, {
            userId: newUser.id,
            agentId: agentId
          });
        }
      }
      
      return newUser;
    },
    onSuccess: () => {
      // Este onSuccess será chamado automaticamente, mas a lógica principal está no handleCreateUser
      console.log("✅ CreateUserMutation onSuccess disparado");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error) => {
      console.error("Erro detalhado na criação:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar um usuário existente
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: Partial<InsertUser> }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado com sucesso",
        description: "Operação concluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Excluir um usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Usuário excluído com sucesso",
        description: "Operação concluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDeleteOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Atribuir servidor automaticamente para um usuário
  const autoAssignServerMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/admin/auto-assign-server", { userId });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Servidor atribuído automaticamente",
        description: `Usuário conectado ao servidor ${data.server.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atribuir servidor",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função de validação do formulário
  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formValues.username.trim()) {
      errors.push("Nome de usuário é obrigatório");
    }
    
    if (!formValues.email.trim()) {
      errors.push("Email é obrigatório");
    } else if (!/\S+@\S+\.\S+/.test(formValues.email)) {
      errors.push("Email deve ter formato válido");
    }
    
    if (!formValues.password || formValues.password.length < 6) {
      errors.push("Senha deve ter pelo menos 6 caracteres");
    }
    
    if (formValues.password !== formValues.confirmPassword) {
      errors.push("Confirmação de senha não confere");
    }
    
    if (!formValues.serverId) {
      errors.push("Servidor é obrigatório");
    }
    
    return errors;
  };

  // Criar uma instância do WhatsApp para um usuário
  const createWhatsappInstanceMutation = useMutation({
    mutationFn: async ({ userId, webhookUrl }: { userId: number; webhookUrl: string }) => {
      const res = await apiRequest(
        "POST", 
        `/api/admin/users/${userId}/create-whatsapp-instance`, 
        { webhookInstanceUrl: webhookUrl }
      );
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Instância criada com sucesso",
        description: data.message || "A instância do WhatsApp foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      // Limpar o campo após o sucesso
      setInstanceWebhookUrl("");
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message || "Ocorreu um erro ao criar a instância do WhatsApp.",
        variant: "destructive",
      });
    },
  });
  
  // Associar um agente IA a um usuário
  const assignAiAgentMutation = useMutation({
    mutationFn: async ({ userId, agentId, isDefault }: { userId: number; agentId: number; isDefault?: boolean }) => {
      const res = await apiRequest("POST", "/api/user-ai-agents", {
        userId,
        agentId,
        isDefault: isDefault || false
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Agente IA associado com sucesso",
        description: "O agente IA foi associado ao usuário.",
      });
      
      // Se o usuário atual estiver em edição, atualizar a lista de agentes
      if (currentUser) {
        getUserAiAgents(currentUser.id);
        
        // Se tiver um servidor selecionado, atualizar a lista de agentes disponíveis
        if (formValues.serverId) {
          getAvailableServerAiAgents(formValues.serverId, currentUser.id);
        }
      }
      
      // Invalidar o cache para garantir atualização automática na interface
      queryClient.invalidateQueries({ 
        queryKey: ["/api/servers", formValues.serverId, "available-ai-agents", currentUser?.id].filter(Boolean)
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/users", currentUser?.id, "ai-agents"].filter(Boolean)
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao associar agente IA",
        description: error.message || "Ocorreu um erro ao associar o agente IA ao usuário.",
        variant: "destructive",
      });
    },
  });
  
  // Remover a associação de um agente IA com um usuário
  const removeAiAgentMutation = useMutation({
    mutationFn: async (userAgentId: number) => {
      await apiRequest("DELETE", `/api/user-ai-agents/${userAgentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Agente IA removido com sucesso",
        description: "O agente IA foi removido do usuário.",
      });
      
      // Se o usuário atual estiver em edição, atualizar a lista de agentes
      if (currentUser) {
        getUserAiAgents(currentUser.id);
        
        // Se tiver um servidor selecionado, atualizar a lista de agentes disponíveis
        if (formValues.serverId) {
          getAvailableServerAiAgents(formValues.serverId, currentUser.id);
        }
      }
      
      // Invalidar o cache para garantir atualização automática na interface
      queryClient.invalidateQueries({ 
        queryKey: ["/api/servers", formValues.serverId, "available-ai-agents", currentUser?.id].filter(Boolean)
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/users", currentUser?.id, "ai-agents"].filter(Boolean)
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover agente IA",
        description: error.message || "Ocorreu um erro ao remover o agente IA do usuário.",
        variant: "destructive",
      });
    },
  });
  
  // Definir um agente IA como padrão para o usuário
  const setDefaultAiAgentMutation = useMutation({
    mutationFn: async (userAgentId: number) => {
      const res = await apiRequest("POST", `/api/user-ai-agents/${userAgentId}/set-default`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Agente IA padrão definido",
        description: "O agente IA foi definido como padrão para o usuário.",
      });
      
      // Se o usuário atual estiver em edição, atualizar a lista de agentes
      if (currentUser) {
        getUserAiAgents(currentUser.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao definir agente IA padrão",
        description: error.message || "Ocorreu um erro ao definir o agente IA como padrão.",
        variant: "destructive",
      });
    },
  });
  
  // Ativar/Desativar usuário
  const toggleUserActiveMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/toggle-active`);
      return await res.json();
    },
    onSuccess: (data) => {
      const statusText = data.active ? "ativado" : "desativado";
      toast({
        title: `Usuário ${statusText} com sucesso`,
        description: data.message || `O usuário foi ${statusText} com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao alterar status do usuário",
        description: error.message || "Ocorreu um erro ao alterar o status do usuário.",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = async () => {
    // Debug dos valores do formulário
    console.log("🔍 Valores do formulário:", {
      username: formValues.username,
      email: formValues.email,
      name: formValues.name,
      company: formValues.company,
      serverId: formValues.serverId,
      password: formValues.password ? '***' : 'VAZIO'
    });

    // Validação simples dos campos obrigatórios (serverId não é obrigatório se atribuição automática)
    if (!formValues.username || !formValues.email || !formValues.name || !formValues.company || !formValues.phone || !formValues.password) {
      const camposFaltando = [];
      if (!formValues.username) camposFaltando.push("Username");
      if (!formValues.email) camposFaltando.push("Email");
      if (!formValues.name) camposFaltando.push("Nome");
      if (!formValues.company) camposFaltando.push("Empresa");
      if (!formValues.phone) camposFaltando.push("Telefone");
      if (!formValues.password) camposFaltando.push("Senha");
      
      console.log("❌ Campos faltando:", camposFaltando);
      
      toast({
        title: "Campos obrigatórios em falta",
        description: `Faltam: ${camposFaltando.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validar senhas
    if (formValues.password !== formValues.confirmPassword) {
      toast({
        title: "Erro de validação",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    const userData = {
      ...formValues,
      password: formValues.password || "",
    };

    // Armazenar o serverId antes de removê-lo do objeto userData
    const selectedServerId = formValues.serverId;

    delete userData.confirmPassword;
    delete userData.serverId; // Removemos serverId e tratamos a associação em outra rota
    
    try {
      // Criar o usuário primeiro
      const newUser = await createUserMutation.mutateAsync(userData as InsertUser);
      
      if (newUser && newUser.id) {
        let finalServerId = selectedServerId;
        
        // Se um servidor foi selecionado manualmente, associar o usuário a este servidor
        if (selectedServerId) {
          console.log(`✅ Servidor selecionado manualmente: ${selectedServerId}. Associando usuário ${newUser.id}.`);
          
          try {
            // Associar ao servidor selecionado
            await updateUserServer(newUser.id, selectedServerId);
            
            toast({
              title: "Usuário criado com sucesso",
              description: `Usuário ${newUser.username} criado e associado ao servidor selecionado.`,
            });
            
            // Invalidar queries para atualizar dados
            queryClient.invalidateQueries({ queryKey: ["/api/user-servers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-servers", selectedServerId] });
          } catch (error) {
            console.error("Erro ao associar servidor ao novo usuário:", error);
            toast({
              title: "Erro ao associar servidor",
              description: "O usuário foi criado, mas não foi possível associá-lo ao servidor.",
              variant: "destructive",
            });
          }
        } else {
          console.log(`⚠️ Nenhum servidor selecionado. Tentando atribuição automática para usuário ${newUser.id}.`);
          // Se nenhum servidor foi selecionado, atribuir automaticamente ao servidor com menos usuários
          try {
            // Chamar a API para atribuir automaticamente
            const response = await apiRequest("POST", "/api/admin/auto-assign-server", { userId: newUser.id });
            const assignResult = await response.json();
            
            finalServerId = assignResult.server.id;
            
            toast({
              title: "Servidor atribuído automaticamente",
              description: `Usuário conectado ao servidor ${assignResult.server.name}`,
            });
            
            // Invalidar queries para atualizar dados
            queryClient.invalidateQueries({ queryKey: ["/api/user-servers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
            if (assignResult.server?.id) {
              queryClient.invalidateQueries({ queryKey: ["/api/user-servers", assignResult.server.id] });
            }
          } catch (error) {
            console.error("Erro ao atribuir servidor automaticamente:", error);
            
            // Verificar se o erro é por usuário não encontrado (que pode acontecer se usuário foi excluído)
            const errorResponse = error as any;
            if (errorResponse?.status === 404) {
              console.log("Usuário não encontrado para atribuição automática, possivelmente foi excluído");
              // Não mostrar toast de erro para este caso específico
            } else {
              toast({
                title: "Erro ao atribuir servidor",
                description: "O usuário foi criado, mas não foi possível atribuir automaticamente um servidor.",
                variant: "destructive",
              });
            }
          }
        }
        
        // Fechar o modal e resetar o formulário
        setIsCreateOpen(false);
        resetForm();
        
        // Invalidar queries para recarregar a lista
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      }
    } catch (error) {
      console.error("Erro detalhado na criação:", error);
      
      let errorMessage = "Erro desconhecido";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Tentar extrair mensagem de erro do objeto
        const errorObj = error as any;
        if (errorObj.response?.data?.message) {
          errorMessage = errorObj.response.data.message;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }
      
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Erro ao criar usuário",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Em caso de erro, fechar o modal
      setIsCreateOpen(false);
      resetForm();
    }
  };
  
  // Função para resetar o formulário
  const resetForm = () => {
    setFormValues({
      username: "",
      email: "",
      name: "",
      company: "",
      phone: "",
      bio: "",
      availableTokens: 1000,
      tokenExpirationDays: 30,
      monthlyFee: "0",
      serverId: undefined,
      isAdmin: false,
      // Controles de acesso a módulos
      accessDashboard: true,
      accessLeads: true,
      accessProspecting: true,
      accessAiAgent: true,
      accessWhatsapp: true,
      accessContacts: true,
      accessScheduling: true,
      accessReports: true,
      accessSettings: true
    });
    setSelectedAgentIds([]);
  };
  
  // Função para finalizar o processo de criação
  const finishUserCreation = () => {
    setIsCreateOpen(false);
    resetForm();
    
    toast({
      title: "Usuário criado com sucesso",
      description: "O usuário foi criado e configurado completamente.",
    });
  };

  const handleUpdateUser = async () => {
    if (!currentUser) return;

    const userData: Partial<InsertUser> = { ...formValues };
    
    // Apenas incluir senha se for alterada
    if (!formValues.password) {
      delete userData.password;
    } else if (formValues.password !== formValues.confirmPassword) {
      toast({
        title: "Erro de validação",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    delete userData.confirmPassword;
    
    // Salvar o serverId no objeto userData para atualizar o servidor principal do usuário
    // Isso é importante para manter a compatibilidade com funcionalidades existentes
    const serverId = formValues.serverId;
    
    // Tratar as associações de servidor em uma função separada
    const updateServerRelations = async () => {
      try {
        // Buscar relações atuais do usuário com servidores
        const userServerRelations = await getUserServerRelations(currentUser.id);
        console.log("Relações atuais do usuário:", userServerRelations);
        
        // Remover todas as associações existentes
        if (userServerRelations && userServerRelations.length > 0) {
          for (const relation of userServerRelations) {
            await apiRequest("DELETE", `/api/user-servers/relation/${relation.id}`);
            console.log(`Removida relação ${relation.id} do usuário ${currentUser.id} com servidor ${relation.serverId}`);
          }
          console.log("Associações anteriores removidas com sucesso");
        }
        
        // Se um novo servidor foi selecionado, criar a associação
        if (serverId) {
          await apiRequest("POST", "/api/user-servers", { 
            userId: currentUser.id, 
            serverId: serverId 
          });
          
          console.log(`Usuário ${currentUser.id} associado ao servidor ${serverId}`);
          
          toast({
            title: "Servidor associado com sucesso",
            description: "O usuário foi associado ao servidor selecionado.",
          });
        }
        
        // Invalidar todas as consultas necessárias para atualizar os dados em ambas as páginas
        queryClient.invalidateQueries({ queryKey: ["/api/user-servers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
        // Para invalidar queries específicas de servidor, incluindo a nova
        if (serverId) {
          queryClient.invalidateQueries({ queryKey: ["/api/user-servers", serverId] });
        }
        // Para invalidar queries específicas da relação anterior
        if (currentUser.serverId) {
          queryClient.invalidateQueries({ queryKey: ["/api/user-servers", currentUser.serverId] });
        }
        
        // Também atualizar o serverId no objeto de usuário para manter consistência
        await apiRequest("POST", "/api/user/select-server", { serverId });
        
      } catch (error) {
        console.error("Erro ao gerenciar associações de servidor:", error);
        toast({
          title: "Erro ao gerenciar servidores",
          description: "Ocorreu um erro ao atualizar as associações de servidor.",
          variant: "destructive",
        });
      }
    };
    
    // Primeiro salvar os dados do usuário
    await updateUserMutation.mutateAsync({ id: currentUser.id, userData });
    
    // Se houve mudança no servidor, fazer uma chamada separada para associar o servidor
    if (serverId !== currentUser.serverId) {
      await updateServerRelations();
    }
    
    // Invalidar os dados de usuários para atualizar a interface
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
  };

  const handleDeleteUser = () => {
    if (!currentUser) return;
    deleteUserMutation.mutate(currentUser.id);
  };



  const handleEditUser = async (user: UserType) => {
    setCurrentUser(user);
    
    // Buscar as relações de servidor deste usuário
    try {
      const userServerRelations = await getUserServerRelations(user.id);
      console.log(`Relações de servidor do usuário ${user.id}:`, userServerRelations);
      
      // Definir o serverId no formulário com base na primeira relação encontrada (se houver)
      const serverId = userServerRelations.length > 0 
        ? userServerRelations[0].serverId 
        : user.serverId || undefined;
      
      // Carregar os agentes IA do usuário
      getUserAiAgents(user.id);
      
      // Se o usuário tem um servidor associado, carregar agentes IA disponíveis
      if (serverId) {
        getAvailableServerAiAgents(serverId, user.id);
      }
      
      setFormValues({
        username: user.username,
        email: user.email,
        name: user.name || "",
        company: user.company || "",
        phone: user.phone || "",
        bio: user.bio || "",
        availableTokens: user.availableTokens || 0,
        tokenExpirationDays: user.tokenExpirationDays || 30,
        monthlyFee: user.monthlyFee || "0",
        serverId: serverId,
        isAdmin: user.isAdmin || false,
        // Controles de acesso a módulos
        accessDashboard: user.accessDashboard ?? true,
        accessLeads: user.accessLeads ?? true,
        accessProspecting: user.accessProspecting ?? true,
        accessAiAgent: user.accessAiAgent ?? true,
        accessWhatsapp: user.accessWhatsapp ?? true,
        accessContacts: user.accessContacts ?? true,
        accessScheduling: user.accessScheduling ?? true,
        accessReports: user.accessReports ?? true,
        accessSettings: user.accessSettings ?? true
      });
      
    } catch (error) {
      console.error("Erro ao buscar relações de servidor:", error);
      // Fallback para o método antigo se ocorrer um erro
      setFormValues({
        username: user.username,
        email: user.email,
        name: user.name || "",
        company: user.company || "",
        phone: user.phone || "",
        bio: user.bio || "",
        availableTokens: user.availableTokens || 0,
        tokenExpirationDays: user.tokenExpirationDays || 30,
        monthlyFee: user.monthlyFee || "0",
        serverId: user.serverId || undefined,
        isAdmin: user.isAdmin || false,
        // Controles de acesso a módulos
        accessDashboard: user.accessDashboard ?? true,
        accessLeads: user.accessLeads ?? true,
        accessProspecting: user.accessProspecting ?? true,
        accessAiAgent: user.accessAiAgent ?? true,
        accessWhatsapp: user.accessWhatsapp ?? true,
        accessContacts: user.accessContacts ?? true,
        accessScheduling: user.accessScheduling ?? true,
        accessReports: user.accessReports ?? true,
        accessSettings: user.accessSettings ?? true
      });
    }
    
    setIsEditOpen(true);
  };

  const handleDeleteDialog = (user: UserType) => {
    setCurrentUser(user);
    setIsDeleteOpen(true);
  };
  
  const handleManagePermissions = (user: UserType) => {
    setCurrentUser(user);
    setIsPermissionsDialogOpen(true);
  };
  
  // Função para ativar/desativar um usuário
  const handleToggleUserActive = (user: UserType) => {
    toggleUserActiveMutation.mutate(user.id);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "number") {
      setFormValues({ ...formValues, [name]: parseInt(value) });
    } else {
      setFormValues({ ...formValues, [name]: value });
    }
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormValues({ ...formValues, [name]: checked });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === "serverId") {
      setFormValues({ ...formValues, [name]: parseInt(value) });
    } else {
      setFormValues({ ...formValues, [name]: value });
    }
  };
  
  // Função para criar instância de WhatsApp
  const handleCreateWhatsappInstance = () => {
    if (!currentUser) return;
    
    if (!instanceWebhookUrl) {
      toast({
        title: "Erro de validação",
        description: "A URL do webhook da instância é obrigatória",
        variant: "destructive",
      });
      return;
    }
    
    createWhatsappInstanceMutation.mutate({
      userId: currentUser.id,
      webhookUrl: instanceWebhookUrl
    });
  };
  
  // Função para lidar com a adição de um agente IA ao usuário
  const handleAddAiAgent = (agentId: number) => {
    if (!currentUser) return;
    
    // Confirmar se o usuário quer adicionar o agente
    const shouldAddAsDefault = userAiAgents.length === 0;
    
    // Associar o agente ao usuário
    assignAiAgentMutation.mutate({ 
      userId: currentUser.id, 
      agentId, 
      isDefault: shouldAddAsDefault 
    });
  };
  
  // Função para lidar com a remoção de um agente IA do usuário
  const handleRemoveAiAgent = (userAgentId: number) => {
    if (!currentUser) return;
    
    removeAiAgentMutation.mutate(userAgentId);
  };
  
  // Função para definir um agente IA como padrão para o usuário
  const handleSetDefaultAiAgent = (userAgentId: number) => {
    if (!currentUser) return;
    
    setDefaultAiAgentMutation.mutate(userAgentId);
  };

  // Função para exportar usuários para Excel
  const handleExportToExcel = async () => {
    if (!users || users.length === 0) {
      toast({
        title: "Nenhum usuário para exportar",
        description: "Não há usuários disponíveis para exportação.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Importar XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      // Preparar dados para exportação
      const dataToExport = users.map((user) => ({
        ID: user.id,
        'Nome de Usuário': user.username,
        'Email': user.email,
        'Nome Completo': user.name || '',
        'Empresa': user.company || '',
        'Telefone': user.phone || '',
        'Biografia': user.bio || '',
        'É Admin': user.isAdmin ? 'Sim' : 'Não',
        'Status': user.active ? 'Ativo' : 'Inativo',
        'Tokens Disponíveis': user.availableTokens || 0,
        'Dias para Expirar Tokens': user.tokenExpirationDays || 0,
        'Mensalidade (R$)': user.monthlyFee || '0',
        'Servidor ID': user.serverId || '',
        'Acesso Dashboard': user.accessDashboard ? 'Sim' : 'Não',
        'Acesso Leads': user.accessLeads ? 'Sim' : 'Não',
        'Acesso Prospecção': user.accessProspecting ? 'Sim' : 'Não',
        'Acesso Agente IA': user.accessAiAgent ? 'Sim' : 'Não',
        'Acesso WhatsApp': user.accessWhatsapp ? 'Sim' : 'Não',
        'Acesso Contatos': user.accessContacts ? 'Sim' : 'Não',
        'Acesso Agendamento': user.accessScheduling ? 'Sim' : 'Não',
        'Acesso Relatórios': user.accessReports ? 'Sim' : 'Não',
        'Acesso Configurações': user.accessSettings ? 'Sim' : 'Não',
        'Data de Criação': user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : ''
      }));

      // Criar workbook e worksheet
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuários');
      
      // Ajustar larguras das colunas
      const columnWidths = [
        { wch: 10 }, // ID
        { wch: 20 }, // Nome de Usuário
        { wch: 30 }, // Email
        { wch: 25 }, // Nome Completo
        { wch: 20 }, // Empresa
        { wch: 15 }, // Telefone
        { wch: 30 }, // Biografia
        { wch: 10 }, // É Admin
        { wch: 10 }, // Status
        { wch: 15 }, // Tokens Disponíveis
        { wch: 20 }, // Dias para Expirar Tokens
        { wch: 15 }, // Mensalidade
        { wch: 12 }, // Servidor ID
        { wch: 15 }, // Acesso Dashboard
        { wch: 12 }, // Acesso Leads
        { wch: 15 }, // Acesso Prospecção
        { wch: 15 }, // Acesso Agente IA
        { wch: 15 }, // Acesso WhatsApp
        { wch: 15 }, // Acesso Contatos
        { wch: 18 }, // Acesso Agendamento
        { wch: 15 }, // Acesso Relatórios
        { wch: 18 }, // Acesso Configurações
        { wch: 15 }  // Data de Criação
      ];
      
      worksheet['!cols'] = columnWidths;
      
      // Gerar nome do arquivo com data e hora
      const now = new Date();
      const fileName = `usuarios_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
      
      // Fazer download do arquivo
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: "Exportação concluída",
        description: `Arquivo ${fileName} baixado com sucesso com ${users.length} usuários.`,
      });
      
    } catch (error) {
      console.error("Erro ao exportar usuários:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os usuários para Excel.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie todos os usuários do sistema e suas configurações
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportToExcel}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
        </div>
        </div>

        {/* Filtros de busca */}
        <Card className="shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Campo de busca */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, email, empresa ou username..."
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
                
                {/* Filtro de Tipo */}
                <div className="w-full sm:w-40">
                  <Select value={roleFilter} onValueChange={(value: "all" | "admin" | "user") => setRoleFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Filtro de Servidor */}
                <div className="w-full sm:w-40">
                  <Select value={serverFilter} onValueChange={setServerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Servidor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="none">Sem servidor</SelectItem>
                      {servers.map((server: any) => (
                        <SelectItem key={server.id} value={server.id.toString()}>
                          {server.name || `Servidor ${server.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Filtro de Agente IA */}
                <div className="w-full sm:w-40">
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Agente IA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="none">Sem agente</SelectItem>
                      {allAgents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name || `Agente ${agent.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Contador de resultados */}
                <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                  <Filter className="h-4 w-4 mr-2" />
                  {filteredUsers.length} de {users.length} usuários
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Servidor</TableHead>
                    <TableHead>Agente IA</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Mensalidade</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        {filteredUsers.length === 0 
                          ? (users.length === 0 
                              ? "Nenhum usuário encontrado. Crie o primeiro usuário."
                              : "Nenhum usuário corresponde aos filtros aplicados.")
                          : "Nenhum usuário encontrado nesta página."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user: UserType) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.company || "-"}</TableCell>
                        <TableCell>
                          {user.serverRelation ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {user.serverRelation.serverName || `Servidor ${user.serverRelation.serverId}`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Sem servidor
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.aiAgents && user.aiAgents.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.aiAgents.slice(0, 2).map((agent: any, index: number) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  {agent.agentName || `Agente ${agent.agentId}`}
                                  {agent.isDefault && <span className="ml-1">★</span>}
                                </span>
                              ))}
                              {user.aiAgents.length > 2 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  +{user.aiAgents.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Sem agente
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Não
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.active !== false ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Inativo
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{user.availableTokens || 0}</TableCell>
                        <TableCell>R$ {user.monthlyFee || "0"}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleToggleUserActive(user)}
                              >
                                {user.active !== false ? (
                                  <>
                                    <UserIcon className="mr-2 h-4 w-4 text-red-500" />
                                    Desativar Usuário
                                  </>
                                ) : (
                                  <>
                                    <UserIcon className="mr-2 h-4 w-4 text-green-500" />
                                    Ativar Usuário
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteDialog(user)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
          
          {/* Controles de Paginação */}
          {filteredUsers.length > usersPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuários
              </div>
              
              <div className="flex items-center gap-2">
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
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className={currentPage === page ? "bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-600 hover:to-yellow-500 text-white border-0" : ""}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                
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
        </Card>

        {/* Modal de confirmação para excluir usuário */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Confirmar exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza de que deseja excluir o usuário <strong>{currentUser?.name || currentUser?.username}</strong>? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteOpen(false)}
                disabled={deleteUserMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteUser}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Excluindo...
                  </>
                ) : (
                  "Excluir Usuário"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para criar novo usuário */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar um novo usuário no sistema.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="server">Servidor</TabsTrigger>
                <TabsTrigger value="permissions">Permissões</TabsTrigger>
                <TabsTrigger value="advanced">Configurações Avançadas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="flex items-center gap-1">
                      Nome de Usuário
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      value={formValues.username}
                      onChange={handleInputChange}
                      required
                      className={!formValues.username.trim() ? "border-red-300" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1">
                      Email
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleInputChange}
                      required
                      className={(!formValues.email.trim() || !/\S+@\S+\.\S+/.test(formValues.email)) ? "border-red-300" : ""}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-1">
                      Senha
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formValues.password || ""}
                      onChange={handleInputChange}
                      required
                      className={(!formValues.password || formValues.password.length < 6) ? "border-red-300" : ""}
                    />
                    {formValues.password && formValues.password.length < 6 && (
                      <p className="text-sm text-red-500">A senha deve ter pelo menos 6 caracteres</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="flex items-center gap-1">
                      Confirmar Senha
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formValues.confirmPassword || ""}
                      onChange={handleInputChange}
                      required
                      className={(formValues.password !== formValues.confirmPassword) ? "border-red-300" : ""}
                    />
                    {formValues.confirmPassword && formValues.password !== formValues.confirmPassword && (
                      <p className="text-sm text-red-500">As senhas não conferem</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1">
                      Nome Completo
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formValues.name}
                      onChange={handleInputChange}
                      required
                      className={!formValues.name ? "border-red-300" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company" className="flex items-center gap-1">
                      Empresa
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="company"
                      name="company"
                      value={formValues.company}
                      onChange={handleInputChange}
                      required
                      className={!formValues.company ? "border-red-300" : ""}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1">
                      Telefone
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formValues.phone}
                      onChange={handleInputChange}
                      required
                      className={!formValues.phone ? "border-red-300" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Biografia</Label>
                    <Input
                      id="bio"
                      name="bio"
                      value={formValues.bio}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isAdmin"
                    checked={formValues.isAdmin}
                    onCheckedChange={(checked) => handleSwitchChange("isAdmin", checked)}
                  />
                  <Label htmlFor="isAdmin">Usuário é administrador</Label>
                </div>
              </TabsContent>
              
              <TabsContent value="server" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverId" className="flex items-center gap-1">
                    Servidor
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2 mb-2">
                    <Select 
                      onValueChange={(value) => handleSelectChange("serverId", value)}
                      value={formValues.serverId?.toString() || ""}
                      className="flex-1"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um servidor" />
                      </SelectTrigger>
                      <SelectContent>
                        {servers.length === 0 ? (
                          <div className="p-2 text-center text-sm text-gray-500">
                            Nenhum servidor disponível. Adicione um servidor primeiro.
                          </div>
                        ) : (
                          servers.map((server) => (
                            <SelectItem 
                              key={server.id} 
                              value={server.id.toString()}
                            >
                              {server.name} ({server.provider})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      type="button"
                      variant="outline"
                      disabled={autoAssignServerMutation.isPending}
                      onClick={async () => {
                        if (currentUser) {
                          // Para usuário existente, usar API de atribuição automática
                          autoAssignServerMutation.mutate(currentUser.id);
                        } else {
                          // Para criação de usuário, selecionar servidor com menos usuários
                          try {
                            const response = await apiRequest("GET", "/api/servers/users-count");
                            const serversCount = await response.json();
                            
                            if (serversCount.length > 0) {
                              // Encontrar servidor com menos usuários que não esteja lotado
                              const availableServers = servers.filter(server => {
                                const serverCount = serversCount.find(sc => sc.serverId === server.id);
                                const currentUsers = serverCount ? serverCount.userCount : 0;
                                return currentUsers < (server.maxUsers || 999);
                              });
                              
                              if (availableServers.length > 0) {
                                // Ordenar por quantidade de usuários (maior primeiro) - dar preferência ao mais próximo da lotação
                                const sortedServers = availableServers.sort((a, b) => {
                                  const aCount = serversCount.find(sc => sc.serverId === a.id)?.userCount || 0;
                                  const bCount = serversCount.find(sc => sc.serverId === b.id)?.userCount || 0;
                                  return bCount - aCount; // Invertido para dar preferência ao mais lotado
                                });
                                
                                const bestServer = sortedServers[0];
                                console.log("Servidor selecionado automaticamente:", bestServer);
                                setFormValues({ ...formValues, serverId: bestServer.id });
                                
                                toast({
                                  title: "Servidor atribuído automaticamente",
                                  description: `Selecionado: ${bestServer.name} (${bestServer.provider})`,
                                });
                              } else {
                                toast({
                                  title: "Nenhum servidor disponível",
                                  description: "Todos os servidores estão com capacidade máxima.",
                                  variant: "destructive",
                                });
                              }
                            }
                          } catch (error) {
                            console.error("Erro ao buscar servidores:", error);
                            toast({
                              title: "Erro ao atribuir servidor",
                              description: "Não foi possível buscar os servidores disponíveis.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      className="flex gap-1 items-center"
                    >
                      {autoAssignServerMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      ) : (
                        <svg 
                          className="h-4 w-4" 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                          <line x1="6" y1="6" x2="6.01" y2="6"></line>
                          <line x1="6" y1="18" x2="6.01" y2="18"></line>
                        </svg>
                      )}
                      Atribuir automaticamente
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    O servidor selecionado será usado para todas as operações deste usuário.
                    Use a atribuição automática para conectar ao servidor com menos usuários.
                  </p>
                </div>

                {/* Seleção de Agentes IA */}
                {formValues.serverId && (
                  <div className="space-y-2">
                    <Label>Agentes IA (Opcional)</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                      {availableAgentsForCreation.length === 0 ? (
                        <div className="text-center text-sm text-gray-500 py-2">
                          Nenhum agente IA disponível
                        </div>
                      ) : (
                        availableAgentsForCreation.map((agent: any) => (
                          <div key={agent.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`agent-${agent.id}`}
                              checked={selectedAgentIds.includes(agent.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAgentIds([...selectedAgentIds, agent.id]);
                                } else {
                                  setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.id));
                                }
                              }}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <label 
                              htmlFor={`agent-${agent.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                            >
                              <Bot className="h-4 w-4 text-orange-500" />
                              {agent.name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecione um ou mais agentes IA para associar automaticamente ao usuário. Estas associações podem ser alteradas posteriormente.
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="permissions" className="space-y-4">
                <ModulePermissions
                  permissions={{
                    accessDashboard: formValues.accessDashboard,
                    accessLeads: formValues.accessLeads,
                    accessProspecting: formValues.accessProspecting,
                    accessAiAgent: formValues.accessAiAgent,
                    accessWhatsapp: formValues.accessWhatsapp,
                    accessContacts: formValues.accessContacts,
                    accessScheduling: formValues.accessScheduling,
                    accessReports: formValues.accessReports,
                    accessSettings: formValues.accessSettings,
                  }}
                  onChange={(newPermissions) => {
                    setFormValues({ ...formValues, ...newPermissions });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="availableTokens">Tokens Disponíveis</Label>
                    <Input
                      id="availableTokens"
                      name="availableTokens"
                      type="number"
                      min="0"
                      value={formValues.availableTokens}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenExpirationDays">Expiração de Tokens (dias)</Label>
                    <Input
                      id="tokenExpirationDays"
                      name="tokenExpirationDays"
                      type="number"
                      min="1"
                      value={formValues.tokenExpirationDays}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monthlyFee">Valor da Mensalidade (R$)</Label>
                  <Input
                    id="monthlyFee"
                    name="monthlyFee"
                    type="text"
                    value={formValues.monthlyFee}
                    onChange={handleInputChange}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
              >
                {createUserMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Criando...
                  </>
                ) : (
                  "Criar Usuário"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para editar usuário */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do usuário.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="server">Servidor</TabsTrigger>
                <TabsTrigger value="permissions">Permissões</TabsTrigger>
                <TabsTrigger value="advanced">Configurações Avançadas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username-edit">Nome de Usuário</Label>
                    <Input
                      id="username-edit"
                      name="username"
                      value={formValues.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-edit">Email</Label>
                    <Input
                      id="email-edit"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password-edit">Senha (deixe em branco para manter)</Label>
                    <Input
                      id="password-edit"
                      name="password"
                      type="password"
                      value={formValues.password || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword-edit">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword-edit"
                      name="confirmPassword"
                      type="password"
                      value={formValues.confirmPassword || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-edit">Nome Completo</Label>
                    <Input
                      id="name-edit"
                      name="name"
                      value={formValues.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-edit">Empresa</Label>
                    <Input
                      id="company-edit"
                      name="company"
                      value={formValues.company}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-edit">Telefone</Label>
                    <Input
                      id="phone-edit"
                      name="phone"
                      value={formValues.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio-edit">Biografia</Label>
                    <Input
                      id="bio-edit"
                      name="bio"
                      value={formValues.bio}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isAdmin-edit"
                    checked={formValues.isAdmin}
                    onCheckedChange={(checked) => handleSwitchChange("isAdmin", checked)}
                  />
                  <Label htmlFor="isAdmin-edit">Usuário é administrador</Label>
                </div>
              </TabsContent>
              
              <TabsContent value="server" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverId-edit">Servidor</Label>
                  <Select 
                    onValueChange={(value) => {
                      const serverId = parseInt(value);
                      handleSelectChange("serverId", value);
                      
                      // Ao mudar o servidor, buscar os agentes IA disponíveis
                      if (currentUser && serverId) {
                        getAvailableServerAiAgents(serverId, currentUser.id);
                      }
                    }}
                    value={formValues.serverId?.toString() || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um servidor" />
                    </SelectTrigger>
                    <SelectContent>
                      {servers.length === 0 ? (
                        <div className="p-2 text-center text-sm text-gray-500">
                          Nenhum servidor disponível. Adicione um servidor primeiro.
                        </div>
                      ) : (
                        servers.map((server) => (
                          <SelectItem 
                            key={server.id} 
                            value={server.id.toString()}
                          >
                            {server.name} ({server.provider})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    O servidor selecionado será usado para todas as operações deste usuário.
                  </p>
                </div>
                
                {/* Lista de agentes de IA do usuário */}
                {currentUser && (
                  <div className="mt-6 border rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Agentes de IA deste Usuário</h3>
                    </div>
                    
                    {userAiAgents.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                        Este usuário não tem agentes de IA associados.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userAiAgents.map((userAgent) => (
                          <div
                            key={userAgent.id}
                            className={`flex items-center justify-between p-3 border rounded-md ${
                              userAgent.isDefault ? "bg-primary/5 border-primary/20" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span role="img" aria-label="AI">🤖</span>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium">{userAgent.name || userAgent.agentName}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {userAgent.isDefault && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary mr-2">
                                      Padrão
                                    </span>
                                  )}
                                  ID: {userAgent.agentId}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!userAgent.isDefault && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetDefaultAiAgent(userAgent.id)}
                                >
                                  Definir como Padrão
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveAiAgent(userAgent.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Lista de agentes disponíveis para adicionar */}
                    {formValues.serverId && availableAiAgents.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-md font-medium mb-3">Agentes de IA Disponíveis</h3>
                        <div className="space-y-2">
                          {availableAiAgents.map((agent) => (
                            <div
                              key={agent.id}
                              className="flex items-center justify-between p-3 border rounded-md"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <span role="img" aria-label="AI">🤖</span>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-medium">{agent.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {agent.description || "Sem descrição"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddAiAgent(agent.id)}
                              >
                                Adicionar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="permissions" className="space-y-4">
                <ModulePermissions
                  permissions={{
                    accessDashboard: formValues.accessDashboard,
                    accessLeads: formValues.accessLeads,
                    accessProspecting: formValues.accessProspecting,
                    accessAiAgent: formValues.accessAiAgent,
                    accessWhatsapp: formValues.accessWhatsapp,
                    accessContacts: formValues.accessContacts,
                    accessScheduling: formValues.accessScheduling,
                    accessReports: formValues.accessReports,
                    accessSettings: formValues.accessSettings,
                  }}
                  onChange={(newPermissions) => {
                    setFormValues({ ...formValues, ...newPermissions });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="availableTokens-edit">Tokens Disponíveis</Label>
                    <Input
                      id="availableTokens-edit"
                      name="availableTokens"
                      type="number"
                      min="0"
                      value={formValues.availableTokens}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenExpirationDays-edit">Expiração de Tokens (dias)</Label>
                    <Input
                      id="tokenExpirationDays-edit"
                      name="tokenExpirationDays"
                      type="number"
                      min="1"
                      value={formValues.tokenExpirationDays}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monthlyFee-edit">Valor da Mensalidade (R$)</Label>
                  <Input
                    id="monthlyFee-edit"
                    name="monthlyFee"
                    type="text"
                    value={formValues.monthlyFee}
                    onChange={handleInputChange}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsEditOpen(false)}
                disabled={updateUserMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isPending}
                className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
              >
                {updateUserMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        {/* Dialog para gerenciar permissões */}
        <UserPermissionsDialog
          user={currentUser}
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
        />


      </div>
  );
}