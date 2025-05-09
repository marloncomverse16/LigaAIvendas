import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";

// Interface para tipar os templates Meta
interface MetaTemplate {
  id: string;
  name: string;
  category?: string;
  language?: string;
  status?: string;
  components?: any[];
}

interface MetaAPIError {
  details?: {
    suggestedFix?: string;
    valuesLikelySwapped?: boolean;
    message?: string;
    code?: string | number;
  }
}

// Componente separado para buscar e exibir templates Meta API
export function MetaTemplateSelector({ 
  form, 
  onTemplateSelect 
}: { 
  form: any; 
  onTemplateSelect: (template: MetaTemplate) => void 
}) {
  const { toast } = useToast();
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Carregar templates ao montar o componente
  useEffect(() => {
    loadMetaTemplates();
  }, []);

  // Função para carregar templates da API Meta
  const loadMetaTemplates = async () => {
    setIsLoadingTemplates(true);
    setErrorDetails(null);
    
    try {
      console.log("Carregando templates da Meta API (método direto simplificado)");
      
      // Usar o endpoint direto que não depende de autenticação do usuário
      const response = await fetch("/api/meta-direct-templates");
      console.log("Resposta da API de templates:", {
        status: response.status,
        ok: response.ok
      });
      
      // Se não for bem-sucedido, tratar o erro
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao carregar templates Meta:", errorData);
        
        // Verificar se há sugestões específicas de como resolver o problema
        if (errorData.details?.suggestedFix) {
          setErrorDetails(errorData.details.suggestedFix);
          throw new Error(`${errorData.error}: ${errorData.details.suggestedFix}`);
        }
        
        // Verificar se é possível que os valores estejam invertidos
        if (errorData.details?.valuesLikelySwapped) {
          setErrorDetails("Os valores de Token e ID do Negócio parecem estar invertidos nas configurações.");
          throw new Error("Configuração incorreta: Token e ID do Negócio podem estar invertidos");
        }
        
        throw new Error(errorData.error || `Erro ${response.status}`);
      }
      
      const templates = await response.json();
      
      // Validar se a resposta é um array
      if (!Array.isArray(templates)) {
        throw new Error("Formato de resposta inválido: não é um array");
      }
      
      // Guardar templates e notificar usuário
      setMetaTemplates(templates);
      
      if (templates.length > 0) {
        toast({
          title: "Templates carregados",
          description: `${templates.length} templates encontrados`,
          variant: "default",
        });
        
        // Selecionar primeiro template automaticamente
        if (form && onTemplateSelect && templates[0]) {
          form.setValue("templateId", templates[0].id);
          onTemplateSelect(templates[0]);
        }
      } else {
        toast({
          title: "Nenhum template encontrado",
          description: "Verifique se há templates aprovados na sua conta do WhatsApp Business",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar templates:", error);
      
      // Mostrar toast de erro para o usuário
      toast({
        title: "Erro ao carregar templates",
        description: error.message || "Falha ao buscar templates da Meta API",
        variant: "destructive",
      });
      
      // Limpar templates
      setMetaTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Renderizar os itens de seleção para cada template
  return (
    <>
      {isLoadingTemplates ? (
        <SelectItem value="loading" disabled>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin inline-block" />
          Carregando templates...
        </SelectItem>
      ) : errorDetails ? (
        <>
          <SelectItem value="error" disabled>
            <AlertCircle className="h-4 w-4 mr-2 text-destructive inline-block" />
            Erro de configuração
          </SelectItem>
          <div className="p-3 text-sm text-destructive border border-destructive/20 rounded-md mt-2 bg-destructive/5">
            <p className="font-medium">Problema encontrado:</p>
            <p>{errorDetails}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => loadMetaTemplates()}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
            </Button>
          </div>
        </>
      ) : metaTemplates.length > 0 ? (
        metaTemplates.map((template) => (
          <SelectItem 
            key={template.id} 
            value={template.id}
          >
            {template.name}
            {template.category && (
              <Badge variant="outline" className="ml-2 text-xs">
                {template.category}
              </Badge>
            )}
          </SelectItem>
        ))
      ) : (
        <SelectItem value="none" disabled>
          Nenhum template encontrado
        </SelectItem>
      )}
    </>
  );
}