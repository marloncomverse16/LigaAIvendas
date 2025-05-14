import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle, Copy, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

// Tipos para o diagnóstico Meta
interface MetaDiagnostic {
  timestamp: string;
  status: string;
  steps: DiagnosticStep[];
  configurations: ConfigurationInfo[];
  error?: string;
}

interface DiagnosticStep {
  step: number;
  name: string;
  status: string;
  message?: string;
  columns?: string[];
  availableColumns?: string[];
  testUrl?: string;
  error?: any;
  businessInfo?: {
    id: string;
    name: string;
  };
  totalTemplates?: number;
  approvedTemplates?: number;
  templates?: any[];
}

interface ConfigurationInfo {
  id: number;
  userId: number;
  tokenInfo: {
    length: number;
    prefix: string;
    isLikelyToken: boolean;
  } | string;
  businessIdInfo: {
    length: number;
    value: string;
    isLikelyBusinessId: boolean;
  } | string;
  apiVersionInfo: string;
}

export default function MetaDiagnosticPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<MetaDiagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixResult, setFixResult] = useState<any | null>(null);

  // Executar diagnóstico ao carregar a página
  useEffect(() => {
    runDiagnostic();
  }, []);

  // Função para executar o diagnóstico
  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/meta-diagnostic');
      setDiagnostic(response.data);
      
      if (response.data.status === 'completed') {
        toast({
          title: "Diagnóstico concluído",
          description: "O diagnóstico da integração Meta foi concluído com sucesso",
        });
      } else if (response.data.error) {
        setError(response.data.error);
        toast({
          title: "Erro no diagnóstico",
          description: response.data.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erro ao executar diagnóstico:", err);
      setError(err.message || "Erro desconhecido ao executar diagnóstico");
      toast({
        title: "Falha no diagnóstico",
        description: err.message || "Ocorreu um erro ao executar o diagnóstico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Função para corrigir os campos da configuração Meta
  const fixMetaConfigFields = async () => {
    setFixLoading(true);
    setFixResult(null);
    
    try {
      const response = await axios.post('/api/meta-fix-fields');
      setFixResult(response.data);
      
      if (response.data.success) {
        toast({
          title: "Correção aplicada",
          description: response.data.message,
        });
        
        // Após corrigir, recarregar diagnóstico
        setTimeout(() => {
          runDiagnostic();
        }, 1000);
      } else {
        toast({
          title: "Alerta na correção",
          description: response.data.message || "Alguns campos não puderam ser corrigidos automaticamente",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erro ao corrigir campos:", err);
      toast({
        title: "Falha na correção",
        description: err.message || "Ocorreu um erro ao tentar corrigir os campos",
        variant: "destructive",
      });
    } finally {
      setFixLoading(false);
    }
  };

  // Função para copiar valor para área de transferência
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copiado!",
          description: "Texto copiado para a área de transferência",
        });
      },
      (err) => {
        console.error("Erro ao copiar:", err);
      }
    );
  };

  // Renderizar ícone de status
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'skipped':
        return <ArrowRight className="h-5 w-5 text-gray-400" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Diagnóstico da Meta API</h1>
        <Button 
          onClick={runDiagnostic} 
          disabled={loading}
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Executar novamente
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <p className="font-medium">Erro no diagnóstico</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading && !diagnostic && (
        <div className="text-center p-12">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Executando diagnóstico completo, por favor aguarde...</p>
        </div>
      )}

      {diagnostic && (
        <div className="space-y-6">
          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <StatusIcon status={diagnostic.status === 'completed' ? 'success' : 'error'} />
                <span className="ml-2">
                  Status do Diagnóstico: {diagnostic.status === 'completed' ? 'Concluído' : 'Falhou'}
                </span>
              </CardTitle>
              <CardDescription>
                Iniciado em: {new Date(diagnostic.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-2">Resumo das Configurações</h3>
                  <p>Total de configurações encontradas: {diagnostic.configurations.length}</p>
                  {diagnostic.configurations.length > 0 && (
                    <div className="mt-2">
                      <Badge variant="outline" className="mr-2">
                        {diagnostic.configurations.filter(c => 
                          typeof c.tokenInfo !== 'string' && c.tokenInfo.isLikelyToken
                        ).length} tokens válidos
                      </Badge>
                      <Badge variant="outline" className="mr-2">
                        {diagnostic.configurations.filter(c => 
                          typeof c.businessIdInfo !== 'string' && c.businessIdInfo.isLikelyBusinessId
                        ).length} IDs de negócio válidos
                      </Badge>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium mb-2">Resumo dos Passos</h3>
                  <div className="space-y-1">
                    {diagnostic.steps.map(step => (
                      <div key={step.step} className="flex items-center">
                        <StatusIcon status={step.status} />
                        <span className="ml-2 text-sm">
                          Passo {step.step}: {step.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes dos passos */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Execução</CardTitle>
              <CardDescription>
                Resultados detalhados de cada passo do diagnóstico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {diagnostic.steps.map((step) => (
                  <AccordionItem value={`step-${step.step}`} key={step.step}>
                    <AccordionTrigger className="flex">
                      <div className="flex items-center">
                        <StatusIcon status={step.status} />
                        <span className="ml-2">
                          Passo {step.step}: {step.name}
                        </span>
                        <Badge 
                          variant={
                            step.status === 'success' ? 'default' : 
                            step.status === 'error' ? 'destructive' : 
                            step.status === 'warning' ? 'outline' : 
                            'secondary'
                          }
                          className="ml-2"
                        >
                          {step.status}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {step.message && (
                        <div className="mb-3 p-3 bg-muted rounded-md">
                          <p className="font-medium">Mensagem:</p>
                          <p>{step.message}</p>
                        </div>
                      )}

                      {step.columns && (
                        <div className="mb-3">
                          <p className="font-medium">Colunas Verificadas:</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {step.columns.map(col => (
                              <Badge key={col} variant="outline">{col}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.testUrl && (
                        <div className="mb-3 flex items-center">
                          <p className="font-medium mr-2">URL Testada:</p>
                          <code className="bg-muted p-1 rounded text-xs mr-2">{step.testUrl}</code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(step.testUrl as string)}
                            className="h-7 w-7"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {step.businessInfo && (
                        <div className="mb-3">
                          <p className="font-medium">Informações do Negócio:</p>
                          <p>ID: {step.businessInfo.id}</p>
                          <p>Nome: {step.businessInfo.name}</p>
                        </div>
                      )}

                      {(step.totalTemplates !== undefined) && (
                        <div className="mb-3">
                          <p className="font-medium">Templates Encontrados:</p>
                          <p>Total: {step.totalTemplates}</p>
                          <p>Aprovados: {step.approvedTemplates}</p>
                          
                          {step.templates && step.templates.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-sm mt-2">Exemplos:</p>
                              <ul className="list-disc list-inside">
                                {step.templates.map((t, i) => (
                                  <li key={i} className="text-sm">
                                    {t.name} ({t.status})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {step.error && (
                        <div className="mt-2 p-3 bg-red-50 text-red-800 rounded-md">
                          <p className="font-medium">Erro:</p>
                          <pre className="text-xs overflow-auto mt-1 p-2 bg-red-100 rounded">
                            {typeof step.error === 'object' 
                              ? JSON.stringify(step.error, null, 2) 
                              : step.error}
                          </pre>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Configurações detectadas */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Configurações Encontradas</CardTitle>
                  <CardDescription>
                    Detalhes das configurações detectadas no sistema
                  </CardDescription>
                </div>
                <Button
                  onClick={fixMetaConfigFields}
                  disabled={fixLoading || !diagnostic || diagnostic.configurations.length === 0}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  {fixLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Corrigindo...
                    </>
                  ) : (
                    <>
                      <Wrench className="h-4 w-4" />
                      Corrigir Campos
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            
            {fixResult && (
              <div className="px-6 pb-2">
                <Alert variant={fixResult.success ? "default" : "destructive"}>
                  <div className="flex items-center">
                    {fixResult.success ? 
                      <CheckCircle className="h-4 w-4 mr-2" /> : 
                      <AlertCircle className="h-4 w-4 mr-2" />
                    }
                    <AlertTitle>{fixResult.success ? "Correção Aplicada" : "Erro na Correção"}</AlertTitle>
                  </div>
                  <AlertDescription className="mt-2">
                    {fixResult.message}
                    
                    {fixResult.problemsFound && fixResult.problemsFound.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Problemas encontrados:</p>
                        <ul className="list-disc list-inside text-sm">
                          {fixResult.problemsFound.slice(0, 3).map((problem: string, i: number) => (
                            <li key={i}>{problem}</li>
                          ))}
                          {fixResult.problemsFound.length > 3 && (
                            <li>...e mais {fixResult.problemsFound.length - 3} problemas</li>
                          )}
                        </ul>
                      </div>
                    )}
                    
                    {fixResult.correctionsApplied && fixResult.correctionsApplied.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Correções aplicadas:</p>
                        <ul className="list-disc list-inside text-sm">
                          {fixResult.correctionsApplied.slice(0, 3).map((correction: string, i: number) => (
                            <li key={i}>{correction}</li>
                          ))}
                          {fixResult.correctionsApplied.length > 3 && (
                            <li>...e mais {fixResult.correctionsApplied.length - 3} correções</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <CardContent>
              {diagnostic.configurations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma configuração encontrada
                </div>
              ) : (
                <div className="space-y-4">
                  {diagnostic.configurations.map((config, index) => (
                    <div 
                      key={index} 
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium">
                            Configuração {index + 1} (ID: {config.id})
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Usuário ID: {config.userId}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          {typeof config.tokenInfo !== 'string' && config.tokenInfo.isLikelyToken && (
                            <Badge variant="default">
                              <Check className="h-3 w-3 mr-1" />
                              Token Válido
                            </Badge>
                          )}
                          {typeof config.businessIdInfo !== 'string' && config.businessIdInfo.isLikelyBusinessId && (
                            <Badge variant="default">
                              <Check className="h-3 w-3 mr-1" />
                              Business ID Válido
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Token de Acesso:</p>
                          {typeof config.tokenInfo === 'string' ? (
                            <Badge variant="outline" className="bg-red-50">{config.tokenInfo}</Badge>
                          ) : (
                            <div>
                              <p className="text-xs">
                                Prefixo: <code className="bg-muted p-1 rounded">{config.tokenInfo.prefix}</code>
                              </p>
                              <p className="text-xs">
                                Tamanho: {config.tokenInfo.length} caracteres
                              </p>
                              <Badge 
                                variant={config.tokenInfo.isLikelyToken ? "default" : "destructive"}
                                className="mt-1"
                              >
                                {config.tokenInfo.isLikelyToken ? "Formato Válido" : "Formato Inválido"}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">ID do Negócio:</p>
                          {typeof config.businessIdInfo === 'string' ? (
                            <Badge variant="outline" className="bg-red-50">{config.businessIdInfo}</Badge>
                          ) : (
                            <div>
                              <p className="text-xs">
                                Valor: <code className="bg-muted p-1 rounded">{config.businessIdInfo.value}</code>
                              </p>
                              <p className="text-xs">
                                Tamanho: {config.businessIdInfo.length} caracteres
                              </p>
                              <Badge 
                                variant={config.businessIdInfo.isLikelyBusinessId ? "default" : "destructive"}
                                className="mt-1"
                              >
                                {config.businessIdInfo.isLikelyBusinessId ? "Formato Válido" : "Formato Inválido"}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">Versão da API:</p>
                          <p className="text-xs">
                            <code className="bg-muted p-1 rounded">{config.apiVersionInfo}</code>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados brutos */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Brutos</CardTitle>
              <CardDescription>
                JSON completo do diagnóstico para análise detalhada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(JSON.stringify(diagnostic, null, 2))}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar JSON
                </Button>
                <pre className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md text-xs overflow-auto max-h-[500px]">
                  {JSON.stringify(diagnostic, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}