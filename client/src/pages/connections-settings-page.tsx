import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { WebhookConfig } from '@/components/settings/webhook-config';
import { Loader2 } from 'lucide-react';

export default function ConnectionsSettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carregamento das configurações
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 p-4 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de Conexão</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações relacionadas às suas conexões WhatsApp
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="webhook" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="webhook">Webhook Evolution API</TabsTrigger>
              <TabsTrigger value="meta">Meta Cloud API</TabsTrigger>
            </TabsList>
            
            <TabsContent value="webhook" className="space-y-4">
              <WebhookConfig />
            </TabsContent>
            
            <TabsContent value="meta" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações da Meta Cloud API</CardTitle>
                  <CardDescription>
                    Configure a conexão com a API WhatsApp do Meta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    As configurações da Meta Cloud API são gerenciadas na seção de administração.
                    Acesse a página de configuração de servidores para definir os parâmetros da Meta API.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}