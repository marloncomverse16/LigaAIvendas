import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Cloud } from "lucide-react";
import { PageTitle } from "@/components/ui/page-title";

export default function ConnectionsPage() {
  const [location] = useLocation();
  
  return (
    <div className="container mx-auto py-6">
      <PageTitle title="Conexões" description="Gerencie suas conexões de WhatsApp" />
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 mt-6">
        <Link href="/conexoes/whatsapp-qr-code">
          <Card className="cursor-pointer hover:border-primary transition-all duration-200 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span>WhatsApp QR Code</span>
              </CardTitle>
              <CardDescription>
                Conexão com WhatsApp via QR Code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte o WhatsApp escaneando um QR Code com seu celular. 
                Ideal para uso pessoal e envios em volume baixo.
              </p>
              <Button variant="outline" className="w-full">
                Acessar
              </Button>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/conexoes/whatsapp-cloud">
          <Card className="cursor-pointer hover:border-primary transition-all duration-200 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                <span>WhatsApp Cloud</span>
              </CardTitle>
              <CardDescription>
                Conexão com WhatsApp Business Cloud API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte-se à API oficial do WhatsApp Business Cloud. 
                Recomendado para envios em massa e uso profissional.
              </p>
              <Button variant="outline" className="w-full">
                Acessar
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}