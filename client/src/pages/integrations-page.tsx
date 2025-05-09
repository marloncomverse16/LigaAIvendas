import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Schema para validação das integrações
const metaApiSchema = z.object({
  whatsappMetaToken: z.string().min(1, "Token da Meta API é obrigatório"),
  whatsappMetaBusinessId: z.string().min(1, "ID do Business é obrigatório"),
  whatsappMetaApiVersion: z.string().min(1, "Versão da API é obrigatória"),
});

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("meta-api");

  // Buscar configurações do usuário
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Form com valores padrão
  const metaApiForm = useForm({
    resolver: zodResolver(metaApiSchema),
    defaultValues: {
      whatsappMetaToken: settings?.whatsappMetaToken || "",
      whatsappMetaBusinessId: settings?.whatsappMetaBusinessId || "",
      whatsappMetaApiVersion: settings?.whatsappMetaApiVersion || "v18.0",
    },
    values: {
      whatsappMetaToken: settings?.whatsappMetaToken || "",
      whatsappMetaBusinessId: settings?.whatsappMetaBusinessId || "",
      whatsappMetaApiVersion: settings?.whatsappMetaApiVersion || "v18.0",
    },
  });

  // Mutation para salvar configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas com sucesso",
        description: "As integrações foram configuradas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Teste de conexão com a Meta API
  const testMetaConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/user/meta-connection/test", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: "As credenciais da Meta API estão válidas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha na conexão",
        description: `Erro ao conectar com a Meta API: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Salvar configurações da Meta API
  const onSubmitMetaApi = (data: z.infer<typeof metaApiSchema>) => {
    updateSettingsMutation.mutate(data);
  };

  // Testar conexão com a Meta API
  const onTestMetaApi = () => {
    const data = metaApiForm.getValues();
    testMetaConnectionMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
        <CardDescription>
          Configure as integrações da plataforma com serviços externos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="meta-api" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="meta-api">WhatsApp Cloud API (Meta)</TabsTrigger>
            <TabsTrigger value="n8n">n8n</TabsTrigger>
          </TabsList>
          
          <TabsContent value="meta-api">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Configurações da Meta API</h3>
                <p className="text-sm text-muted-foreground">
                  Configure as credenciais necessárias para se conectar à API do WhatsApp Cloud da Meta
                </p>
              </div>
              
              <Separator />
              
              <Form {...metaApiForm}>
                <form onSubmit={metaApiForm.handleSubmit(onSubmitMetaApi)} className="space-y-4">
                  <FormField
                    control={metaApiForm.control}
                    name="whatsappMetaToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token de Acesso</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="EAAxxxxx..." 
                            {...field} 
                            type="password"
                          />
                        </FormControl>
                        <FormDescription>
                          Token de acesso à API do WhatsApp Business (Token Permanente)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={metaApiForm.control}
                    name="whatsappMetaBusinessId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID do Business</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormDescription>
                          ID do seu negócio no Facebook Business Manager
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={metaApiForm.control}
                    name="whatsappMetaApiVersion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Versão da API</FormLabel>
                        <FormControl>
                          <Input placeholder="v18.0" {...field} />
                        </FormControl>
                        <FormDescription>
                          Versão da API do WhatsApp Business (padrão: v18.0)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={updateSettingsMutation.isPending}
                    >
                      {updateSettingsMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar Configurações
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onTestMetaApi}
                      disabled={testMetaConnectionMutation.isPending}
                    >
                      {testMetaConnectionMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Testar Conexão
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </TabsContent>
          
          <TabsContent value="n8n">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Configurações do n8n</h3>
                <p className="text-sm text-muted-foreground">
                  Configure as integrações com a plataforma n8n para automações
                </p>
              </div>
              
              <Separator />
              
              <p className="text-sm">
                Esta funcionalidade será implementada em breve.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <p className="text-xs text-muted-foreground">
          As alterações são salvas automaticamente ao clicar em "Salvar Configurações"
        </p>
      </CardFooter>
    </Card>
  );
}