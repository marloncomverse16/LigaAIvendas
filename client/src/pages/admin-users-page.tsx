import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, Users, MoreHorizontal, KeySquare } from "lucide-react";
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
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { InsertUser, User } from "@shared/schema";
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

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWhatsAppInstanceDialogOpen, setIsWhatsAppInstanceDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  
  // Estado para o formulário de criação de instância WhatsApp
  const [instanceWebhookUrl, setInstanceWebhookUrl] = useState("");

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

  // Criar um novo usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário criado com sucesso",
        description: "Operação concluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
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

  const handleCreateUser = () => {
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

    delete userData.confirmPassword;
    delete userData.serverId; // Removemos serverId e tratamos a associação em outra rota
    createUserMutation.mutate(userData as InsertUser);
  };

  const handleUpdateUser = () => {
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
    delete userData.serverId; // Removemos serverId e tratamos a associação em outra rota

    // Se houve mudança no servidor, fazer uma chamada separada para associar o servidor
    if (formValues.serverId !== currentUser.serverId) {
      // Buscar a relação atual do usuário com servidores (pode haver várias)
      const getUserServerRelations = async () => {
        try {
          const res = await apiRequest("GET", `/api/user-servers/user/${currentUser.id}`);
          const userServerRelations = await res.json();
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
          if (formValues.serverId) {
            await apiRequest("POST", "/api/user-servers", { 
              userId: currentUser.id, 
              serverId: formValues.serverId 
            });
            
            console.log(`Usuário ${currentUser.id} associado ao servidor ${formValues.serverId}`);
            
            toast({
              title: "Servidor associado com sucesso",
              description: "O usuário foi associado ao servidor selecionado.",
            });
          }
          
          // Invalidar todas as consultas necessárias para atualizar os dados em ambas as páginas
          queryClient.invalidateQueries({ queryKey: ["/api/user-servers"] });
          queryClient.invalidateQueries({ queryKey: ["/api/servers/users-count"] });
          // Para invalidar queries específicas de servidor, incluindo a nova
          if (formValues.serverId) {
            queryClient.invalidateQueries({ queryKey: ["/api/user-servers", formValues.serverId] });
          }
          // Para invalidar queries específicas da relação anterior
          if (currentUser.serverId) {
            queryClient.invalidateQueries({ queryKey: ["/api/user-servers", currentUser.serverId] });
          }
          
        } catch (error) {
          console.error("Erro ao gerenciar associações de servidor:", error);
          toast({
            title: "Erro ao gerenciar servidores",
            description: "Ocorreu um erro ao atualizar as associações de servidor.",
            variant: "destructive",
          });
        }
      };
      
      getUserServerRelations();
    }

    updateUserMutation.mutate({ id: currentUser.id, userData });
  };

  const handleDeleteUser = () => {
    if (!currentUser) return;
    deleteUserMutation.mutate(currentUser.id);
  };

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
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
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
    setIsEditOpen(true);
  };

  const handleDeleteDialog = (user: User) => {
    setCurrentUser(user);
    setIsDeleteOpen(true);
  };
  
  const handleManagePermissions = (user: User) => {
    setCurrentUser(user);
    setIsPermissionsDialogOpen(true);
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

  return (
    <DashboardLayout>
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
          <Button onClick={() => setIsCreateOpen(true)}>
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
                    <TableHead>Tokens</TableHead>
                    <TableHead>Mensalidade</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Nenhum usuário encontrado. Crie o primeiro usuário.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: User) => (
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
                                onClick={() => {
                                  setCurrentUser(user);
                                  setInstanceWebhookUrl(user.whatsappInstanceWebhook || "");
                                  setIsWhatsAppInstanceDialogOpen(true);
                                }}
                              >
                                <span className="mr-2 h-4 w-4 flex items-center justify-center">🤖</span>
                                Gerenciar WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleManagePermissions(user)}
                              >
                                <KeySquare className="mr-2 h-4 w-4" />
                                Permissões de Acesso
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setCurrentUser(user);
                                  autoAssignServerMutation.mutate(user.id);
                                }}
                              >
                                <svg 
                                  className="mr-2 h-4 w-4" 
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
                                Atribuir Servidor Auto
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                    <Label htmlFor="username">Nome de Usuário</Label>
                    <Input
                      id="username"
                      name="username"
                      value={formValues.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
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
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formValues.password || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formValues.confirmPassword || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formValues.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formValues.company}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formValues.phone}
                      onChange={handleInputChange}
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
                  <Label htmlFor="serverId">Servidor</Label>
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
                      disabled={!currentUser || autoAssignServerMutation.isPending}
                      onClick={() => {
                        if (currentUser) {
                          autoAssignServerMutation.mutate(currentUser.id);
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
                    onValueChange={(value) => handleSelectChange("serverId", value)}
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

        {/* Modal para gerenciar instância WhatsApp */}
        <Dialog open={isWhatsAppInstanceDialogOpen} onOpenChange={setIsWhatsAppInstanceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar WhatsApp</DialogTitle>
              <DialogDescription>
                Configure ou atualize a instância do WhatsApp para o usuário <strong>{currentUser?.name || currentUser?.username}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsappInstanceWebhook">URL do Webhook da Instância</Label>
                <Input
                  id="whatsappInstanceWebhook"
                  value={instanceWebhookUrl}
                  onChange={(e) => setInstanceWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook/instance"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsWhatsAppInstanceDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateWhatsappInstance}
                disabled={createWhatsappInstanceMutation.isPending}
              >
                {createWhatsappInstanceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  "Salvar Configuração"
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
    </DashboardLayout>
  );
}