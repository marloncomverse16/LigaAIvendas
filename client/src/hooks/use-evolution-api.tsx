/**
 * Hook para usar o serviço da Evolution API
 * Permite configurar e acessar os dados da API diretamente dos componentes
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import evolutionApiService from "@/services/evolution-api";
import { useToast } from "@/hooks/use-toast";

export function useEvolutionApi() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("unknown");
  
  // Buscar configurações do servidor do usuário
  const { data: serverConfig } = useQuery({
    queryKey: ['/api/user/server-config'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user/server-config');
        if (!response.ok) throw new Error('Falha ao buscar configurações do servidor');
        const data = await response.json();
        
        // Configurar o serviço da Evolution API
        if (data && data.apiUrl && data.apiToken && data.instanceId) {
          evolutionApiService.configure(
            data.apiUrl,
            data.apiToken,
            data.instanceId
          );
          return data;
        }
        
        // Valores padrão para desenvolvimento
        const defaultConfig = {
          apiUrl: "https://api.primerastreadores.com",
          apiToken: "4db623449606bcf2814521b73657dbc0", // Token fixo para desenvolvimento
          instanceId: "admin"
        };
        
        evolutionApiService.configure(
          defaultConfig.apiUrl,
          defaultConfig.apiToken,
          defaultConfig.instanceId
        );
        
        return defaultConfig;
      } catch (error: any) {
        console.error("Erro ao carregar configurações:", error);
        toast({
          title: "Erro de configuração",
          description: error.message || "Falha ao carregar configurações do servidor",
          variant: "destructive"
        });
        
        // Usar configurações padrão em caso de erro
        const defaultConfig = {
          apiUrl: "https://api.primerastreadores.com",
          apiToken: "4db623449606bcf2814521b73657dbc0",
          instanceId: "admin"
        };
        
        evolutionApiService.configure(
          defaultConfig.apiUrl,
          defaultConfig.apiToken,
          defaultConfig.instanceId
        );
        
        return defaultConfig;
      }
    }
  });
  
  // Verificar status da conexão
  const {
    data: connectionStatus,
    isLoading: isCheckingConnection,
    refetch: checkConnection
  } = useQuery({
    queryKey: ['/evolution-api/connection'],
    queryFn: async () => {
      try {
        const status = await evolutionApiService.checkConnectionState();
        setConnected(status.connected);
        setConnectionState(status.state);
        return status;
      } catch (error: any) {
        setConnected(false);
        setConnectionState("error");
        console.error("Erro ao verificar conexão:", error);
        return {
          connected: false,
          state: "error",
          error: error.message
        };
      }
    },
    refetchInterval: 15000, // Verificar a cada 15 segundos
  });
  
  // Carregar contatos
  const {
    data: contacts,
    isLoading: isLoadingContacts,
    refetch: refreshContacts
  } = useQuery({
    queryKey: ['/evolution-api/contacts'],
    queryFn: async () => {
      try {
        const contactsList = await evolutionApiService.loadChats();
        return contactsList;
      } catch (error: any) {
        console.error("Erro ao carregar contatos:", error);
        toast({
          title: "Erro ao carregar contatos",
          description: error.message || "Não foi possível carregar a lista de contatos",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: connected,
  });
  
  // Carregar mensagens de um chat
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      return await evolutionApiService.loadMessages(chatId);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Não foi possível carregar as mensagens deste chat",
        variant: "destructive"
      });
      return [];
    }
  }, [toast]);
  
  // Enviar mensagem
  const sendMessage = useMutation({
    mutationFn: async ({ to, message }: { to: string, message: string }) => {
      return await evolutionApiService.sendMessage(to, message);
    },
    onSuccess: () => {
      // Invalidar queries relacionadas para recarregar dados
      queryClient.invalidateQueries({ queryKey: ['/evolution-api/contacts'] });
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  });
  
  return {
    // Estado e configuração
    connected,
    connectionState,
    serverConfig,
    isCheckingConnection,
    
    // Dados
    contacts,
    isLoadingContacts,
    
    // Ações
    checkConnection,
    refreshContacts,
    loadMessages,
    sendMessage
  };
}