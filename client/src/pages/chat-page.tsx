import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessagesSquare, AlertCircle, Loader2, RefreshCcw } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Verificar status da conexão do WhatsApp
  const { data: connectionStatus, isLoading, error } = useQuery({
    queryKey: ["/api/connection/status", refreshTrigger],
    queryFn: async () => {
      const res = await fetch("/api/connection/status");
      if (!res.ok) throw new Error("Falha ao verificar status da conexão");
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
          <TabsTrigger value="chat">Chat WhatsApp Web</TabsTrigger>
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
          ) : connectionStatus?.connected ? (
            <Card className="border-0 shadow-none overflow-hidden">
              <CardHeader className="bg-primary/5 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessagesSquare className="h-5 w-5 mr-2 text-primary" />
                    <span className="font-medium">WhatsApp Web Conectado</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRefresh}>
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[75vh]">
                {/* Frame para exibir o WhatsApp Web */}
                <iframe 
                  src={user?.whatsappInstanceWebhook ? user.whatsappInstanceWebhook : "about:blank"} 
                  className="w-full h-full border-0"
                  title="WhatsApp Web"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
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
                    Acesse a página "Conexão WhatsApp" para escanear o QR code e conectar sua conta.
                  </AlertDescription>
                </Alert>
                <div className="mt-4">
                  <Button onClick={() => window.location.href = "/connection"}>
                    Ir para Página de Conexão
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
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                      <p className="font-medium">
                        {connectionStatus?.connected ? (
                          <span className="text-green-600">Conectado</span>
                        ) : (
                          <span className="text-red-600">Desconectado</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Última Atualização</h3>
                      <p className="font-medium">
                        {connectionStatus?.lastUpdated ? new Date(connectionStatus.lastUpdated).toLocaleString() : "-"}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">ID da Instância</h3>
                    <p className="font-medium break-all">
                      {user?.whatsappInstanceId || "Não configurado"}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Webhook da Instância</h3>
                    <p className="font-medium break-all">
                      {user?.whatsappInstanceWebhook || "Não configurado"}
                    </p>
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