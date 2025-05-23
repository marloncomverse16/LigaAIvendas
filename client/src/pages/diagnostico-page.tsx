import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Database, MessageSquare, Settings, CheckCircle, XCircle } from "lucide-react";

export default function DiagnosticoPage() {
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      console.log('🔍 Iniciando diagnóstico completo...');
      
      // 1. Verificar tabelas do banco de dados
      const dbResponse = await fetch('/api/diagnostico/database');
      const dbData = await dbResponse.json();
      
      // 2. Verificar mensagens recebidas
      const receivedResponse = await fetch('/api/diagnostico/messages/received');
      const receivedData = await receivedResponse.json();
      
      // 3. Verificar mensagens enviadas
      const sentResponse = await fetch('/api/diagnostico/messages/sent');
      const sentData = await sentResponse.json();
      
      // 4. Verificar endpoint unificado
      const unifiedResponse = await fetch('/api/whatsapp-cloud/messages/554391142751');
      const unifiedData = await unifiedResponse.json();
      
      // 5. Verificar configurações do usuário
      const settingsResponse = await fetch('/api/settings');
      const settingsData = await settingsResponse.json();

      setDiagnosticData({
        database: dbData,
        received: receivedData,
        sent: sentData,
        unified: unifiedData,
        settings: settingsData,
        timestamp: new Date().toLocaleString()
      });
      
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      setDiagnosticData({
        error: error.message,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status, label }: { status: boolean; label: string }) => (
    <Badge variant={status ? "default" : "destructive"} className="gap-1">
      {status ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔍 Diagnóstico do Sistema</h1>
          <p className="text-muted-foreground">
            Análise completa do chat e banco de dados
          </p>
        </div>
        
        <Button onClick={runDiagnostic} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analisando...' : 'Executar Diagnóstico'}
        </Button>
      </div>

      {diagnosticData && (
        <div className="space-y-6">
          {/* Resumo Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Resumo do Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Banco de Dados</p>
                  <StatusBadge 
                    status={diagnosticData.database?.success} 
                    label={diagnosticData.database?.success ? 'OK' : 'Erro'} 
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mensagens Recebidas</p>
                  <StatusBadge 
                    status={diagnosticData.received?.success} 
                    label={`${diagnosticData.received?.count || 0} msgs`} 
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mensagens Enviadas</p>
                  <StatusBadge 
                    status={diagnosticData.sent?.success} 
                    label={`${diagnosticData.sent?.count || 0} msgs`} 
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Endpoint Unificado</p>
                  <StatusBadge 
                    status={diagnosticData.unified?.length > 0} 
                    label={`${diagnosticData.unified?.length || 0} total`} 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Última atualização: {diagnosticData.timestamp}
              </p>
            </CardContent>
          </Card>

          {/* Detalhes por Abas */}
          <Tabs defaultValue="database" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="database" className="gap-1">
                <Database className="h-4 w-4" />
                Banco
              </TabsTrigger>
              <TabsTrigger value="received" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                Recebidas
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                Enviadas
              </TabsTrigger>
              <TabsTrigger value="unified" className="gap-1">
                <RefreshCw className="h-4 w-4" />
                Unificado
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database">
              <Card>
                <CardHeader>
                  <CardTitle>📊 Análise das Tabelas do Banco</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(diagnosticData.database, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="received">
              <Card>
                <CardHeader>
                  <CardTitle>📥 Mensagens Recebidas (Meta Cloud API)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(diagnosticData.received, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sent">
              <Card>
                <CardHeader>
                  <CardTitle>📤 Mensagens Enviadas (chat_messages_sent)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(diagnosticData.sent, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="unified">
              <Card>
                <CardHeader>
                  <CardTitle>🔗 Endpoint Unificado (/api/whatsapp-cloud/messages)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(diagnosticData.unified, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>⚙️ Configurações do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(diagnosticData.settings, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!diagnosticData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Pronto para Diagnóstico</h3>
            <p className="text-muted-foreground text-center mb-6">
              Clique no botão "Executar Diagnóstico" para analisar o sistema completo
            </p>
            <Button onClick={runDiagnostic} disabled={loading} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Iniciar Análise
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}