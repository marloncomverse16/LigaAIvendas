import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageTitle from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Cloud,
  CloudCog,
  Smartphone,
  Link as LinkIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// Schema de validação do formulário
const metaConnectionSchema = z.object({
  phoneNumberId: z.string().min(1, "Identificação do número de telefone é obrigatória"),
});

// Tipo baseado no schema
type MetaConnectionFormValues = z.infer<typeof metaConnectionSchema>;

const WhatsAppMetaPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedData, setConnectedData] = useState<any>(null);

  // Formulário
  const form = useForm<MetaConnectionFormValues>({
    resolver: zodResolver(metaConnectionSchema),
    defaultValues: {
      phoneNumberId: "",
    },
  });

  // Verifica o status da conexão
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["connections", "meta", "status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/connections/meta/status");
      return await response.json();
    },
    refetchInterval: 10000, // Refaz a verificação a cada 10 segundos
  });

  // Quando o status é carregado, atualiza o estado de conexão
  useEffect(() => {
    if (statusData) {
      setConnected(statusData.connected);
      if (statusData.connected) {
        setConnectedData({
          phoneNumberId: statusData.phoneNumberId,
          businessName: statusData.businessName,
          businessPhoneNumber: statusData.businessPhoneNumber
        });
      }
    }
  }, [statusData]);

  // Conexão com WhatsApp Meta API
  const connectMutation = useMutation({
    mutationFn: async (values: MetaConnectionFormValues) => {
      setLoading(true);
      try {
        const response = await apiRequest("POST", "/api/connections/meta", values);
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
        phoneNumberId: data.phoneNumberId,
        businessName: data.businessName,
        businessPhoneNumber: data.businessPhoneNumber
      });
      toast({
        title: "WhatsApp conectado",
        description: "A conexão com o WhatsApp Meta API foi estabelecida com sucesso.",
        variant: "default",
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message || "Não foi possível conectar ao WhatsApp Meta API.",
        variant: "destructive",
      });
    },
  });

  // Desconexão do WhatsApp
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      try {
        const response = await apiRequest("POST", "/api/connections/meta/disconnect");
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
        description: "A conta do WhatsApp Meta API foi desconectada com sucesso.",
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
  const onSubmit = (values: MetaConnectionFormValues) => {
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
        subtitle="Conecte diretamente com a API oficial do WhatsApp Business da Meta"
        actions={
          <Button variant="outline" onClick={() => navigate("/conexoes")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Conexões
          </Button>
        }
      >
        WhatsApp Cloud API (Meta)
      </PageTitle>

      <div className="mt-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Configuração da Conexão</CardTitle>
              {connected && (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700">
                  Conectado
                </Badge>
              )}
            </div>
            <CardDescription>
              Conecte-se diretamente com a API oficial do WhatsApp Business da Meta
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!connected ? (
              <>
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Requisitos para conexão</AlertTitle>
                  <AlertDescription>
                    <p className="mt-2">
                      Para usar a API oficial da Meta, você precisa ter:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Conta Business verificada no WhatsApp</li>
                      <li>Aprovação da Meta para uso da API</li>
                      <li>Token de acesso permanente configurado pelo administrador</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="phoneNumberId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Identificação do número de telefone:</FormLabel>
                          <FormControl>
                            <Input placeholder="01234567890123" {...field} />
                          </FormControl>
                          <FormDescription>
                            Identificador único do seu número no WhatsApp Business (exemplo: 01234567890123)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={loading}>
                      {loading ? "Conectando..." : "Conectar WhatsApp Business"}
                    </Button>
                  </form>
                </Form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Status da Conexão</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted rounded p-3">
                      <p className="text-xs text-muted-foreground">Identificação do número</p>
                      <p className="font-medium">{connectedData?.phoneNumberId || "-"}</p>
                    </div>
                    <div className="bg-muted rounded p-3">
                      <p className="text-xs text-muted-foreground">Nome do negócio</p>
                      <p className="font-medium">{connectedData?.businessName || "-"}</p>
                    </div>
                    <div className="bg-muted rounded p-3">
                      <p className="text-xs text-muted-foreground">Número do WhatsApp</p>
                      <p className="font-medium">{connectedData?.businessPhoneNumber || "-"}</p>
                    </div>
                    <div className="bg-muted rounded p-3">
                      <p className="text-xs text-muted-foreground">Última verificação</p>
                      <p className="font-medium">
                        {statusData?.lastUpdated
                          ? new Date(statusData.lastUpdated).toLocaleString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="pt-4">
                  <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
                    {loading ? "Desconectando..." : "Desconectar WhatsApp Business"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-start">
            <div className="text-sm text-muted-foreground">
              <p className="flex items-center gap-2 mt-2">
                <LinkIcon className="h-4 w-4" />
                <a 
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Documentação oficial da API do WhatsApp Business
                </a>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppMetaPage;