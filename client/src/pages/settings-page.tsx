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
import { Loader2 } from "lucide-react";

const profileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  company: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  
  // Fetch user profile data
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/profile"],
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
                  <CardContent>
                    <p className="text-muted-foreground">
                      Configurações de integração estarão disponíveis em breve.
                    </p>
                  </CardContent>
                </Card>
              )}
              
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
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
