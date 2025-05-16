import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessagesSquare, AlertCircle, Loader2, RefreshCcw, ExternalLink } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
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
  
  // Verificar status da conexão Meta API
  const { data: metaStatus, isLoading: isLoadingMeta } = useQuery({
    queryKey: ["/api/connections/meta/status", refreshTrigger],
    queryFn: async () => {
      const res = await fetch("/api/connections/meta/status");
      if (!res.ok) throw new Error("Falha ao verificar status da conexão Meta");
      return res.json();
    },
    refetchInterval: 10000, // Refetch a cada 10 segundos
  });

  // Função para forçar atualização
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">CHAT</h1>
        <p className="text-muted-foreground">
          Visualize e interaja com as conversas do WhatsApp conectado
        </p>
      </div>
      
      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat">Chat WhatsApp</TabsTrigger>
          <TabsTrigger value="info">Informações de Conexão</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Verificando status da conexão...</span>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>
                Não foi possível verificar o status da conexão. Por favor, tente novamente.
              </AlertDescription>
            </Alert>
          ) : connectionStatus?.connected || metaStatus?.connected ? (
            <Card className="border-0 shadow-none overflow-hidden">
              <CardHeader className="bg-primary/5 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessagesSquare className="h-5 w-5 mr-2 text-primary" />
                    <span className="font-medium">
                      {metaStatus?.connected 
                        ? "WhatsApp Meta API Conectado" 
                        : "WhatsApp QR Code Conectado"}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRefresh}>
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[75vh]">
                {metaStatus?.connected ? (
                  <div className="h-full flex items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <h3 className="text-xl font-bold mb-4">Conexão via Meta API Ativa</h3>
                      <p className="text-muted-foreground mb-6">
                        Sua conexão direta com a API oficial do WhatsApp Business está ativa.
                        Para enviar mensagens, utilize a página de Envio de Mensagens configurada para usar Meta API.
                      </p>
                      <Button onClick={() => window.location.href = "/message-sending"}>
                        Ir para Envio de Mensagens
                      </Button>
                    </div>
                  </div>
                ) : connectionStatus?.connected ? (
                  /* Frame para exibir o WhatsApp Web via QR Code */
                  <div className="w-full h-full flex flex-col">
                    <div className="bg-whatsapp-light dark:bg-whatsapp-dark p-2 text-xs text-white">
                      <div className="text-center">
                        ⚠️ Este é um visualizador de WhatsApp Web embutido. Para uma experiência completa, use o botão abaixo para abrir em nova janela.
                      </div>
                      <div className="mt-1 text-center">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="bg-white/20 hover:bg-white/30 text-white"
                          onClick={() => {
                            if (user?.whatsappInstanceWebhook) {
                              window.open(user.whatsappInstanceWebhook, '_blank');
                            }
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir em Nova Janela
                        </Button>
                      </div>
                    </div>
                    <iframe 
                      src={user?.whatsappInstanceWebhook ? user.whatsappInstanceWebhook : "about:blank"} 
                      className="w-full flex-1 border-0"
                      title="WhatsApp Web"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <h3 className="text-xl font-bold mb-4">WhatsApp Não Conectado</h3>
                      <p className="text-muted-foreground mb-6">
                        Para visualizar o chat do WhatsApp, conecte-se primeiro usando a página de Conexões.
                      </p>
                      <Button onClick={() => window.location.href = "/connections"}>
                        Ir para Página de Conexões
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp Não Conectado</CardTitle>
                <CardDescription>
                  Você precisa conectar seu WhatsApp antes de acessar o chat.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Conexão necessária</AlertTitle>
                  <AlertDescription>
                    Acesse a página "Conexões" para configurar seu WhatsApp via QR Code ou API Meta.
                  </AlertDescription>
                </Alert>
                <div className="mt-4">
                  <Button onClick={() => window.location.href = "/conexoes"}>
                    Ir para Página de Conexões
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Conexão</CardTitle>
              <CardDescription>
                Detalhes sobre sua conexão atual do WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>
                    Falha ao carregar informações de conexão
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {/* Informações da conexão QR Code */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-base font-medium mb-3">WhatsApp QR Code</h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                        <p className="font-medium">
                          {connectionStatus?.connected ? (
                            <span className="text-green-600">Conectado</span>
                          ) : (
                            <span className="text-red-600">Desconectado</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Última Atualização</h4>
                        <p className="font-medium">
                          {connectionStatus?.lastUpdated ? new Date(connectionStatus.lastUpdated).toLocaleString() : "-"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">ID da Instância</h4>
                      <p className="font-medium break-all">
                        {user?.whatsappInstanceId || "Não configurado"}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Webhook da Instância</h4>
                      <p className="font-medium break-all">
                        {user?.whatsappInstanceWebhook || "Não configurado"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Informações da conexão Meta API */}
                  <div className="rounded-lg border p-4">
                    <h3 className="text-base font-medium mb-3">WhatsApp Meta API</h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                        <p className="font-medium">
                          {metaStatus?.connected ? (
                            <span className="text-green-600">Conectado</span>
                          ) : (
                            <span className="text-red-600">Desconectado</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Tipo</h4>
                        <p className="font-medium">
                          API Oficial Meta Business
                        </p>
                      </div>
                    </div>
                    
                    {metaStatus?.connected && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Recurso Disponível</h4>
                        <p className="font-medium">
                          Envio de mensagens via página de Envio de Mensagens usando templates aprovados
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4">
                    <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Importante</AlertTitle>
                      <AlertDescription>
                        A interface do WhatsApp Web exibida aqui é fornecida pelo serviço de webhook configurado.
                        Algumas funcionalidades podem ser limitadas devido às restrições de segurança do iframe.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}