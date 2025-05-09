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
      
      console.log("Tentando carregar templates da Meta API (método simplificado)");
      
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