import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TestMetaApiPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [result, setResult] = useState<any>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Carregar templates ao carregar a página
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setTemplateLoading(true);
      setTemplatesError(null);
      
      const response = await apiRequest("GET", "/api/user/meta-templates");
      const data = await response.json();
      
      if (data.success && data.templates) {
        // Filtrar apenas templates aprovados
        const approvedTemplates = data.templates.filter((t: any) => t.status === "APPROVED");
        setTemplates(approvedTemplates);
      } else {
        setTemplatesError(data.message || "Erro ao carregar templates");
      }
    } catch (error) {
      console.error("Erro ao carregar templates:", error);
      setTemplatesError("Erro ao conectar com servidor");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Selecione um template",
        description: "Você precisa selecionar um template para enviar",
        variant: "destructive"
      });
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Número inválido",
        description: "Digite um número de telefone válido no formato internacional sem símbolos (ex: 5511999998888)",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      
      const response = await apiRequest("POST", "/api/meta-send-test", {
        to: phoneNumber,
        templateName: selectedTemplate
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Mensagem enviada",
          description: `Mensagem enviada com sucesso! ID: ${data.messageId}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Erro ao enviar mensagem",
          description: data.message || "Ocorreu um erro ao enviar a mensagem",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem de teste:", error);
      toast({
        title: "Erro na requisição",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Teste da API da Meta</CardTitle>
            <CardDescription>Você precisa estar logado para acessar esta página</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Teste da API da Meta</CardTitle>
          <CardDescription>
            Esta ferramenta permite testar o envio de mensagens usando a API da Meta (WhatsApp Cloud API)
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {templatesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro ao carregar templates</AlertTitle>
              <AlertDescription>{templatesError}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="template">Template de mensagem</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template">
                <SelectValue placeholder={templateLoading ? "Carregando templates..." : "Selecione um template"} />
              </SelectTrigger>
              <SelectContent>
                {templates.length > 0 ? (
                  templates.map((t: any) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    {templateLoading ? "Carregando..." : "Nenhum template disponível"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {templates.length > 0 
                ? `${templates.length} templates disponíveis` 
                : "Você precisa ter templates aprovados na sua conta Meta"}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Número de telefone</Label>
            <Input
              id="phone"
              placeholder="Digite o número (ex: 5511999998888)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Digite o número no formato internacional, sem símbolos (ex: 5511999998888)
            </p>
          </div>
          
          <Button 
            onClick={handleSendTest} 
            disabled={loading || templateLoading || !selectedTemplate || !phoneNumber}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Enviando..." : "Enviar mensagem de teste"}
          </Button>
          
          {result && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Resultado do envio</h3>
                
                <Alert variant={result.success ? "default" : "destructive"}>
                  {result.success 
                    ? <CheckCircle className="h-4 w-4" /> 
                    : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>
                    {result.success ? "Mensagem enviada com sucesso" : "Erro ao enviar mensagem"}
                  </AlertTitle>
                  <AlertDescription>
                    {result.message}
                  </AlertDescription>
                </Alert>
                
                {result.steps && (
                  <div className="space-y-3 mt-4">
                    <h4 className="font-medium">Detalhes da operação:</h4>
                    {result.steps.map((step: any, index: number) => (
                      <div key={index} className="rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          {step.status === "erro" && <AlertCircle className="h-4 w-4 text-destructive" />}
                          {step.status === "sucesso" && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {step.status === "info" && <Info className="h-4 w-4 text-blue-500" />}
                          {step.status === "aviso" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                          <span className="font-medium">Passo {step.step}: {step.name}</span>
                        </div>
                        {step.message && (
                          <p className="mt-1 text-sm">{step.message}</p>
                        )}
                        {step.details && (
                          <pre className="mt-2 text-xs bg-muted p-2 rounded-md overflow-auto">
                            {JSON.stringify(step.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Esta ferramenta envia mensagens reais usando a API da Meta. Use com responsabilidade.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}