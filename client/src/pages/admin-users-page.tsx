import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, Users, MoreHorizontal, KeySquare, User as UserIcon, Bot } from "lucide-react";
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

  // Buscar todos os usuários
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      const data = await res.json();
      return data;
    }
  });

  // Buscar todos os servidores disponíveis
  const { data: servers = [], isLoading: isLoadingServers } = useQuery<Server[]>({
    queryKey: ["/api/servers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/servers");
      return res.json();
    }
  });
  
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
            toast({
              title: "Erro ao atribuir servidor",
              description: "O usuário foi criado, mas não foi possível atribuir automaticamente um servidor.",
              variant: "destructive",
            });
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
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
        </div>

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
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Mensalidade</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Nenhum usuário encontrado. Crie o primeiro usuário.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: UserType) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.company || "-"}</TableCell>
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
                        {isLoadingServers ? (
                          <div className="flex justify-center p-2">
                            Carregando servidores...
                          </div>
                        ) : servers.length === 0 ? (
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
                      {isLoadingServers ? (
                        <div className="flex justify-center p-2">
                          Carregando servidores...
                        </div>
                      ) : servers.length === 0 ? (
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