import React from "react";
import { Link } from "wouter";
import { QrCode, CloudCog, Info, ArrowRight } from "lucide-react";
import PageTitle from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ConnectionsPage = () => {
  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<QrCode />}
        subtitle="Escolha a melhor opção para conectar seu WhatsApp"
      >
        Conexões
      </PageTitle>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          Escolha apenas uma das opções de conexão abaixo. Não é possível usar duas conexões simultaneamente.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="mr-2 h-5 w-5" />
              WhatsApp QR Code
            </CardTitle>
            <CardDescription>
              Conecte seu WhatsApp pessoal através do código QR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Características:</h3>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Fácil e rápido de configurar</li>
                <li>Usa seu número de WhatsApp pessoal</li>
                <li>Ideal para pequenas empresas</li>
                <li><span className="text-orange-500 font-semibold">Limite de 80 mensagens por dia</span></li>
              </ul>
            </div>
            
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-md">
              <p className="text-sm text-orange-700 dark:text-orange-400">
                <strong>Atenção:</strong> O WhatsApp limita contas pessoais a 80 mensagens por dia.
                Ultrapassar esse limite pode resultar em banimento temporário ou permanente da sua conta.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/conexoes/qrcode">
                Conectar com QR Code
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CloudCog className="mr-2 h-5 w-5" />
              WhatsApp Cloud API
            </CardTitle>
            <CardDescription>
              Use a API oficial do WhatsApp Business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Características:</h3>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>API oficial da Meta/Facebook</li>
                <li>Requer conta Business verificada</li>
                <li>Ideal para médias e grandes empresas</li>
                <li><span className="text-green-500 font-semibold">Envios ilimitados de mensagens</span></li>
              </ul>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-400">
                <strong>Recomendado:</strong> A WhatsApp Business API oficial permite envios ilimitados
                de mensagens sem risco de bloqueio, mas requer uma conta verificada da Meta.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/conexoes/cloud">
                Conectar com Cloud API
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Perguntas Frequentes</h2>
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Qual opção devo escolher?</h3>
            <p className="text-sm text-muted-foreground">
              Se você já tem uma conta verificada do WhatsApp Business API, escolha a opção Cloud API. 
              Para testes ou pequenas operações, a opção QR Code é mais simples, mas tem limitações diárias.
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">É possível alternar entre as opções?</h3>
            <p className="text-sm text-muted-foreground">
              Sim, você pode alternar entre as opções a qualquer momento. No entanto, será necessário desconectar
              a opção atual antes de usar a outra.
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Como obter acesso à Business API?</h3>
            <p className="text-sm text-muted-foreground">
              Para obter acesso à WhatsApp Business API, você precisa se cadastrar no Meta Business Manager e 
              solicitar acesso ou trabalhar com um provedor oficial parceiro da Meta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionsPage;