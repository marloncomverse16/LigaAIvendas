#!/bin/bash

# Arquivo temporário para o código substituído
cat > /tmp/meta-templates-fix.js << 'EOL'
  // Monitorar mudanças no tipo de conexão WhatsApp
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
      
      console.log("Tentando carregar templates da Meta API (método direto)");
      
      // Buscar os templates diretamente pelo endpoint otimizado
      fetch("/api/meta-templates")
        .then((res) => {
          console.log("Resposta da API de templates:", {
            status: res.status,
            ok: res.ok,
          });
          
          if (!res.ok) {
            throw new Error(`Erro ao buscar templates: ${res.status}`);
          }
          
          return res.json();
        })
        .then((data) => {
          console.log("Templates recebidos:", data);
          
          if (Array.isArray(data)) {
            // Mapear os templates para um formato consistente
            const formattedTemplates = data.map((template) => ({
              id: template.id,
              name: template.name,
              status: template.status,
              category: template.category,
              language: template.language
            }));
            
            setMetaTemplates(formattedTemplates);
            
            if (formattedTemplates.length > 0) {
              // Selecionar o primeiro template automaticamente
              form.setValue("templateId", formattedTemplates[0].id);
              
              toast({
                title: "Templates carregados",
                description: `${formattedTemplates.length} templates encontrados`,
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
        .catch((error) => {
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
      // Se mudar para modo QR Code, limpar os templates Meta e recarregar os templates normais
      setMetaTemplates([]);
      
      // Recarregar templates normais se for modo QR Code
      if (connectionType === "qrcode") {
        loadTemplates();
      }
    }
  }, [form.watch("whatsappConnectionType"), toast, setUseTemplate]);
EOL

# Backup do arquivo original
cp client/src/pages/message-sending-page.tsx client/src/pages/message-sending-page.tsx.backup-$(date +%s)

# Use grep para encontrar o início do useEffect que queremos substituir
LINE_NUMBER=$(grep -n "useEffect.*whatsappConnectionType" client/src/pages/message-sending-page.tsx | head -1 | cut -d: -f1)

if [ -z "$LINE_NUMBER" ]; then
  echo "Não foi possível encontrar o useEffect para substituição"
  exit 1
fi

echo "Encontrado useEffect na linha $LINE_NUMBER"

# Calcular o final do useEffect
END_LINE=$(tail -n +$LINE_NUMBER client/src/pages/message-sending-page.tsx | grep -n "}, \[form\.watch(\"whatsappConnectionType\")" | head -1 | cut -d: -f1)
END_LINE=$((LINE_NUMBER + END_LINE - 1))

if [ -z "$END_LINE" ]; then
  echo "Não foi possível encontrar o fim do useEffect"
  exit 1
fi

echo "Fim do useEffect na linha $END_LINE"

# Extrair as partes antes e depois do useEffect
head -n $((LINE_NUMBER - 1)) client/src/pages/message-sending-page.tsx > /tmp/before.tsx
tail -n +$((END_LINE + 1)) client/src/pages/message-sending-page.tsx > /tmp/after.tsx

# Juntar tudo com o novo código
cat /tmp/before.tsx /tmp/meta-templates-fix.js /tmp/after.tsx > client/src/pages/message-sending-page.tsx.new

# Verificar se o arquivo resultante não está vazio
if [ ! -s client/src/pages/message-sending-page.tsx.new ]; then
  echo "Erro: o arquivo resultante está vazio"
  exit 1
fi

# Substituir o arquivo original
mv client/src/pages/message-sending-page.tsx.new client/src/pages/message-sending-page.tsx

echo "Substituição concluída com sucesso"