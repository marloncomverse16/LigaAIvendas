#!/bin/bash

# Substitui a implementação complexa da busca de templates por uma mais simples e robusta
cat > /tmp/meta-templates-fix.js << 'EOL'
  useEffect(() => {
    const connectionType = form.watch("whatsappConnectionType");
    
    // Se estiver usando a conexão Meta API
    if (connectionType === "meta") {
      // Desabilitar o aprendizado de IA para conexão Meta API
      form.setValue("aiLearningEnabled", false);
      
      // Forçar o uso de templates e desabilitar mensagem personalizada
      setUseTemplate(true);
      
      // Carregar templates da Meta API - ABORDAGEM SIMPLIFICADA
      setIsLoadingMetaTemplates(true);
      setMetaTemplates([]); // Limpar templates anteriores
      
      console.log("Tentando carregar templates da Meta API (método simplificado)");
      
      // Buscar os templates diretamente pela rota otimizada
      fetch("/api/meta-templates")
        .then(res => {
          console.log("Resposta da rota otimizada:", {
            status: res.status,
            ok: res.ok
          });
          
          if (!res.ok) {
            console.warn("Falha na rota otimizada, tentando rota alternativa");
            return fetch("/api/user/meta-templates");
          }
          
          return res;
        })
        .then(res => res.json())
        .then(data => {
          console.log("Templates recebidos:", data);
          
          if (Array.isArray(data)) {
            setMetaTemplates(data);
            if (data.length > 0) {
              toast({
                title: "Templates carregados",
                description: `${data.length} templates encontrados`,
                variant: "default",
              });
            } else {
              toast({
                title: "Nenhum template encontrado",
                description: "Verifique se os templates foram aprovados na plataforma Meta",
                variant: "destructive",
              });
            }
          } else {
            console.error("Resposta não é um array:", data);
            toast({
              title: "Erro ao carregar templates",
              description: "Formato de resposta inválido",
              variant: "destructive",
            });
          }
        })
        .catch(error => {
          console.error("Erro ao carregar templates Meta:", error);
          toast({
            title: "Erro ao carregar templates",
            description: error.message || "Falha ao buscar templates Meta API",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoadingMetaTemplates(false);
        });
        
    } else {
      // Limpeza quando a conexão não for Meta
      setMetaTemplates([]);
    }
  }, [form.watch("whatsappConnectionType"), toast, setUseTemplate]);
EOL

# Backup do arquivo original
cp client/src/pages/message-sending-page.tsx client/src/pages/message-sending-page.tsx.before-fix

# Procure a linha onde começar o useEffect de whatsappConnectionType
START_LINE=$(grep -n "useEffect.*whatsappConnectionType" client/src/pages/message-sending-page.tsx | cut -d: -f1)

# Conte quantas linhas o useEffect tem
END_MARKER='  }, \[form\.watch("whatsappConnectionType"), toast\]);'
END_LINE=$(grep -n "$END_MARKER" client/src/pages/message-sending-page.tsx | cut -d: -f1)

# Se não encontrou o END_MARKER, tente outras variações
if [ -z "$END_LINE" ]; then
  END_MARKER='  }, \[form.watch("whatsappConnectionType")'
  END_LINE=$(grep -n "$END_MARKER" client/src/pages/message-sending-page.tsx | cut -d: -f1)
fi

if [ -z "$START_LINE" ] || [ -z "$END_LINE" ]; then
  echo "Não foi possível encontrar as linhas de início e fim do useEffect para whatsappConnectionType"
  exit 1
fi

echo "Encontrado useEffect nas linhas $START_LINE até $END_LINE"

# Extrai a parte antes do useEffect
head -n $(($START_LINE - 1)) client/src/pages/message-sending-page.tsx > /tmp/part1.txt

# Extrai a parte depois do useEffect
tail -n +$(($END_LINE + 1)) client/src/pages/message-sending-page.tsx > /tmp/part3.txt

# Junta as partes com a nova implementação
cat /tmp/part1.txt /tmp/meta-templates-fix.js /tmp/part3.txt > client/src/pages/message-sending-page.tsx.new

# Substitui o arquivo original
mv client/src/pages/message-sending-page.tsx.new client/src/pages/message-sending-page.tsx

echo "Implementação simplificada aplicada com sucesso!"