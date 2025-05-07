import React from "react";
import { Link } from "wouter";
import { Phone, QrCode, CloudCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageTitle from "@/components/ui/page-title";

const ConnectionsPage = () => {
  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        icon={<Phone />}
        subtitle="Escolha o método de conexão para seu WhatsApp"
      >
        Conexões
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opção de QR Code */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold">WhatsApp QR Code</CardTitle>
            <QrCode className="h-8 w-8 text-primary" />
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm mb-4">
              Conecte com QR Code (método tradicional). <span className="text-red-500 font-semibold">Limite de 80 mensagens por dia!</span>
            </CardDescription>
            <p className="text-sm mb-6">
              Use este método para conectar um número WhatsApp normal através da leitura de um código QR.
              Ideal para testes e envios em baixo volume.
            </p>
            <div className="flex justify-end">
              <Button asChild>
                <Link to="/conexoes/whatsapp-qr-code">Configurar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Opção de Cloud API */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold">WhatsApp Cloud API</CardTitle>
            <CloudCog className="h-8 w-8 text-primary" />
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm mb-4">
              Conecte com WhatsApp Business API. <span className="text-green-500 font-semibold">Mensagens ilimitadas!</span>
            </CardDescription>
            <p className="text-sm mb-6">
              Use este método para conectar uma conta WhatsApp Business oficial do Meta.
              Ideal para envios em alto volume e automações corporativas.
            </p>
            <div className="flex justify-end">
              <Button asChild>
                <Link to="/conexoes/whatsapp-cloud">Configurar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConnectionsPage;