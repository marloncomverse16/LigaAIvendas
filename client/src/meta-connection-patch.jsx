// Código original começando na linha 473
  useEffect(() => {
    const connectionType = form.watch("whatsappConnectionType");
    
    // Se estiver usando a conexão Meta API
    if (connectionType === "meta") {
      // Desabilitar o aprendizado de IA para conexão Meta API
      form.setValue("aiLearningEnabled", false);
      
      // Forçar o uso de templates e desabilitar mensagem personalizada
      form.setValue("useTemplate", true);
      
      // Carregar templates da Meta API
      setIsLoadingMetaTemplates(true);
      setMetaTemplates([]); // Limpar templates anteriores
      
      console.log("Tentando carregar templates da Meta API");
      
      // Adicionando feedback visual de diagnóstico
      toast({
        title: "Carregando templates Meta API",
        description: "Verificando conexão...",
        variant: "default",
      });
      
      // TUDO A PARTIR DAQUI SERÁ SUBSTITUÍDO POR UMA ABORDAGEM MAIS DIRETA

      // Verificar primeiro se o usuário está conectado com a Meta API
      fetch("/api/user/meta-connections/status")
        .then(...)
    }
  }, [form.watch("whatsappConnectionType"), toast]);


// NOSSO CÓDIGO SUBSTITUTO PARA A LINHA 498 EM DIANTE:

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
  }, [form.watch("whatsappConnectionType"), toast]);