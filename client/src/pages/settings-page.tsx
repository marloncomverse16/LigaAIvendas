import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Sidebar } from "@/components/layout/sidebar";
import { LogoUpload } from "@/components/settings/logo-upload";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Target, DollarSign, Users, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  // Campos de perfil removidos conforme solicitado
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const goalsSchema = z.object({
  metaVendasEmpresa: z.string().refine(
    (val) => !isNaN(parseFloat(val.replace(/[^0-9,.-]/g, "").replace(",", "."))),
    { message: "Valor inválido. Digite um número válido." }
  ),
  ticketMedioVendas: z.string().refine(
    (val) => !isNaN(parseFloat(val.replace(/[^0-9,.-]/g, "").replace(",", "."))),
    { message: "Valor inválido. Digite um número válido." }
  ),
  quantidadeLeadsVendas: z.number().min(0, "Deve ser um número positivo"),
  quantosDisparosPorLead: z.number().min(0, "Deve ser um número positivo"),
  custoIcloudTotal: z.string().refine(
    (val) => !isNaN(parseFloat(val.replace(/[^0-9,.-]/g, "").replace(",", "."))),
    { message: "Valor inválido. Digite um número válido." }
  ),
  quantasMensagensEnviadas: z.number().min(0, "Deve ser um número positivo"),
});

type GoalsFormValues = z.infer<typeof goalsSchema>;

const whatsappMetaSchema = z.object({
  whatsappMetaToken: z.string().min(5, "Token da API deve ter pelo menos 5 caracteres"),
  whatsappMetaBusinessId: z.string().min(5, "ID do negócio deve ter pelo menos 5 caracteres"),
  whatsappMetaApiVersion: z.string().default("v18.0"),
});

type WhatsappMetaFormValues = z.infer<typeof whatsappMetaSchema>;

interface WhatsappMetaSettingsProps {
  settings?: any;
  isLoadingSettings?: boolean;
}

