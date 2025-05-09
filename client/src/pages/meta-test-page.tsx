import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

// Schema para o formulário de envio
const sendMessageSchema = z.object({
  to: z.string().min(10, "Número de telefone deve ter pelo menos 10 dígitos"),
  templateName: z.string().min(1, "Nome do template é obrigatório"),
  language: z.string().default("pt_BR"),
  components: z.string().optional().default("[]")
});

type SendMessageFormValues = z.infer<typeof sendMessageSchema>;

export default function MetaTestPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Formulário
  const form = useForm<SendMessageFormValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      to: "",
      templateName: "",
      language: "pt_BR",
      components: "[]"
    }
  });

  // Carregar templates ao iniciar a página
  useEffect(() => {
    async function loadTemplates() {
      try {
        console.log("Carregando templates da Meta API (método direto simplificado)");
        const response = await axios.get("/api/meta-direct-templates");
        console.log("Resposta da API de templates:", response.data);
        
        if (response.data && response.data.templates && Array.isArray(response.data.templates)) {
          // Novo formato de resposta (mais detalhado)
          console.log("Templates recebidos:", response.data.templates);
          setTemplates(response.data.templates);
        } else if (Array.isArray(response.data)) {
          // Formato antigo de resposta (array simples)
          console.log("Templates recebidos (formato antigo):", response.data);
          setTemplates(response.data);
        } else {
          setError("Formato de resposta da API de templates inesperado");
          console.error("Formato de resposta inesperado:", response.data);
        }
      } catch (err: any) {
        setError(`Erro ao carregar templates: ${err.message}`);
        
        if (err.response) {
          console.error("Erro da API:", err.response.data);
          
          // Tentar extrair mensagem de erro mais detalhada
          const apiErrorMsg = err.response.data?.details?.message || 
                             err.response.data?.error || 
                             err.response.data?.message;
                             
          if (apiErrorMsg) {
            setError(`Erro ao carregar templates: ${apiErrorMsg}`);
          }
        } else {
          console.error("Erro ao carregar templates:", err);
        }
      } finally {
        setLoadingTemplates(false);
      }
    }

    loadTemplates();
  }, []);

  // Enviar mensagem
  async function onSubmit(data: SendMessageFormValues) {
    setLoading(true);
    setResponse(null);
    setError(null);
    setSuccess(false);

    try {
      // Converter string de componentes para JSON se não estiver vazia
      let components = [];
      if (data.components && data.components.trim() !== "" && data.components !== "[]") {
        try {
          components = JSON.parse(data.components);
        } catch (e) {
          setError("Formato inválido de componentes. Deve ser um JSON válido.");
          setLoading(false);
          return;
        }
      }

      const payload = {
        to: data.to,
        templateName: data.templateName,
        language: data.language,
        components: components.length > 0 ? components : undefined
      };

      console.log("Enviando payload:", payload);

      const result = await axios.post("/api/meta-direct-send", payload);
      
      console.log("Resposta do servidor:", result.data);
      
      setResponse(result.data);
      setSuccess(true);
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
      
      const errorMsg = err.response?.data?.details?.message || 
                       err.response?.data?.error || 
                       err.message || 
                       "Erro desconhecido";
      
      const suggestedFix = err.response?.data?.details?.suggestedFix;
      
      setError(`${errorMsg}${suggestedFix ? ` - ${suggestedFix}` : ''}`);
      
      // Guardar resposta de erro para debugging
      setResponse(err.response?.data || err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Teste de Envio - Meta API (WhatsApp)</h1>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enviar Mensagem de Template</CardTitle>
            <CardDescription>
              Envie mensagens usando templates aprovados da Meta API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="5511999998888" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="templateName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={loadingTemplates || templates.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingTemplates ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Carregando templates...</span>
                            </div>
                          ) : templates.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              Nenhum template disponível
                            </div>
                          ) : (
                            <SelectGroup>
                              {templates.map((template) => (
                                <SelectItem key={template.name} value={template.name}>
                                  {template.name} ({template.language.code})
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um idioma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                            <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                            <SelectItem value="es_ES">Espanhol</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="components"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Componentes (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"type":"body","parameters":[{"type":"text","text":"Exemplo"}]}]'
                          className="font-mono text-sm"
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Mensagem
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              Status e resposta do envio
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success && (
              <Alert className="mb-4 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-600">Sucesso!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Mensagem enviada com sucesso. ID: {response?.messageId}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="mb-4 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-600">Erro!</AlertTitle>
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {response && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Resposta Completa:</h3>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs max-h-[300px]">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}