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
  // Temporariamente removendo a referência ao WebSocket até ser implementado
  // const hookResult = useWebSocket();
  // const { connectionStatus, lastMessage } = hookResult;
  const [lastMessage, setLastMessage] = useState<any>(null);

  // Verifica o status da conexão
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["connections", "status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/connections/status");
      const data = await response.json();
      console.log("Status recebido:", data);
      return data;
    },
    refetchInterval: 5000, // Verificação a cada 5 segundos para atualização mais rápida
  });

  // Quando o status é carregado, atualiza o estado de conexão
  useEffect(() => {
    if (statusData) {
      // Verificar se está conectado e não é conexão cloud
      const isConnected = statusData.connected === true && !statusData.cloudConnection;
      console.log("Status de conexão recebido do servidor:", statusData);
      console.log("Estado de conexão:", isConnected ? "CONECTADO ✅" : "DESCONECTADO ❌");
      
      // Atualizar estado local
      setConnected(isConnected);
      
      // Se tiver um QR code e não estiver conectado, exibir
      if (!isConnected && (statusData.qrcode || statusData.qrCode)) {
        const code = statusData.qrcode || statusData.qrCode;
        console.log("QR Code encontrado, atualizando visualização");
        setQrCode(code);
      } else if (isConnected) {
        // Se estiver conectado, limpar o QR code
        console.log("Conexão estabelecida, removendo QR code");
        setQrCode(null);
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
        console.log("Solicitando QR Code...");
        const response = await apiRequest("POST", "/api/connections/qrcode", { mode: "qr" });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Erro do servidor:", errorData);
          throw new Error(errorData.error || errorData.message || "Falha ao gerar QR Code");
        }
        
        const data = await response.json();
        console.log("Resposta do servidor:", data);
        return data;
      } catch (error) {
        console.error("Erro ao solicitar QR Code:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: (data) => {
      console.log("Dados recebidos no onSuccess:", data);
      
      // Verificar diferentes formatos de QR code na resposta
      const qrCodeData = data.qrCode || data.qrcode || data.base64;
      
      if (qrCodeData) {
        console.log("QR Code encontrado, definindo estado...");
        setQrCode(qrCodeData);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o código QR com seu aplicativo WhatsApp",
          variant: "default"
        });
      } else {
        console.error("QR Code não encontrado na resposta:", data);
        toast({
          title: "Erro",
          description: "Não foi possível gerar o QR Code",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      let errorMessage = "Tente novamente mais tarde";
      
      // Extrair mensagem de erro da resposta da API se disponível
      if (error.data && error.data.error) {
        errorMessage = error.data.error;
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error("Erro detalhado:", error);
      
      toast({
        title: "Erro ao gerar QR Code",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Desconexão do WhatsApp
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);
      try {
        console.log("Solicitando desconexão do WhatsApp...");
        const response = await apiRequest("POST", "/api/connections/disconnect", { mode: "disconnect" });
        
        console.log("Status da resposta:", response.status);
        console.log("Headers da resposta:", response.headers);
        
        // Tentar obter o texto da resposta primeiro
        const responseText = await response.text();
        console.log("Texto bruto da resposta:", responseText);
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = JSON.parse(responseText);
          } catch (parseError) {
            console.error("Erro ao fazer parse do JSON de erro:", parseError);
            throw new Error(`Erro ${response.status}: ${responseText}`);
          }
          console.error("Erro do servidor na desconexão:", errorData);
          throw new Error(errorData.error || errorData.message || "Falha ao desconectar WhatsApp");
        }
        
        // Tentar fazer parse do JSON de sucesso
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Erro ao fazer parse do JSON de sucesso:", parseError);
          throw new Error("Resposta do servidor não é JSON válido");
        }
        
        console.log("Resposta da desconexão:", data);
        return data;
      } catch (error) {
        console.error("Erro ao desconectar WhatsApp:", error);
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
    onError: (error: any) => {
      let errorMessage = "Não foi possível desconectar o WhatsApp";
      
      // Extrair mensagem de erro da resposta da API se disponível
      if (error.data && error.data.error) {
        errorMessage = error.data.error;
      } else if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error("Erro detalhado na desconexão:", error);
      
      toast({
        title: "Erro ao desconectar",
        description: errorMessage,
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
          O WhatsApp limita contas pessoais a um número reduzido de mensagens por dia para números não 
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
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                    onError={(e) => {
                      console.error("Erro ao carregar QR code:", qrCode.substring(0, 100) + "...");
                      e.currentTarget.style.display = 'none';
                      toast({
                        title: "Erro ao exibir QR Code",
                        description: "Tente gerar novamente",
                        variant: "destructive"
                      });
                    }}
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
                <Button 
                  onClick={handleGenerateQrCode}
                  className="bg-gradient-to-r from-orange-400 to-yellow-400 hover:from-orange-500 hover:to-yellow-500 text-black font-semibold"
                >
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
              <li>Evite enviar muitas mensagens por dia para contatos não salvos</li>
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