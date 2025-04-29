import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, Users, MoreHorizontal } from "lucide-react";
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
import ModulePermissions from "@/components/admin/module-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { InsertUser, User } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface UserFormValues extends Omit<InsertUser, "password"> {
  password?: string;
  confirmPassword?: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWhatsAppInstanceDialogOpen, setIsWhatsAppInstanceDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formValues, setFormValues] = useState<UserFormValues>({
    username: "",
    email: "",
    name: "",
    company: "",
    phone: "",
    bio: "",
    whatsappWebhookUrl: "",
    aiAgentWebhookUrl: "",
    prospectingWebhookUrl: "",
    contactsWebhookUrl: "",
    schedulingWebhookUrl: "",
    crmWebhookUrl: "",
    whatsappInstanceWebhook: "",
    availableTokens: 1000,
    tokenExpirationDays: 30,
    monthlyFee: "0",
    serverAddress: "",
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
      whatsappWebhookUrl: "",
      aiAgentWebhookUrl: "",
      prospectingWebhookUrl: "",
      contactsWebhookUrl: "",
      schedulingWebhookUrl: "",
      crmWebhookUrl: "",
      availableTokens: 1000,
      tokenExpirationDays: 30,
      monthlyFee: "0",
      serverAddress: "",
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
      whatsappWebhookUrl: user.whatsappWebhookUrl || "",
      aiAgentWebhookUrl: user.aiAgentWebhookUrl || "",
      prospectingWebhookUrl: user.prospectingWebhookUrl || "",
      contactsWebhookUrl: user.contactsWebhookUrl || "",
      schedulingWebhookUrl: user.schedulingWebhookUrl || "",
      crmWebhookUrl: user.crmWebhookUrl || "",
      availableTokens: user.availableTokens || 0,
      tokenExpirationDays: user.tokenExpirationDays || 30,
      monthlyFee: user.monthlyFee || "0",
      serverAddress: user.serverAddress || "",
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

        {/* Modal para criar usuário */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo usuário.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
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
              
              <TabsContent value="webhooks" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsappWebhookUrl">Webhook do WhatsApp</Label>
                  <Input
                    id="whatsappWebhookUrl"
                    name="whatsappWebhookUrl"
                    value={formValues.whatsappWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/whatsapp"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="aiAgentWebhookUrl">Webhook do Agente IA</Label>
                  <Input
                    id="aiAgentWebhookUrl"
                    name="aiAgentWebhookUrl"
                    value={formValues.aiAgentWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/ai-agent"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prospectingWebhookUrl">Webhook de Prospecção</Label>
                  <Input
                    id="prospectingWebhookUrl"
                    name="prospectingWebhookUrl"
                    value={formValues.prospectingWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/prospecting"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactsWebhookUrl">Webhook de Contatos</Label>
                  <Input
                    id="contactsWebhookUrl"
                    name="contactsWebhookUrl"
                    value={formValues.contactsWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/contacts"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="schedulingWebhookUrl">Webhook de Agendamentos</Label>
                  <Input
                    id="schedulingWebhookUrl"
                    name="schedulingWebhookUrl"
                    value={formValues.schedulingWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/scheduling"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="crmWebhookUrl">Webhook do CRM</Label>
                  <Input
                    id="crmWebhookUrl"
                    name="crmWebhookUrl"
                    value={formValues.crmWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/crm"
                  />
                </div>
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
                
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="serverAddress">Endereço do Servidor</Label>
                    <Input
                      id="serverAddress"
                      name="serverAddress"
                      value={formValues.serverAddress}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
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
                <TabsTrigger value="permissions">Permissões</TabsTrigger>
                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
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
                    <Label htmlFor="password-edit">Nova Senha (opcional)</Label>
                    <Input
                      id="password-edit"
                      name="password"
                      type="password"
                      value={formValues.password || ""}
                      onChange={handleInputChange}
                      placeholder="Deixe em branco para manter a senha atual"
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
                      placeholder="Confirme a nova senha"
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
              
              <TabsContent value="webhooks" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsappWebhookUrl-edit">Webhook do WhatsApp</Label>
                  <Input
                    id="whatsappWebhookUrl-edit"
                    name="whatsappWebhookUrl"
                    value={formValues.whatsappWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/whatsapp"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="aiAgentWebhookUrl-edit">Webhook do Agente IA</Label>
                  <Input
                    id="aiAgentWebhookUrl-edit"
                    name="aiAgentWebhookUrl"
                    value={formValues.aiAgentWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/ai-agent"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prospectingWebhookUrl-edit">Webhook de Prospecção</Label>
                  <Input
                    id="prospectingWebhookUrl-edit"
                    name="prospectingWebhookUrl"
                    value={formValues.prospectingWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/prospecting"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactsWebhookUrl-edit">Webhook de Contatos</Label>
                  <Input
                    id="contactsWebhookUrl-edit"
                    name="contactsWebhookUrl"
                    value={formValues.contactsWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/contacts"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="schedulingWebhookUrl-edit">Webhook de Agendamentos</Label>
                  <Input
                    id="schedulingWebhookUrl-edit"
                    name="schedulingWebhookUrl"
                    value={formValues.schedulingWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/scheduling"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="crmWebhookUrl-edit">Webhook do CRM</Label>
                  <Input
                    id="crmWebhookUrl-edit"
                    name="crmWebhookUrl"
                    value={formValues.crmWebhookUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/webhook/crm"
                  />
                </div>
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
                
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="serverAddress-edit">Endereço do Servidor</Label>
                    <Input
                      id="serverAddress-edit"
                      name="serverAddress"
                      value={formValues.serverAddress}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  resetForm();
                }}
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
                    Atualizando...
                  </>
                ) : (
                  "Atualizar Usuário"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para confirmar exclusão */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o usuário{" "}
                <span className="font-medium">{currentUser?.name || currentUser?.username}</span>?
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center p-4 mt-2 border rounded-md bg-red-50 border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-red-700 text-sm">
                Todos os dados associados a este usuário também serão excluídos.
              </p>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
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

        {/* Modal para gerenciar instância de WhatsApp */}
        <Dialog open={isWhatsAppInstanceDialogOpen} onOpenChange={setIsWhatsAppInstanceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Instância WhatsApp</DialogTitle>
              <DialogDescription>
                Configure a instância do WhatsApp para o usuário <span className="font-medium">{currentUser?.name || currentUser?.username}</span>.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {currentUser?.whatsappInstanceId ? (
                <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
                  <div className="flex items-center mb-2">
                    <span className="inline-flex items-center px-2 py-1 mr-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Ativo
                    </span>
                    <p className="text-green-800 font-medium">
                      Instância criada
                    </p>
                  </div>
                  <p className="text-sm text-green-700">
                    ID da instância: <span className="font-mono">{currentUser.whatsappInstanceId}</span>
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 p-4 rounded-md border border-amber-200 mb-4">
                  <p className="text-amber-800">
                    Este usuário ainda não possui uma instância do WhatsApp ativa. 
                    Configure o webhook abaixo para criar uma.
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="instance-webhook-url">URL do Webhook da Instância</Label>
                <Input
                  id="instance-webhook-url"
                  value={instanceWebhookUrl}
                  onChange={(e) => setInstanceWebhookUrl(e.target.value)}
                  placeholder="https://n8n.example.com/webhook/create-whatsapp-instance"
                />
                <p className="text-xs text-muted-foreground">
                  Este é o endpoint que será chamado para criar/gerenciar a instância
                </p>
              </div>
              
              <Button 
                onClick={handleCreateWhatsappInstance}
                disabled={createWhatsappInstanceMutation.isPending || !instanceWebhookUrl}
                className="w-full mt-4"
              >
                {createWhatsappInstanceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {currentUser?.whatsappInstanceId ? "Atualizando Instância..." : "Criando Instância..."}
                  </>
                ) : (
                  currentUser?.whatsappInstanceId ? "Atualizar Instância" : "Criar Instância de WhatsApp"
                )}
              </Button>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsWhatsAppInstanceDialogOpen(false)}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}