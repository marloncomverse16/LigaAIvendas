import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const ChatDiagnosticsPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      
      const response = await apiRequest('GET', '/api/diagnostics/contacts');
      const data = await response.json();
      
      console.log("Resultados do diagnóstico:", data);
      setDiagnosticResults(data);
      
      toast({
        title: "Diagnóstico completo",
        description: "A análise da Evolution API foi concluída."
      });
    } catch (error) {
      console.error('Erro ao executar diagnóstico:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao executar diagnóstico. Tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Diagnóstico da API de Contatos</h1>
      
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Executar Diagnóstico</CardTitle>
            <CardDescription>
              Esta ferramenta verificará todos os endpoints relevantes da Evolution API 
              para determinar onde está o problema com a obtenção de contatos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runDiagnostics} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Executando diagnóstico..." : "Executar Diagnóstico Completo"}
            </Button>

            {diagnosticResults?.success === false && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro no diagnóstico</AlertTitle>
                <AlertDescription>
                  {diagnosticResults.message || "Ocorreu um erro ao executar o diagnóstico."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {diagnosticResults?.success && diagnosticResults?.diagnostics && (
        <Tabs defaultValue="summary" className="mb-6">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="connection">Conexão</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Diagnóstico</CardTitle>
                <CardDescription>Visão geral dos resultados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Informações do Servidor</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                        <Label>URL da API</Label>
                        <p className="font-mono text-sm">{diagnosticResults.diagnostics.server.apiUrl}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                        <Label>ID da Instância</Label>
                        <p className="font-mono text-sm">{diagnosticResults.diagnostics.server.instanceId}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Status da Conexão</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center space-x-2">
                        <Badge variant={diagnosticResults.diagnostics.connection.baseConnection ? "success" : "destructive"}>
                          {diagnosticResults.diagnostics.connection.baseConnection ? "Conectado" : "Falha"}
                        </Badge>
                        <span>Conexão básica com a API</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={diagnosticResults.diagnostics.connection.authTest ? "success" : "destructive"}>
                          {diagnosticResults.diagnostics.connection.authTest ? "Sucesso" : "Falha"}
                        </Badge>
                        <span>Autenticação com token</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Endpoints de Contato</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(diagnosticResults.diagnostics.endpoints)
                        .filter(([key]) => key.includes('contact'))
                        .map(([key, value]: [string, any]) => (
                          <div key={key} className="flex items-center space-x-2">
                            {value.isSuccess ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span>{key}</span>
                            <Badge variant={value.isSuccess ? "success" : "destructive"}>
                              {value.status || 'N/A'}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Recomendações</h3>
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                      <div className="flex space-x-2">
                        <InfoIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          {Object.values(diagnosticResults.diagnostics.endpoints).some((endpoint: any) => endpoint.isSuccess) ? (
                            <p>
                              Alguns endpoints estão funcionando. Tente usar o endpoint que está 
                              respondendo corretamente.
                            </p>
                          ) : (
                            <p>
                              Nenhum dos endpoints de contato está funcionando. Verifique o token de API,
                              a URL do servidor e o ID da instância. Considere usar contatos simulados
                              temporariamente.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="connection">
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Conexão</CardTitle>
                <CardDescription>Informações sobre a conexão com a API</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Teste de Conexão Básica</h3>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                      <div className="flex items-center mb-2">
                        <Badge variant={diagnosticResults.diagnostics.connection.baseConnection ? "success" : "destructive"}>
                          {diagnosticResults.diagnostics.connection.baseConnection ? "Sucesso" : "Falha"}
                        </Badge>
                        <span className="ml-2">Status: {diagnosticResults.diagnostics.connection.baseConnectionDetails?.status || 'N/A'}</span>
                      </div>
                      <Label>Detalhes da Resposta:</Label>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-xs overflow-auto max-h-[200px]">
                        {JSON.stringify(diagnosticResults.diagnostics.connection.baseConnectionDetails, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Teste de Autenticação</h3>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                      <div className="flex items-center mb-2">
                        <Badge variant={diagnosticResults.diagnostics.connection.authTest ? "success" : "destructive"}>
                          {diagnosticResults.diagnostics.connection.authTest ? "Sucesso" : "Falha"}
                        </Badge>
                        <span className="ml-2">Status: {diagnosticResults.diagnostics.connection.authTestDetails?.status || 'N/A'}</span>
                      </div>
                      <Label>Detalhes da Resposta:</Label>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-xs overflow-auto max-h-[200px]">
                        {JSON.stringify(diagnosticResults.diagnostics.connection.authTestDetails, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="endpoints">
            <Card>
              <CardHeader>
                <CardTitle>Endpoints Testados</CardTitle>
                <CardDescription>Status de cada endpoint testado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(diagnosticResults.diagnostics.endpoints).map(([key, value]: [string, any]) => (
                    <div key={key} className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        {value.isSuccess ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <h3 className="text-lg font-semibold">{key}</h3>
                        <Badge variant={value.isSuccess ? "success" : "destructive"}>
                          {value.status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                        <Label>Tipo de dados: {value.dataType || 'N/A'}</Label>
                        {value.error ? (
                          <div className="mt-2">
                            <Badge variant="destructive">Erro</Badge>
                            <p className="text-sm mt-1">{value.error}</p>
                          </div>
                        ) : (
                          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-xs overflow-auto max-h-[150px]">
                            {JSON.stringify(value.dataPreview, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Dados Completos</CardTitle>
                <CardDescription>Visualização completa dos dados do diagnóstico</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md text-xs overflow-auto max-h-[500px]">
                  {JSON.stringify(diagnosticResults.diagnostics, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md mb-4">
        <div className="flex items-start">
          <InfoIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-1" />
          <div className="ml-2">
            <h3 className="font-semibold">Sobre esta ferramenta</h3>
            <p className="text-sm mt-1">
              Esta página de diagnóstico foi criada para identificar especificamente onde está 
              o problema com a obtenção de contatos do WhatsApp via Evolution API. O diagnóstico testa 
              múltiplos endpoints e configurações para determinar o que está funcionando e 
              o que não está. Com base nesses resultados, podemos implementar uma solução 
              apropriada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatDiagnosticsPage;