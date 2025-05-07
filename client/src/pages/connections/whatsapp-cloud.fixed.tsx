import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CloudCog, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import PageTitle from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import useWebSocket from "@/services/websocket-service";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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

// Schema para validação do formulário
const cloudConnectionSchema = z.object({
  phoneNumber: z.string().min(1, "Número de telefone é obrigatório"),
  businessId: z.string().min(1, "Business ID é obrigatório"),
});

type CloudConnectionFormValues = z.infer<typeof cloudConnectionSchema>;

const WhatsAppCloudPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedData, setConnectedData] = useState<any>(null);

  // Formulário
  const form = useForm<CloudConnectionFormValues>({
    resolver: zodResolver(cloudConnectionSchema),
    defaultValues: {
      phoneNumber: "",
      businessId: "",
    },
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
      if (statusData.connected && statusData.cloudConnection) {
        setConnectedData({
          phoneNumber: statusData.phoneNumber,
          businessId: statusData.businessId,
        });
      }
    }
  }, [statusData]);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (values: CloudConnectionFormValues) => {
      setLoading(true);
      try {
        const response = await apiRequest("POST", "/api/connections/cloud", values);
        return await response.json();
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: (data) => {
      setConnected(true);
      setConnectedData({
        phoneNumber: data.phoneNumber,
        businessId: data.businessId,
      });
      toast({
        title: "WhatsApp conectado com sucesso",
        description: "Sua conta WhatsApp Business API foi conectada.",
        variant: "default"
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar WhatsApp",
        description: error.message || "Não foi possível conectar o WhatsApp Cloud API.",
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
      setConnectedData(null);
      toast({
        title: "WhatsApp desconectado",
        description: "A conta do WhatsApp Business API foi desconectada com sucesso.",
        variant: "default"
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Não foi possível desconectar o WhatsApp.",
        variant: "destructive",
      });
    },
  });

  // Função de envio do formulário
  const onSubmit = (values: CloudConnectionFormValues) => {
    connectMutation.mutate(values);
  };

  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<CloudCog />}
        subtitle="Conecte com a API oficial do WhatsApp Business"
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

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Conta Business API</AlertTitle>
        <AlertDescription>
          Para usar este método, você precisa ter uma conta verificada do WhatsApp Business API.
          Este método permite <strong>envios ilimitados</strong> de mensagens sem risco de bloqueio.
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
                <h3 className="text-xl font-bold mb-2">WhatsApp Business Conectado!</h3>
                <div className="mb-6 text-muted-foreground">
                  <p className="mb-1">Sua conta WhatsApp Business API está conectada.</p>
                  {connectedData && (
                    <div className="mt-4 p-3 bg-muted rounded-md text-left">
                      <p><strong>Número:</strong> {connectedData.phoneNumber}</p>
                      <p><strong>Business ID:</strong> {connectedData.businessId}</p>
                    </div>
                  )}
                </div>
                <Button variant="destructive" onClick={handleDisconnect}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Desconectar WhatsApp
                </Button>
              </div>
            ) : (
              <div className="my-4">
                <h3 className="text-lg font-semibold mb-4">Conectar WhatsApp Business API</h3>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="55119XXXXXXXX" {...field} />
                          </FormControl>
                          <FormDescription>
                            Insira o número no formato internacional, sem símbolos ou espaços
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
                            <Input placeholder="123456789012345" {...field} />
                          </FormControl>
                          <FormDescription>
                            ID do seu negócio no WhatsApp Business
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full">
                      Conectar WhatsApp Business
                    </Button>
                  </form>
                </Form>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Sobre a WhatsApp Business API</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              A WhatsApp Business API é a solução oficial da Meta para empresas que desejam 
              enviar mensagens em grande volume, automatizar atendimentos e interagir com 
              seus clientes através do WhatsApp.
            </p>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-2">Vantagens</h3>
            <ul className="list-disc ml-5 space-y-2 mb-6">
              <li><strong>Envios ilimitados</strong>: Sem limite diário de mensagens</li>
              <li><strong>Múltiplos operadores</strong>: Vários atendentes na mesma conta</li>
              <li><strong>Automação avançada</strong>: Integrações com sistemas externos</li>
              <li><strong>Sem risco de banimento</strong>: API oficial aprovada pelo WhatsApp</li>
              <li><strong>Recursos exclusivos</strong>: Templates de mensagem, etiquetas e categorização</li>
            </ul>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Como obter acesso</AlertTitle>
              <AlertDescription className="text-sm">
                Para obter uma conta na WhatsApp Business API, entre em contato com um provedor 
                oficial autorizado pela Meta ou solicite acesso direto pelo Meta Business Manager.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppCloudPage;