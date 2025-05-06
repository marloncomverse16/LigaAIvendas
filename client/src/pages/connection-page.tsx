import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, XCircle, Smartphone, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import websocketService from "@/services/websocket-service";

interface ConnectionStatus {
  connected: boolean;
  phone?: string;
  name?: string;
  qrCode?: string;
}

export default function ConnectionPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  // Verificar status atual ao carregar a página
  useEffect(() => {
    checkConnectionStatus();
    
    // Configurar event listeners para o WebSocket
    const handleConnectionStatus = (message: any) => {
      if (message.data) {
        setStatus(message.data);
        setLoading(false);
        
        if (message.data.connected) {
          toast({
            title: "Conectado",
            description: "WhatsApp conectado com sucesso!",
          });
        }
      }
    };
    
    const handleQrCode = (message: any) => {
      if (message.data?.qrCode) {
        setStatus(prev => ({ 
          ...prev, 
          qrCode: message.data.qrCode,
          connected: false
        }));
        setConnecting(false);
        
        toast({
          title: "QR Code Gerado",
          description: "Escaneie o QR code com seu WhatsApp para conectar",
        });
      }
    };
    
    const handleConnectionError = (message: any) => {
      setLoading(false);
      setConnecting(false);
      
      toast({
        title: "Erro de Conexão",
        description: message.error || "Ocorreu um erro na conexão",
        variant: "destructive",
      });
    };
    
    const handleApiConfigUpdated = (message: any) => {
      if (message.data) {
        toast({
          title: "Configurações Atualizadas",
          description: "Informações da API do WhatsApp foram atualizadas automaticamente",
        });
        
        // Tentar reconectar após atualização das configurações
        setTimeout(() => {
          handleConnect();
        }, 1000);
      }
    };
    
    // Registrar os handlers
    const removeStatusHandler = websocketService.on('connection_status', handleConnectionStatus);
    const removeQrCodeHandler = websocketService.on('qr_code', handleQrCode);
    const removeErrorHandler = websocketService.on('connection_error', handleConnectionError);
    const removeConfigHandler = websocketService.on('api_config_updated', handleApiConfigUpdated);
    
    // Limpar os handlers ao desmontar
    return () => {
      removeStatusHandler();
      removeQrCodeHandler();
      removeErrorHandler();
      removeConfigHandler();
    };
  }, [toast]);

  const checkConnectionStatus = () => {
    if (!user) return;
    
    setLoading(true);
    
    if (!websocketService.isConnected()) {
      websocketService.connect(user.id)
        .then(() => {
          // WebSocket conectado, solicitar status
          websocketService.getWhatsAppStatus((statusData) => {
            setStatus(statusData);
            setLoading(false);
          });
        })
        .catch(error => {
          console.error("Erro ao conectar WebSocket:", error);
          setLoading(false);
          toast({
            title: "Erro de Conexão",
            description: "Não foi possível conectar ao servidor",
            variant: "destructive",
          });
        });
    } else {
      // Já conectado, solicitar status
      websocketService.getWhatsAppStatus((statusData) => {
        setStatus(statusData);
        setLoading(false);
      });
    }
  };

  const handleConnect = () => {
    if (!user) {
      toast({
        title: "Não autenticado",
        description: "Faça login para conectar seu WhatsApp",
        variant: "destructive",
      });
      return;
    }
    
    setConnecting(true);
    
    if (!websocketService.isConnected()) {
      websocketService.connect(user.id)
        .then(() => {
          // WebSocket conectado, solicitar QR code
          websocketService.getQRCode((qrCode) => {
            setStatus(prev => ({ ...prev, qrCode, connected: false }));
            setConnecting(false);
          });
        })
        .catch(error => {
          console.error("Erro ao conectar WebSocket:", error);
          setConnecting(false);
          toast({
            title: "Erro de Conexão",
            description: "Não foi possível conectar ao servidor",
            variant: "destructive",
          });
        });
    } else {
      // Já conectado, solicitar QR code
      websocketService.getQRCode((qrCode) => {
        setStatus(prev => ({ ...prev, qrCode, connected: false }));
        setConnecting(false);
      });
    }
  };

  const handleDisconnect = () => {
    if (!user) return;
    
    setLoading(true);
    
    if (websocketService.isConnected()) {
      websocketService.sendMessage({
        type: 'disconnect_evolution',
      });
      
      // Atualizar estado localmente (a resposta real virá pelo WebSocket)
      setStatus(prev => ({ ...prev, connected: false }));
      
      toast({
        title: "Desconectando",
        description: "Desconectando o WhatsApp...",
      });
    } else {
      setLoading(false);
      toast({
        title: "Não conectado",
        description: "Não há conexão WebSocket ativa",
        variant: "destructive",
      });
    }
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
                        {/* Debugando o QR code */}
                        <div className="text-xs text-gray-400 mb-2">
                          {status.qrCode ? (
                            <>QR code disponível ({status.qrCode.substring(0, 30)}...)</>
                          ) : (
                            <>QR code não disponível</>
                          )}
                        </div>
                        
                        {/* Exibindo o QR code */}
                        {status.qrCode ? (
                          <div>
                            <img 
                              src={status.qrCode} 
                              alt="QR Code" 
                              className="w-full h-full"
                              onError={(e) => {
                                console.error("Erro ao carregar QR code:", status.qrCode?.substring(0, 100));
                                toast({
                                  title: "Erro ao carregar QR code",
                                  description: "Verifique se a URL do webhook está configurada corretamente nas configurações de usuário",
                                  variant: "destructive",
                                });
                                e.currentTarget.src = "data:image/png;base64,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";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              QR Code não disponível
                            </p>
                          </div>
                        )}
                      </div>
                      <Button 
                        onClick={handleConnect}
                        variant="outline"
                        className="mt-4 w-full"
                        disabled={connecting}
                      >
                        {connecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reconectando...
                          </>
                        ) : (
                          <>Reconectar</>
                        )}
                      </Button>
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