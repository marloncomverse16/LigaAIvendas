import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessagesSquare, AlertCircle, Loader2, QrCode, RefreshCcw } from "lucide-react";

export default function ChatWebView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Verificar status da conexão do WhatsApp QR Code
  const { data: connectionStatus, isLoading, error } = useQuery({
    queryKey: ["/api/connections/status", refreshTrigger],
    queryFn: async () => {
      const res = await fetch("/api/connections/status");
      if (!res.ok) throw new Error("Falha ao verificar status da conexão");
      return res.json();
    },
    refetchInterval: 10000, // Refetch a cada 10 segundos
  });

  // Função para forçar atualização
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Atualizando",
      description: "Verificando status da conexão...",
      duration: 2000,
    });
  };
  
  // Função para conectar ao WhatsApp (iniciar QR Code)
  const handleConnect = async () => {
    try {
      const res = await fetch("/api/connections/connect", {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Falha ao solicitar conexão");
      }
      
      toast({
        title: "QR Code gerado",
        description: "Escaneie o QR Code com seu WhatsApp para conectar",
        duration: 5000,
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao solicitar conexão",
        variant: "destructive",
      });
    }
  };
  
  // Função para desconectar do WhatsApp
  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/connections/disconnect", {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Falha ao desconectar");
      }
      
      toast({
        title: "Desconectado",
        description: "WhatsApp foi desconectado com sucesso",
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao desconectar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Web</h1>
          <p className="text-muted-foreground mt-1">
            Acesse suas conversas do WhatsApp diretamente na plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          {connectionStatus?.connected ? (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              Desconectar
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isLoading}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Conectar
            </Button>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-[500px] w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível verificar o status da conexão. Por favor, tente novamente.
          </AlertDescription>
        </Alert>
      ) : connectionStatus?.connected ? (
        <Card className="border-0 shadow-none overflow-hidden h-[calc(100vh-200px)]">
          <div className="h-full flex flex-col">
            <div className="bg-[#128C7E] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <MessagesSquare className="h-5 w-5 mr-2" />
                <span className="font-medium">WhatsApp Conectado</span>
              </div>
              <div className="text-xs bg-white/20 px-2 py-1 rounded">
                Conectado em tempo real
              </div>
            </div>
            
            {user?.whatsappInstanceWebhook ? (
              <iframe 
                src={user.whatsappInstanceWebhook}
                className="w-full flex-1 border-0"
                title="WhatsApp Web"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-6">
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">URL do WhatsApp Web não configurada</h3>
                  <p className="text-muted-foreground mb-4">
                    O URL do WhatsApp Web não está definido nas suas configurações.
                  </p>
                  <Button onClick={() => window.location.href = "/connections"}>
                    Configurar Conexão
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : connectionStatus?.qrCode ? (
        <Card className="p-8">
          <div className="space-y-4 max-w-md mx-auto text-center">
            <h2 className="text-xl font-semibold">Conecte seu WhatsApp</h2>
            <p className="text-muted-foreground">
              Para utilizar o WhatsApp Web, escaneie o QR Code abaixo com seu celular
            </p>
            
            <div className="relative w-64 h-64 mx-auto border rounded-lg overflow-hidden">
              <img 
                src={connectionStatus.qrCode} 
                alt="QR Code do WhatsApp" 
                className="w-full h-full" 
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">No seu celular, abra o WhatsApp:</p>
              <ol className="text-left list-decimal ml-8">
                <li>Toque em Menu ou Configurações</li>
                <li>Selecione Aparelhos conectados</li>
                <li>Toque em Conectar um aparelho</li>
                <li>Escaneie este QR Code</li>
              </ol>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="space-y-4 max-w-md mx-auto text-center">
            <h2 className="text-xl font-semibold">WhatsApp Não Conectado</h2>
            <p className="text-muted-foreground mb-4">
              Para acessar suas conversas do WhatsApp, conecte sua conta clicando no botão abaixo.
            </p>
            <Button onClick={handleConnect}>
              <QrCode className="h-4 w-4 mr-2" />
              Conectar WhatsApp
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}