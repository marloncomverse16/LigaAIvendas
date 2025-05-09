import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { SelectItem } from "@/components/ui/select";

// Componente separado para buscar e exibir templates Meta API
export function MetaTemplateSelector({ form, onTemplateSelect }) {
  const { toast } = useToast();
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Carregar templates ao montar o componente
  useEffect(() => {
    loadMetaTemplates();
  }, []);

  // Função para carregar templates da API Meta
  const loadMetaTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      // Tentar primeiro a rota direta otimizada
      console.log("Tentando carregar templates via rota direta");
      let response = await fetch("/api/meta-templates");
      
      // Se falhar, tentar rota alternativa
      if (!response.ok) {
        console.log("Rota direta falhou, tentando rota alternativa");
        response = await fetch("/api/user/meta-templates");
      }
      
      // Se ainda não funcionar, mostrar erro
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Templates recebidos:", data);
      
      if (Array.isArray(data)) {
        setMetaTemplates(data);
        if (data.length > 0) {
          toast({
            title: "Templates carregados",
            description: `${data.length} templates encontrados`,
            variant: "default",
          });
          
          // Selecionar primeiro template automaticamente
          if (form && onTemplateSelect && data[0]) {
            form.setValue("templateId", data[0].id);
            onTemplateSelect(data[0]);
          }
        } else {
          toast({
            title: "Nenhum template encontrado",
            description: "Verifique se há templates aprovados na sua conta Meta",
            variant: "destructive",
          });
        }
      } else {
        throw new Error("Formato de resposta inválido");
      }
    } catch (error) {
      console.error("Erro ao carregar templates:", error);
      toast({
        title: "Erro ao carregar templates",
        description: error.message || "Falha ao buscar templates Meta API",
        variant: "destructive",
      });
      setMetaTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Renderizar os itens de seleção para cada template
  return (
    <>
      {isLoadingTemplates ? (
        <SelectItem value="loading" disabled>Carregando templates...</SelectItem>
      ) : metaTemplates.length > 0 ? (
        metaTemplates.map((template) => (
          <SelectItem 
            key={template.id} 
            value={template.id.toString()}
          >
            {template.name}
          </SelectItem>
        ))
      ) : (
        <SelectItem value="none" disabled>Nenhum template encontrado</SelectItem>
      )}
    </>
  );
}