import { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Target, DollarSign, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  company: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const goalsSchema = z.object({
  whatsappSendingGoal: z.number().min(0, "Deve ser um número positivo"),
  revenueGoal: z.string().refine(
    (val) => !isNaN(parseFloat(val.replace(/[^0-9,.-]/g, "").replace(",", "."))),
    { message: "Valor inválido. Digite um número válido." }
  ),
  leadsGoal: z.number().min(0, "Deve ser um número positivo"),
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
    values: {
      whatsappMetaToken: metaSettings?.whatsappMetaToken || "",
      whatsappMetaBusinessId: metaSettings?.whatsappMetaBusinessId || "",
      whatsappMetaApiVersion: metaSettings?.whatsappMetaApiVersion || "v18.0",
    },
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
            <div className="grid grid-cols-1 gap-6">
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
      whatsappSendingGoal: settings?.whatsappSendingGoal || 0,
      revenueGoal: settings?.revenueGoal || "0",
      leadsGoal: settings?.leadsGoal || 0,
    },
    values: {
      whatsappSendingGoal: settings?.whatsappSendingGoal || 0,
      revenueGoal: settings?.revenueGoal || "0",
      leadsGoal: settings?.leadsGoal || 0,
    },
  });
  
  const onGoalsSubmit = (data: GoalsFormValues) => {
    // Preservar outros campos das configurações existentes
    const updatedSettings = {
      ...settings,
      ...data,
    };
    updateSettingsMutation.mutate(updatedSettings);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Meta de Envios WhatsApp</h3>
                </div>
                <FormField
                  control={goalsForm.control}
                  name="whatsappSendingGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade mensal de envios</FormLabel>
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
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-medium">Meta de Faturamento</h3>
                </div>
                <FormField
                  control={goalsForm.control}
                  name="revenueGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faturamento mensal desejado (R$)</FormLabel>
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
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-medium">Meta de Leads</h3>
                </div>
                <FormField
                  control={goalsForm.control}
                  name="leadsGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade mensal de novos leads</FormLabel>
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
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateSettingsMutation.isPending}
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
  const [activeTab, setActiveTab] = useState("profile");
  
  // Fetch user profile data
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/profile"],
  });
  
  // Fetch settings data (for goals and appearance)
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/settings"],
  });
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/profile"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      company: profile?.company || "",
      bio: profile?.bio || "",
    },
    values: {
      name: profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      company: profile?.company || "",
      bio: profile?.bio || "",
    },
  });
  
  const onProfileSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };
  
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };
  
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen ml-0 md:ml-64">
        <Header title="Configurações" subtitle="Personalize sua conta" />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Navigation */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <nav>
                    <div className="space-y-1 p-2">
                      <Button 
                        variant={activeTab === "profile" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("profile")}
                      >
                        Perfil e Conta
                      </Button>
                      <Button 
                        variant={activeTab === "appearance" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("appearance")}
                      >
                        Aparência
                      </Button>
                      <Button 
                        variant={activeTab === "logo" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("logo")}
                      >
                        Logotipo e Marca
                      </Button>
                      <Button 
                        variant={activeTab === "integrations" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("integrations")}
                      >
                        Integrações
                      </Button>
                      <Button 
                        variant={activeTab === "notifications" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("notifications")}
                      >
                        Notificações
                      </Button>
                      <Button 
                        variant={activeTab === "security" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("security")}
                      >
                        Privacidade e Segurança
                      </Button>
                      <Button 
                        variant={activeTab === "billing" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("billing")}
                      >
                        Faturamento
                      </Button>
                      <Button 
                        variant={activeTab === "goals" ? "default" : "ghost"} 
                        className="w-full justify-start"
                        onClick={() => setActiveTab("goals")}
                      >
                        Metas
                      </Button>

                    </div>
                  </nav>
                </CardContent>
              </Card>
            </div>
            
            {/* Content */}
            <div className="md:col-span-2">
              {activeTab === "profile" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Perfil e Conta</CardTitle>
                    <CardDescription>
                      Atualize suas informações pessoais e dados de contato
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingProfile ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                            <Avatar className="w-24 h-24 text-4xl">
                              <AvatarFallback className="bg-primary text-white">
                                {getInitials(profile?.name)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div>
                              <h3 className="text-lg font-medium">Foto de Perfil</h3>
                              <p className="text-sm text-muted-foreground mb-3">Esta imagem será exibida em seu perfil</p>
                              <div className="flex space-x-2">
                                <Button type="button" variant="outline" size="sm">
                                  Alterar
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="text-destructive">
                                  Remover
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={profileForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nome</FormLabel>
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={profileForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="email" value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={profileForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Telefone</FormLabel>
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={profileForm.control}
                              name="company"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Empresa</FormLabel>
                                  <FormControl>
                                    <Input {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={profileForm.control}
                            name="bio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Sobre</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    rows={3} 
                                    placeholder="Conte um pouco sobre você ou sua empresa..." 
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end">
                            <Button 
                              type="submit" 
                              disabled={updateProfileMutation.isPending}
                            >
                              {updateProfileMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Salvar alterações
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "appearance" && (
                <ThemeSelector />
              )}
              
              {activeTab === "logo" && (
                <LogoUpload />
              )}
              
              {activeTab === "integrations" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Integrações</CardTitle>
                    <CardDescription>
                      Conecte aplicativos externos e serviços à sua conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">WhatsApp Cloud API (Meta)</h3>
                      <WhatsappMetaSettings />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Removida aba obsoleta de integrações com WhatsApp Meta */}
              
              {activeTab === "notifications" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notificações</CardTitle>
                    <CardDescription>
                      Configure como e quando você recebe notificações
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Configurações de notificação estarão disponíveis em breve.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "security" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Privacidade e Segurança</CardTitle>
                    <CardDescription>
                      Gerencie sua senha e configurações de segurança
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Configurações de segurança estarão disponíveis em breve.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "billing" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Faturamento</CardTitle>
                    <CardDescription>
                      Gerencie seu plano e métodos de pagamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Configurações de faturamento estarão disponíveis em breve.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "goals" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Metas</CardTitle>
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
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
