import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle, PhoneOff, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/services/websocket-service";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const cloudConnectionSchema = z.object({
  phoneNumber: z.string().min(10, "Número de telefone inválido").max(15, "Número de telefone inválido"),
  businessId: z.string().min(3, "Business ID inválido"),
});

type CloudConnectionFormValues = z.infer<typeof cloudConnectionSchema>;

export default function WhatsAppCloudPage() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket("/api/ws");
  
  // Consulta o status da conexão
  const { data: connectionStatus, isLoading } = useQuery({
    queryKey: ["/api/connection/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/connection/status");
      const data = await res.json();
      return data;
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });
  
  // Formulário para dados da conexão Cloud
  const form = useForm<CloudConnectionFormValues>({
    resolver: zodResolver(cloudConnectionSchema),
    defaultValues: {
      phoneNumber: "",
      businessId: "",
    },
  });
  
  // Mutation para conectar com WhatsApp Cloud
  const connectCloudMutation = useMutation({
    mutationFn: async (values: CloudConnectionFormValues) => {
      const res = await apiRequest("POST", "/api/connection/connect-cloud", values);
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "WhatsApp Cloud conectado",
          description: "Seu WhatsApp Business Cloud foi conectado com sucesso",
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/connection/status"] });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível conectar o WhatsApp Cloud",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro de conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/connection/disconnect");
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "WhatsApp desconectado",
          description: "Seu WhatsApp Cloud foi desconectado com sucesso",
          variant: "success",
        });
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/connection/status"] });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível desconectar",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro de desconexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função para enviar o formulário
  const onSubmit = (values: CloudConnectionFormValues) => {
    connectCloudMutation.mutate(values);
  };
  
  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };
  
  const isConnected = connectionStatus?.connected && connectionStatus?.cloudConnection;
  const isConnecting = connectCloudMutation.isPending;
  const isDisconnecting = disconnectMutation.isPending;
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <PageTitle 
          title="WhatsApp Cloud API" 
          description="Conecte-se à API oficial do WhatsApp Business"
        />
        <Link href="/conexoes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Instruções de Conexão</CardTitle>
          <CardDescription>
            Siga os passos abaixo para conectar o WhatsApp Business Cloud API ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2">
            <li>Cadastre-se na <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">plataforma Meta for Developers</a></li>
            <li>Crie um app do tipo Business</li>
            <li>Adicione o produto "WhatsApp" ao seu app</li>
            <li>Configure o número de telefone para WhatsApp Business na plataforma</li>
            <li>Copie o "Business Account ID" da sua conta</li>
            <li>Preencha os dados no formulário abaixo</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-4">
            Para mais informações, consulte a <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">documentação oficial</a>.
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Status da Conexão</CardTitle>
          <CardDescription>
            {isLoading ? (
              "Verificando status da conexão..."
            ) : isConnected ? (
              "Seu WhatsApp Business Cloud API está conectado ao sistema"
            ) : (
              "Seu WhatsApp Business Cloud API não está conectado"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p>Verificando status da conexão...</p>
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">WhatsApp Cloud API Conectado</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Seu WhatsApp Business Cloud API está conectado e pronto para uso. 
                Você pode enviar mensagens em maior volume com mais segurança.
              </p>
              {connectionStatus?.phoneNumber && (
                <p className="mt-4 font-medium">
                  Número conectado: {connectionStatus.phoneNumber}
                </p>
              )}
              {connectionStatus?.businessId && (
                <p className="mt-2 font-medium">
                  Business ID: {connectionStatus.businessId}
                </p>
              )}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de WhatsApp</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: 5511999998888" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Informe o número completo no formato internacional (com código do país e DDD)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="businessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Business ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: 123456789012345" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        ID da conta Business do WhatsApp (encontrado no Meta Business Dashboard)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-center pt-4">
                  <Button 
                    type="submit" 
                    disabled={isConnecting}
                    className="gap-2"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                    Conectar WhatsApp Cloud API
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
        {isConnected && (
          <CardFooter className="flex justify-center pt-2 pb-6">
            <Button 
              variant="destructive" 
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="gap-2"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              Desconectar WhatsApp Cloud API
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}