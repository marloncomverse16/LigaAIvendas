import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, QrCode, RefreshCw, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import PageTitle from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import useWebSocket from "@/services/websocket-service";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

const WhatsAppQrCodePage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setConnected(statusData.connected);
    }
  }, [statusData]);

  // Solicitação de QR Code
  const getQrCodeMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiRequest("POST", "/api/connections/qrcode");
        return await response.json();
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: (data) => {
      if (data.qrCode) {
        setQrCode(data.qrCode);
        toast({
          title: "QR Code gerado com sucesso",
          description: "Escaneie o QR Code com seu WhatsApp para conectar.",
          variant: "default"
        });
      } else if (data.connected) {
        setConnected(true);
        setQrCode(null);
        toast({
          title: "WhatsApp já está conectado",
          description: "Sua sessão WhatsApp já está ativa.",
          variant: "default"
        });
        refetchStatus();
      }
    },
    onError: (error: Error) => {
      setError(error.message || "Erro ao gerar QR Code");
      toast({
        title: "Erro ao gerar QR Code",
        description: error.message || "Tente novamente em alguns instantes.",
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
      setQrCode(null);
      toast({
        title: "WhatsApp desconectado",
        description: "A sessão do WhatsApp foi encerrada com sucesso.",
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

  // Solicitar QR Code quando a página carregar
  useEffect(() => {
    if (!statusLoading && !connected && !qrCode && !loading) {
      getQrCodeMutation.mutate();
    }
  }, [statusLoading, connected]);

  // Função para solicitar um novo QR Code
  const handleRefreshQrCode = () => {
    getQrCodeMutation.mutate();
  };

  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<QrCode />}
        subtitle="Conecte seu WhatsApp através de QR Code"
      >
        WhatsApp QR Code
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
        <AlertTitle>Atenção aos limites!</AlertTitle>
        <AlertDescription>
          O método de conexão via QR Code tem um limite de aproximadamente <strong>80 mensagens por dia</strong>. 
          Para envios em massa, considere usar a WhatsApp Cloud API.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              {statusLoading || loading ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p>Carregando...</p>
                </div>
              ) : connected ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">WhatsApp Conectado!</h3>
                  <p className="mb-6 text-muted-foreground">
                    Sua conta WhatsApp está conectada e pronta para uso.
                  </p>
                  <Button variant="destructive" onClick={handleDisconnect}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Desconectar WhatsApp
                  </Button>
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center">
                  <div className="mb-4 bg-white p-4 rounded-lg">
                    <img 
                      src={`data:image/png;base64,${qrCode}`} 
                      alt="QR Code para conexão com WhatsApp" 
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                  <p className="mb-4 text-center text-sm text-muted-foreground">
                    Abra o WhatsApp no seu celular, vá em Configurações &gt; Aparelhos vinculados &gt; Vincular um aparelho
                  </p>
                  <Button variant="outline" onClick={handleRefreshQrCode}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar novo QR Code
                  </Button>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center text-center">
                  <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">Erro na conexão</h3>
                  <p className="mb-6 text-muted-foreground">{error}</p>
                  <Button onClick={handleRefreshQrCode}>Tentar novamente</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Button onClick={handleRefreshQrCode}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Gerar QR Code
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Instruções de conexão</h3>
            <ol className="list-decimal ml-5 space-y-2 mb-6">
              <li>Clique em "Gerar QR Code" para exibir o código de conexão</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em Configurações (os três pontos no canto superior direito)</li>
              <li>Selecione "Aparelhos vinculados"</li>
              <li>Toque em "Vincular um aparelho"</li>
              <li>Escaneie o QR Code exibido na tela</li>
              <li>Aguarde a confirmação da conexão</li>
            </ol>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-2">Observações importantes</h3>
            <ul className="list-disc ml-5 space-y-2">
              <li>O QR Code expira após 45 segundos</li>
              <li>Mantenha o celular próximo ao computador durante o uso</li>
              <li>A conexão pode ser interrompida se o celular ficar sem internet por muito tempo</li>
              <li>Limite de aproximadamente 80 mensagens por dia para evitar bloqueios</li>
              <li>Não é recomendado usar o mesmo número em múltiplas conexões</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppQrCodePage;