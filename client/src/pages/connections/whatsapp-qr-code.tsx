import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, QrCode, Loader2, AlertCircle, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
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
  const hookResult = useWebSocket();
  const { connectionStatus, lastMessage } = hookResult;

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
      setConnected(statusData.connected && !statusData.cloudConnection);
      if (statusData.qrcode) {
        setQrCode(statusData.qrcode);
      }
    }
  }, [statusData]);

  // Processa mensagens do WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'qr_code') {
      setQrCode(lastMessage.data.qrcode);
    } else if (lastMessage && lastMessage.type === 'connection_status') {
      setConnected(lastMessage.data.connected);
      refetchStatus();
    }
  }, [lastMessage, refetchStatus]);

  // QR Code mutation
  const qrCodeMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
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
      if (data.qrcode) {
        setQrCode(data.qrcode);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o código QR com seu aplicativo WhatsApp",
          variant: "default"
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível gerar o QR Code",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar QR Code",
        description: error.message || "Tente novamente mais tarde",
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

  // Função para gerar QR Code
  const handleGenerateQrCode = () => {
    qrCodeMutation.mutate();
  };

  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<QrCode />}
        subtitle="Conecte seu WhatsApp pessoal através do código QR"
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

      <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertTitle className="text-amber-800 dark:text-amber-400">Limite de Mensagens</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          O WhatsApp limita contas pessoais a <strong>80 mensagens por dia</strong> para números não 
          salvos em sua agenda. Exceder esse limite pode resultar em bloqueio temporário ou permanente da sua conta.
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
                <p className="mb-6 text-muted-foreground">
                  Seu WhatsApp está conectado e pronto para enviar e receber mensagens.
                </p>
                <Button variant="destructive" onClick={handleDisconnect}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Desconectar WhatsApp
                </Button>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                <div className="bg-white p-4 rounded-md mb-4">
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-center mb-4 text-muted-foreground">
                  Escaneie o código QR usando o aplicativo WhatsApp no seu celular
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerateQrCode}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Gerar Novo QR Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold mb-2">Conectar WhatsApp</h3>
                <p className="mb-6 text-center text-muted-foreground">
                  Clique no botão abaixo para gerar um código QR e conectar seu WhatsApp
                </p>
                <Button onClick={handleGenerateQrCode}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Como conectar</h3>
            <ol className="list-decimal ml-5 space-y-2 mb-6 text-sm text-muted-foreground">
              <li>Clique em "Gerar QR Code"</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em Menu (⋮) ou Configurações</li>
              <li>Selecione "Aparelhos conectados" ou "WhatsApp Web"</li>
              <li>Aponte a câmera para o código QR exibido nesta tela</li>
              <li>Aguarde a conexão ser estabelecida</li>
            </ol>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-2">Dicas importantes</h3>
            <ul className="list-disc ml-5 space-y-2 mb-6 text-sm text-muted-foreground">
              <li>Mantenha seu celular carregado e conectado à internet</li>
              <li>Não feche o aplicativo WhatsApp no seu celular</li>
              <li>Evite enviar mais de 80 mensagens por dia para contatos não salvos</li>
              <li>Evite enviar a mesma mensagem para muitos contatos em sequência</li>
              <li>Se possível, adicione os números à sua agenda antes de enviar mensagens</li>
            </ul>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Evite o bloqueio</AlertTitle>
              <AlertDescription className="text-sm">
                Para evitar bloqueios do WhatsApp, adicione variações nas mensagens e evite
                enviar muitas mensagens em curtos períodos.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppQrCodePage;