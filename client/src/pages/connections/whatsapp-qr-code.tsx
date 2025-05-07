import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, QrCode, CheckCircle, PhoneOff, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/services/websocket-service";

export default function WhatsAppQrCodePage() {
  const { toast } = useToast();
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  
  // Para receber atualizações em tempo real do status da conexão
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
  
  // Mutation para conectar
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/connection/connect");
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.qrCode) {
        setQrCodeImage(data.qrCode);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp para conectar",
        });
      } else if (data.success && data.connected) {
        toast({
          title: "WhatsApp já conectado",
          description: "Seu WhatsApp já está conectado",
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/connection/status"] });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Não foi possível gerar o QR Code",
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
          description: "Seu WhatsApp foi desconectado com sucesso",
          variant: "success",
        });
        setQrCodeImage(null);
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
  
  // Processa mensagens do WebSocket
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        if (data.type === 'whatsapp_connection') {
          if (data.connected) {
            toast({
              title: "WhatsApp conectado",
              description: "Seu WhatsApp foi conectado com sucesso",
              variant: "success",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/connection/status"] });
          } else if (data.qrCode) {
            setQrCodeImage(data.qrCode);
          }
        }
      } catch (e) {
        console.error("Erro ao processar mensagem do WebSocket", e);
      }
    }
  }, [lastMessage, toast]);
  
  // Função para reconectar e regenerar o QR code
  const handleReconnect = () => {
    setQrCodeImage(null);
    connectMutation.mutate();
  };
  
  // Função para desconectar
  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };
  
  const isConnected = connectionStatus?.connected;
  const isConnecting = connectMutation.isPending;
  const isDisconnecting = disconnectMutation.isPending;
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <PageTitle 
          title="WhatsApp QR Code" 
          description="Conecte seu WhatsApp escaneando o QR Code"
        />
        <Link href="/conexoes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
      
      <Alert variant="warning" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Este tipo de conexão <strong>NÃO É INDICADO PARA ENVIO DE MENSAGENS EM MASSA</strong> e pode causar o bloqueio do seu WhatsApp.
          Para uma maior segurança, recomendamos não enviar mais que 80 mensagens diárias.
          Para maiores quantidades de envio, utilize o tipo de conexão WhatsApp Cloud!
        </AlertDescription>
      </Alert>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Instruções de Conexão</CardTitle>
          <CardDescription>
            Siga os passos abaixo para conectar seu WhatsApp ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2">
            <li>Clique no botão <strong>Conectar WhatsApp</strong> abaixo</li>
            <li>Um QR Code será exibido na tela</li>
            <li>Abra o WhatsApp no seu celular</li>
            <li>Toque em Mais opções (...) ou Configurações e selecione WhatsApp Web</li>
            <li>Toque em + ou em Vincular dispositivo</li>
            <li>Aponte a câmera do seu celular para esta tela para escanear o QR Code</li>
            <li>Aguarde a confirmação de conexão</li>
          </ol>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Status da Conexão</CardTitle>
          <CardDescription>
            {isLoading ? (
              "Verificando status da conexão..."
            ) : isConnected ? (
              "Seu WhatsApp está conectado ao sistema"
            ) : (
              "Seu WhatsApp não está conectado"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p>Verificando status da conexão...</p>
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">WhatsApp Conectado</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Seu WhatsApp está conectado e pronto para uso. 
                Você pode enviar e receber mensagens normalmente.
              </p>
              {connectionStatus?.phoneNumber && (
                <p className="mt-4 font-medium">
                  Número conectado: {connectionStatus.phoneNumber}
                </p>
              )}
            </div>
          ) : qrCodeImage ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="bg-white p-4 rounded-lg mb-4">
                <img 
                  src={`data:image/png;base64,${qrCodeImage}`} 
                  alt="QR Code para WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                Escaneie este QR Code com o seu WhatsApp para conectar.
                O QR Code expira em poucos minutos.
              </p>
              <Button 
                variant="outline" 
                className="mb-4"
                onClick={handleReconnect}
                disabled={isConnecting}
              >
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar novo QR Code
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">WhatsApp Desconectado</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Seu WhatsApp não está conectado. Clique no botão abaixo para gerar um QR Code e conectar.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pt-2 pb-6">
          {isConnected ? (
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
              Desconectar WhatsApp
            </Button>
          ) : !qrCodeImage && (
            <Button 
              onClick={handleReconnect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              Conectar WhatsApp
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}