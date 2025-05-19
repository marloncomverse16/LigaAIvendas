import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function ChatDiagnosticsPage() {
  const [isLoadingNew, setIsLoadingNew] = useState(false);
  const [contactsV2Result, setContactsV2Result] = useState<any>(null);

  // Consulta principal para diagnósticos
  const { 
    data: diagnosticData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ["/api/diagnostics/contacts"],
    retry: false,
  });

  // Função para testar a nova implementação de contatos
  const testContactsV2 = async () => {
    setIsLoadingNew(true);
    try {
      // Usar a versão corrigida com as URLs ajustadas
      const response = await fetch("/api/chat/contacts-fix");
      const data = await response.json();
      setContactsV2Result(data);
    } catch (err) {
      setContactsV2Result({
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido"
      });
    } finally {
      setIsLoadingNew(false);
    }
  };

  // Formatação para exibição JSON
  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Diagnóstico de Contatos WhatsApp</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Executar diagnóstico
                </>
              )}
            </Button>
            <Button 
              variant="default" 
              onClick={testContactsV2}
              disabled={isLoadingNew}
            >
              {isLoadingNew ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Testar Nova API de Contatos
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Exibição de erro */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              Ocorreu um erro ao executar o diagnóstico: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Teste da nova implementação */}
        {contactsV2Result && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                {contactsV2Result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                )}
                Resultado do Teste Nova API (v2)
              </CardTitle>
              <CardDescription>
                {contactsV2Result.success 
                  ? `Sucesso! Método: ${contactsV2Result.method || 'Direto'} - Total: ${contactsV2Result.total || '-'} contatos`
                  : `Falha: ${contactsV2Result.message || 'Erro ao obter contatos'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="v2-details">
                  <AccordionTrigger>Ver detalhes</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-auto text-xs">
                      {formatJson(contactsV2Result)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Resultados do diagnóstico */}
        {diagnosticData && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Informações do servidor */}
            <Card className="md:col-span-4">
              <CardHeader>
                <CardTitle>Informações do Servidor</CardTitle>
                <CardDescription>Configuração da Evolution API</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">URL da API:</span>{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm">
                      {diagnosticData.diagnostics.server.apiUrl}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">ID da Instância:</span>{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm">
                      {diagnosticData.diagnostics.server.instanceId}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Tamanho do Token:</span>{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm">
                      {diagnosticData.diagnostics.server.tokenLength} caracteres
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status da conexão */}
            <Card className="md:col-span-8">
              <CardHeader>
                <CardTitle>Status da Conexão</CardTitle>
                <CardDescription>Testes de conectividade básica</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="mr-4">
                      {diagnosticData.diagnostics.connection.baseConnection ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">Conexão Básica</h3>
                      <p className="text-sm text-slate-500">
                        {diagnosticData.diagnostics.connection.baseConnection
                          ? `Conectado com sucesso (status ${diagnosticData.diagnostics.connection.baseConnectionDetails?.status})`
                          : "Falha na conexão básica com o servidor"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="mr-4">
                      {diagnosticData.diagnostics.connection.authTest ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">Autenticação</h3>
                      <p className="text-sm text-slate-500">
                        {diagnosticData.diagnostics.connection.authTest
                          ? "Autenticação bem-sucedida com token"
                          : `Falha na autenticação (status ${diagnosticData.diagnostics.connection.authTestDetails?.status || 'desconhecido'})`}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testes de endpoints */}
            <Card className="md:col-span-12">
              <CardHeader>
                <CardTitle>Teste de Endpoints</CardTitle>
                <CardDescription>Verificação de múltiplos endpoints da API</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(diagnosticData.diagnostics.endpoints).map(([key, value]: [string, any]) => (
                    <div 
                      key={key}
                      className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900"
                    >
                      <div className="flex items-center mb-2">
                        {value.isSuccess ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mr-2" />
                        )}
                        <h3 className="font-medium">{key}</h3>
                      </div>
                      <p className="text-sm text-slate-500 mb-2">
                        Status: {value.status || 'N/A'} {value.statusText || ''}
                      </p>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={`data-${key}`}>
                          <AccordionTrigger className="text-xs py-1">Ver detalhes</AccordionTrigger>
                          <AccordionContent>
                            <pre className="bg-slate-100 dark:bg-slate-900 p-2 rounded-md overflow-auto text-xs max-h-40">
                              {formatJson(value)}
                            </pre>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  );
}