function WhatsappMetaSettings({ settings, isLoadingSettings }: WhatsappMetaSettingsProps) {
  // Fetch Meta API settings data
  const { data: metaSettings, isLoading: isLoadingMetaSettings } = useQuery({
    queryKey: ["/api/user/meta-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/meta-settings");
      const data = await res.json();
      return data.settings;
    }
  });
  
  // Update Meta API settings mutation
  const updateMetaSettingsMutation = useMutation({
    mutationFn: async (data: WhatsappMetaFormValues) => {
      const res = await apiRequest("PUT", "/api/user/meta-settings", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/meta-settings"] });
    },
  });
  
  const metaForm = useForm<WhatsappMetaFormValues>({
    resolver: zodResolver(whatsappMetaSchema),
    defaultValues: {
      whatsappMetaToken: "",
      whatsappMetaBusinessId: "",
      whatsappMetaApiVersion: "v18.0",
    },
    values: metaSettings && typeof metaSettings === 'object' ? {
      whatsappMetaToken: metaSettings.whatsappMetaToken || "",
      whatsappMetaBusinessId: metaSettings.whatsappMetaBusinessId || "",
      whatsappMetaApiVersion: metaSettings.whatsappMetaApiVersion || "v18.0",
    } : undefined,
  });
  
  const onMetaSubmit = (data: WhatsappMetaFormValues) => {
    updateMetaSettingsMutation.mutate(data);
  };
  
  return (
    <div>
      {isLoadingMetaSettings ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Form {...metaForm}>
          <form onSubmit={metaForm.handleSubmit(onMetaSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:gap-6">
              <FormField
                control={metaForm.control}
                name="whatsappMetaToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token da API do WhatsApp Cloud API (Meta)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Seu token de acesso da Meta"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={metaForm.control}
                name="whatsappMetaBusinessId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID de Negócio do WhatsApp (Business Account ID)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ID do seu negócio na Meta"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={metaForm.control}
                name="whatsappMetaApiVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versão da API da Meta</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="v18.0"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateMetaSettingsMutation.isPending}
                className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
              >
                {updateMetaSettingsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar configurações da Meta API
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}



function GoalsSettings() {
  // Fetch settings data
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings"],
  });
  
  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: GoalsFormValues) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
    },
  });
  
  const goalsForm = useForm<GoalsFormValues>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      metaVendasEmpresa: "0",
      ticketMedioVendas: "0",
      quantidadeLeadsVendas: 0,
      quantosDisparosPorLead: 0,
      custoIcloudTotal: "0",
      quantasMensagensEnviadas: 0,
    },
    values: settings && typeof settings === 'object' ? {
      metaVendasEmpresa: settings.metaVendasEmpresa || "0",
      ticketMedioVendas: settings.ticketMedioVendas || "0",
      quantidadeLeadsVendas: settings.quantidadeLeadsVendas || 0,
      quantosDisparosPorLead: settings.quantosDisparosPorLead || 0,
      custoIcloudTotal: settings.custoIcloudTotal || "0",
      quantasMensagensEnviadas: settings.quantasMensagensEnviadas || 0,
    } : undefined,
  });
  
  const onGoalsSubmit = (data: GoalsFormValues) => {
    console.log("📝 Dados do formulário de metas:", data);
    console.log("🔧 Configurações atuais:", settings);
    
    // Enviar apenas os campos de metas, sem IDs ou tokens sensíveis
    const goalsData = {
      metaVendasEmpresa: data.metaVendasEmpresa,
      ticketMedioVendas: data.ticketMedioVendas,
      quantidadeLeadsVendas: data.quantidadeLeadsVendas,
      quantosDisparosPorLead: data.quantosDisparosPorLead,
      custoIcloudTotal: data.custoIcloudTotal,
      quantasMensagensEnviadas: data.quantasMensagensEnviadas,
    };
    
    console.log("📤 Enviando apenas dados de metas para backend:", goalsData);
    updateSettingsMutation.mutate(goalsData);
  };
  
  return (
    <div>
      {isLoadingSettings ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Form {...goalsForm}>
          <form onSubmit={goalsForm.handleSubmit(onGoalsSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              <FormField
                control={goalsForm.control}
                name="metaVendasEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta de Vendas da Empresa</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="R$ 0,00" 
                        {...field} 
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={goalsForm.control}
                name="ticketMedioVendas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Médio de Vendas</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="R$ 0,00" 
                        {...field} 
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={goalsForm.control}
                name="quantidadeLeadsVendas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Leads de Vendas</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={goalsForm.control}
                name="quantosDisparosPorLead"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantos disparos para ter 1 Lead</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={goalsForm.control}
                name="custoIcloudTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo Icloud Total</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="R$ 0,00" 
                        {...field} 
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={goalsForm.control}
                name="quantasMensagensEnviadas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantas mensagens enviadas</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateSettingsMutation.isPending}
                className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar metas
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Fetch user profile data
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/user"],
  });
  
  // Fetch settings data (for goals and appearance)
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings"],
  });
  
  // Upload profile image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("/api/upload/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Erro ao fazer upload da imagem");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setProfileImage(data.imageUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada com sucesso!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Remove profile image mutation
  const removeImageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/upload/profile-image");
      return await res.json();
    },
    onSuccess: () => {
      setProfileImage(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Sucesso",
        description: "Foto de perfil removida com sucesso!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PUT", "/api/user", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {},
    values: profile && typeof profile === 'object' ? {} : undefined,
  });
  
  const onProfileSubmit = (data: ProfileFormValues) => {
    // Campos de perfil removidos - função mantida para compatibilidade
  };
  
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };
  
  const getProfileName = () => {
    // Campos de perfil removidos - retorna username do usuário autenticado
    return user?.username || "U";
  };

  // Handle file upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo de imagem válido",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingImage(true);
    uploadImageMutation.mutate(file, {
      onSettled: () => {
        setIsUploadingImage(false);
        // Reset input
        event.target.value = "";
      }
    });
  };

  // Handle remove image
  const handleRemoveImage = () => {
    removeImageMutation.mutate();
  };

  // Set profile image from API data
  React.useEffect(() => {
    if (profile?.profileImage) {
      setProfileImage(profile.profileImage);
    }
  }, [profile]);
  
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen ml-0 lg:ml-64">
        <Header title="Configurações" subtitle="Personalize sua conta" />
        
        <main className="flex-1 p-3 md:p-4 lg:p-6 max-w-7xl mx-auto w-full overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full max-h-[calc(100vh-8rem)]">
            {/* Navigation */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="lg:sticky lg:top-4">
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Configurações</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <nav>
                      <div className="space-y-1 p-2">
                        <Button 
                          variant={activeTab === "profile" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "profile" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("profile")}
                        >
                          Perfil e Conta
                        </Button>

                        <Button 
                          variant={activeTab === "integrations" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "integrations" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("integrations")}
                        >
                          Integrações
                        </Button>
                        <Button 
                          variant={activeTab === "notifications" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "notifications" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("notifications")}
                        >
                          Notificações
                        </Button>
                        <Button 
                          variant={activeTab === "security" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "security" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("security")}
                        >
                          Privacidade e Segurança
                        </Button>
                        <Button 
                          variant={activeTab === "billing" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "billing" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("billing")}
                        >
                          Faturamento
                        </Button>
                        <Button 
                          variant={activeTab === "goals" ? "default" : "ghost"} 
                          size="sm"
                          className={`w-full justify-start text-sm ${activeTab === "goals" ? "bg-gradient-to-r from-orange-400 to-yellow-400 text-black font-semibold hover:from-orange-500 hover:to-yellow-500" : ""}`}
                          onClick={() => setActiveTab("goals")}
                        >
                          Metas
                        </Button>

                      </div>
                    </nav>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="pr-2">
              {activeTab === "profile" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Perfil e Conta</CardTitle>
                    <CardDescription>
                      Interface simplificada para gerenciar seu perfil
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoadingProfile ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <Avatar className="w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl">
                            {profileImage ? (
                              <AvatarImage src={profileImage} alt="Foto de perfil" />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-400 text-white">
                              {getInitials(getProfileName())}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="space-y-2">
                            <h3 className="text-lg font-medium">Foto de Perfil</h3>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                id="profile-image-upload"
                              />
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                disabled={isUploadingImage || uploadImageMutation.isPending}
                                onClick={() => document.getElementById('profile-image-upload')?.click()}
                                className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold border-0"
                              >
                                {isUploadingImage || uploadImageMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Alterar
                                  </>
                                )}
                              </Button>
                              {profileImage && (
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  disabled={removeImageMutation.isPending}
                                  onClick={handleRemoveImage}
                                >
                                  {removeImageMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removendo...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remover
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Os campos de perfil foram simplificados. Use a seção "Metas" para configurar seus objetivos de negócio e a seção "Integrações" para conectar suas APIs.
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              

              

              
              {activeTab === "integrations" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Integrações</CardTitle>
                    <CardDescription>
                      Conecte aplicativos externos e serviços à sua conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-semibold text-sm">WA</span>
                        </div>
                        <h3 className="text-lg font-semibold">WhatsApp Cloud API (Meta)</h3>
                      </div>
                      <WhatsappMetaSettings />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Removida aba obsoleta de integrações com WhatsApp Meta */}
              
              {activeTab === "notifications" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Notificações</CardTitle>
                    <CardDescription>
                      Configure como e quando você recebe notificações
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 bg-muted/30 rounded-lg text-center">
                      <p className="text-muted-foreground">
                        Configurações de notificação estarão disponíveis em breve.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "security" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Privacidade e Segurança</CardTitle>
                    <CardDescription>
                      Gerencie sua senha e configurações de segurança
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 bg-muted/30 rounded-lg text-center">
                      <p className="text-muted-foreground">
                        Configurações de segurança estarão disponíveis em breve.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "billing" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Faturamento</CardTitle>
                    <CardDescription>
                      Gerencie seu plano e métodos de pagamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 bg-muted/30 rounded-lg text-center">
                      <p className="text-muted-foreground">
                        Configurações de faturamento estarão disponíveis em breve.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "goals" && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Metas
                    </CardTitle>
                    <CardDescription>
                      Configure suas metas de desempenho para acompanhamento no dashboard
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GoalsSettings />
                  </CardContent>
                </Card>
              )}
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
