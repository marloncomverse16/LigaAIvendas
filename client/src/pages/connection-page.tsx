import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ConnectionStatus {
  connected: boolean;
  phone?: string;
  name?: string;
  qrCode?: string;
}

export default function ConnectionPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  // Verificar status atual ao carregar a página
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/connection/status");
      if (!response.ok) {
        throw new Error("Falha ao verificar status da conexão");
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar o status da conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await apiRequest("POST", "/api/connection/connect", {});
      if (!response.ok) {
        throw new Error("Falha ao iniciar conexão");
      }
      const data = await response.json();
      setStatus(data);

      // Se recebeu um QR code, começar a verificar o status periodicamente
      if (data.qrCode) {
        startPolling();
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conexão",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("POST", "/api/connection/disconnect", {});
      if (!response.ok) {
        throw new Error("Falha ao desconectar");
      }
      
      setStatus({ connected: false });
      toast({
        title: "Desconectado",
        description: "Dispositivo desconectado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desconectar o dispositivo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para polling de status ao tentar conectar
  const startPolling = () => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch("/api/connection/status");
        if (!response.ok) {
          clearInterval(intervalId);
          return;
        }
        const data = await response.json();
        setStatus(data);
        
        // Se conectado, parar o polling
        if (data.connected) {
          clearInterval(intervalId);
          toast({
            title: "Conectado",
            description: "WhatsApp conectado com sucesso!",
          });
        }
      } catch (error) {
        console.error("Erro no polling:", error);
        clearInterval(intervalId);
      }
    }, 3000); // Verificar a cada 3 segundos

    // Limpar intervalo após 2 minutos (tempo máximo de espera)
    setTimeout(() => {
      clearInterval(intervalId);
    }, 120000);
  };

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
        <span className="text-primary">📱</span> Conexão WhatsApp
      </h1>

      <Card className="w-full">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-xl">Gerenciar Conexão</CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardHeader>
        
        <CardContent>
          {status?.connected ? (
            <div className="flex flex-col items-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-24 h-24 mb-4 flex items-center justify-center">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                  alt="WhatsApp" 
                  className="w-12 h-12" 
                />
              </div>
              
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold">{status.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">{status.phone}</p>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mt-2">
                  ATIVO
                </span>
              </div>
              
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={handleDisconnect}
                disabled={loading}
              >
                <XCircle className="mr-2 h-4 w-4" /> Excluir Conexão
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {status?.qrCode ? (
                <div className="mb-6">
                  <p className="text-center mb-4 text-sm">
                    Escaneie o QR code com seu WhatsApp para conectar
                  </p>
                  <div className="bg-white p-4 mx-auto w-48 h-48 rounded-md">
                    <img 
                      src={`data:image/png;base64,${status.qrCode}`} 
                      alt="QR Code" 
                      className="w-full h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center mb-6">
                  <p className="mb-4 text-sm">
                    Conecte seu WhatsApp para gerenciar mensagens e leads automaticamente
                  </p>
                  <Button 
                    className="w-40"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...
                      </>
                    ) : (
                      "Conectar WhatsApp"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}