import React from "react";
import { Link } from "wouter";
import { 
  QrCode, 
  Cloud, 
  ArrowRight, 
  MessageSquareWarning, 
  CheckCircle2, 
  AlertTriangle
} from "lucide-react";
import PageTitle from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const ConnectionsPage = () => {
  // Verificar o status da conexão
  const { data: connectionStatus, isLoading } = useQuery({
    queryKey: ["connections", "status"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/connections/status");
        return await response.json();
      } catch (error) {
        console.error("Erro ao verificar status da conexão:", error);
        return { connected: false };
      }
    },
    refetchInterval: 30000 // Refaz a verificação a cada 30 segundos
  });

  const isConnected = connectionStatus?.connected || false;
  const isCloudConnection = connectionStatus?.cloudConnection || false;

  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<Cloud />}
        subtitle="Gerencie suas conexões com WhatsApp e outros serviços"
      >
        Conexões
      </PageTitle>

      {isConnected && (
        <div className="mb-6">
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-400">
                    WhatsApp Conectado
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {isCloudConnection 
                      ? "Você está conectado através da API Cloud do WhatsApp." 
                      : "Você está conectado através de WhatsApp Web (QR Code)."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <span>WhatsApp QR Code</span>
              </CardTitle>
              {isConnected && !isCloudConnection && (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700">
                  Conectado
                </Badge>
              )}
            </div>
            <CardDescription>
              Conecte seu WhatsApp pessoal escaneando um código QR, similar ao WhatsApp Web
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MessageSquareWarning className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Limite:</strong> 80 mensagens/dia para números não salvos
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p>
                  WhatsApp pode bloquear contas que enviam muitas mensagens em sequência
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/conexoes/whatsapp-qr-code">
                {isConnected && !isCloudConnection ? "Gerenciar Conexão" : "Conectar com QR Code"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                <span>WhatsApp Cloud API</span>
              </CardTitle>
              {isConnected && isCloudConnection && (
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700">
                  Conectado
                </Badge>
              )}
            </div>
            <CardDescription>
              Conecte uma conta WhatsApp Business verificada através da API oficial do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span><strong>Sem limites</strong> de mensagens diárias</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Envio em massa permitido</span>
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Conexão estável sem necessidade de smartphone</span>
              </p>
              <Separator className="my-2" />
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>Requer conta WhatsApp Business verificada com autorização da Meta</span>
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" variant="outline">
              <Link to="/conexoes/whatsapp-cloud">
                {isConnected && isCloudConnection ? "Gerenciar Conexão" : "Conectar via Cloud API"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ConnectionsPage;