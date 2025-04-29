import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, XCircle, Smartphone, QrCode } from "lucide-react";
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
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full">
        {/* Cabeçalho da página */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <Smartphone className="h-8 w-8 text-primary" /> Conexão WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Conecte seu WhatsApp para gerenciar mensagens e leads automaticamente
          </p>
        </div>

        {/* Card principal */}
        <Card className="w-full shadow-lg border-t-4 border-t-primary">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Gerenciar Conexão</CardTitle>
            <CardDescription>
              {status?.connected 
                ? "Seu WhatsApp está conectado e pronto para uso" 
                : "Conecte seu WhatsApp para iniciar a integração"}
            </CardDescription>
            {loading && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
          </CardHeader>
          
          <CardContent className="pt-6">
            {status?.connected ? (
              <div className="flex flex-col items-center space-y-6">
                {/* Avatar do WhatsApp conectado */}
                <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-full w-28 h-28 flex items-center justify-center p-2 border-2 border-primary/20">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                    alt="WhatsApp" 
                    className="w-16 h-16" 
                  />
                </div>
                
                {/* Informações do dispositivo conectado */}
                <div className="text-center space-y-2 w-full max-w-xs">
                  <h2 className="text-xl font-semibold">{status.name || "Dispositivo Conectado"}</h2>
                  <p className="text-muted-foreground text-lg">{status.phone || "Número não disponível"}</p>
                  <span className="inline-block px-4 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    CONECTADO
                  </span>
                </div>
                
                {/* Botão de desconexão */}
                <div className="w-full max-w-xs pt-4">
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleDisconnect}
                    disabled={loading}
                  >
                    <XCircle className="mr-2 h-5 w-5" /> Desconectar WhatsApp
                  </Button>
                </div>
                
                {/* Informações adicionais */}
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <p>Seu WhatsApp está conectado e pronto para receber e enviar mensagens automaticamente.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                {status?.qrCode ? (
                  <div className="text-center space-y-4">
                    {/* Instruções de QR Code */}
                    <div className="bg-primary/10 rounded-lg p-4 max-w-md mx-auto">
                      <h3 className="font-medium flex items-center justify-center gap-2 mb-2">
                        <QrCode className="h-5 w-5 text-primary" /> Escaneie o QR code
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        1. Abra o WhatsApp no seu celular<br />
                        2. Toque em Menu ou Configurações<br />
                        3. Selecione WhatsApp Web<br />
                        4. Aponte a câmera para o QR code
                      </p>
                    </div>
                    
                    {/* QR Code */}
                    <div className="bg-white p-6 mx-auto rounded-xl shadow-md">
                      <div className="w-56 h-56 relative mx-auto">
                        <img 
                          src={`data:image/png;base64,${status.qrCode}`} 
                          alt="QR Code" 
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-8 max-w-md mx-auto">
                    {/* Ícone de WhatsApp */}
                    <div className="bg-primary/10 rounded-full w-24 h-24 mx-auto flex items-center justify-center p-2">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                        alt="WhatsApp" 
                        className="w-12 h-12 opacity-80" 
                      />
                    </div>
                    
                    {/* Descrição dos benefícios */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Benefícios da Conexão</h3>
                      <ul className="text-sm text-muted-foreground space-y-2 text-left max-w-xs mx-auto">
                        <li className="flex items-start">
                          <span className="text-primary mr-2">✓</span> 
                          <span>Envio automático de mensagens para leads</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">✓</span> 
                          <span>Receba respostas diretamente na plataforma</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">✓</span> 
                          <span>Integração com o sistema de recomendação de leads</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-primary mr-2">✓</span> 
                          <span>Automação de fluxos de comunicação</span>
                        </li>
                      </ul>
                    </div>
                    
                    {/* Botão de conexão */}
                    <Button 
                      className="w-full"
                      onClick={handleConnect}
                      disabled={connecting}
                      size="lg"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conectando...
                        </>
                      ) : (
                        <>Conectar WhatsApp</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Informações adicionais */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Problemas com a conexão? <a href="#" className="text-primary hover:underline">Consulte o guia de ajuda</a> ou entre em contato com o suporte.
          </p>
        </div>
      </div>
    </div>
  );
}