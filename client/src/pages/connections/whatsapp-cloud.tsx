import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Cloud, Loader2, AlertCircle, CheckCircle2, XCircle, RefreshCcw, Info as InfoIcon } from "lucide-react";
import PageTitle from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Schema para formulário
const cloudFormSchema = z.object({
  phoneNumber: z.string()
    .min(10, "Número de telefone inválido")
    .regex(/^\d+$/, "Use apenas números"),
  businessId: z.string()
    .min(5, "ID de negócio inválido")
});

type CloudFormValues = z.infer<typeof cloudFormSchema>;

const WhatsAppCloudPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const form = useForm<CloudFormValues>({
    resolver: zodResolver(cloudFormSchema),
    defaultValues: {
      phoneNumber: "",
      businessId: ""
    }
  });

  // Verifica o status da conexão
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["connections", "status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/connections/status");
      return await response.json();
    },
    refetchInterval: 10000, // Refaz a verificação a cada 10 segundos
  });

  // Quando o status é carregado, atualiza o estado de conexão
  useEffect(() => {
    if (statusData) {
      setConnected(statusData.connected && statusData.cloudConnection);
      
      // Preenche o formulário se já estiver conectado
      if (statusData.connected && statusData.cloudConnection) {
        form.setValue("phoneNumber", statusData.phoneNumber || "");
        form.setValue("businessId", statusData.businessId || "");
      }
    }
  }, [statusData, form]);

  // Conectar mutation
  const connectMutation = useMutation({
    mutationFn: async (data: CloudFormValues) => {
      setLoading(true);
      try {
        const response = await apiRequest("POST", "/api/connections/cloud", data);
        return await response.json();
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      setConnected(true);
      toast({
        title: "WhatsApp conectado",
        description: "Conexão com WhatsApp Cloud API estabelecida com sucesso",
        variant: "default"
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message || "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    },
  });

  // Desconexão do WhatsApp
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      try {
        const response = await apiRequest("POST", "/api/connections/disconnect");
        return await response.json();
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      setConnected(false);
      form.reset();
      toast({
        title: "WhatsApp desconectado",
        description: "A conexão com o WhatsApp foi encerrada com sucesso",
        variant: "default"
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Não foi possível desconectar o WhatsApp",
        variant: "destructive",
      });
    },
  });

  // Função para conectar
  const onSubmit = (data: CloudFormValues) => {
    connectMutation.mutate(data);
  };

  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<Cloud />}
        subtitle="Conecte sua conta WhatsApp Business verificada via API Cloud"
      >
        WhatsApp Cloud API
      </PageTitle>

      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/conexoes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Conexões
          </Link>
        </Button>
      </div>

      <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <AlertTitle className="text-blue-800 dark:text-blue-400">API Oficial</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          A API Cloud do WhatsApp permite enviar mensagens em massa sem risco de bloqueio, mas 
          requer uma conta WhatsApp Business verificada com permissões aprovadas pela Meta.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            {statusLoading || loading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p>Carregando...</p>
              </div>
            ) : connected ? (
              <div className="flex flex-col items-center justify-center text-center min-h-[300px]">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">WhatsApp Conectado!</h3>
                <p className="mb-2 text-muted-foreground">
                  Seu WhatsApp Business está conectado via Cloud API e pronto para uso.
                </p>
                <div className="mb-6 text-sm text-left w-full max-w-xs">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Número:</span>
                    <span>{form.getValues().phoneNumber}</span>
                  </div>
                  <div className="flex justify-between mb-4">
                    <span className="font-semibold">Business ID:</span>
                    <span>{form.getValues().businessId}</span>
                  </div>
                  <Alert className="mb-2 text-center">
                    <InfoIcon className="h-4 w-4" />
                    <AlertTitle>Gerenciado pelo n8n</AlertTitle>
                    <AlertDescription className="text-xs">
                      Esta conexão é gerenciada pelo sistema de automação n8n
                    </AlertDescription>
                  </Alert>
                </div>
                <Button variant="default" asChild>
                  <Link to="/conexoes">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Conexões
                  </Link>
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identificação do número de telefone:</FormLabel>
                        <FormControl>
                          <Input placeholder="01234567890123" {...field} />
                        </FormControl>
                        <FormDescription>
                          Exemplo: 01234567890123 - Insira o ID de número do WhatsApp Business sem espaços ou caracteres especiais
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
                        <FormLabel>Business ID</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormDescription>
                          ID da sua conta business no Facebook Developer Portal
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    <Cloud className="mr-2 h-4 w-4" />
                    Conectar via Cloud API
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Como conectar</h3>
            <ol className="list-decimal ml-5 space-y-2 mb-6 text-sm text-muted-foreground">
              <li>Certifique-se de ter uma conta WhatsApp Business verificada</li>
              <li>Acesse o Facebook Developer Portal e crie um aplicativo</li>
              <li>Configure as permissões da API do WhatsApp Business</li>
              <li>Adicione um número de telefone verificado ao seu aplicativo</li>
              <li>Obtenha o Business ID do seu aplicativo</li>
              <li>Insira o número e o Business ID neste formulário</li>
            </ol>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-2">Benefícios da API Cloud</h3>
            <ul className="list-disc ml-5 space-y-2 mb-6 text-sm text-muted-foreground">
              <li>Envio de mensagens em massa sem risco de bloqueio</li>
              <li>Conexão estável que não depende de smartphone</li>
              <li>Mensagens de template pré-aprovadas</li>
              <li>Suporte a mensagens multimídia</li>
              <li>Integração oficial e confiável</li>
            </ul>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Precisa de ajuda?</AlertTitle>
              <AlertDescription className="text-sm">
                Se você precisar de ajuda para configurar sua conta WhatsApp Business,
                consulte a <a href="https://developers.facebook.com/docs/whatsapp/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">documentação oficial</a>.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppCloudPage;