import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export type WebSocketMessage = {
  type: string;
  data: any;
};

export type ConnectionType = "none" | "connecting" | "connected" | "disconnected" | "error";

// Função para obter a URL do WebSocket
function getWebSocketUrl() {
  // Determina o protocolo com base no protocolo atual (seguro ou não)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Constrói a URL completa
  return `${protocol}//${window.location.host}/api/ws`;
}

const useWebSocket = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionType>("none");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Função para conectar ao WebSocket
  const connect = useCallback(() => {
    if (!user) return;

    try {
      // Fecha conexão existente se houver
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.close();
      }

      setConnectionStatus("connecting");
      
      // Inicia nova conexão
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      socket.current = ws;

      ws.onopen = () => {
        console.log("WebSocket conectado");
        setConnectionStatus("connected");
        
        // Envia mensagem de autenticação
        ws.send(JSON.stringify({ 
          type: "auth", 
          data: { userId: user.id }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
          
          // Processa mensagens específicas
          if (message.type === "qr_code") {
            // Atualização de QR Code recebida
          } else if (message.type === "connection_status") {
            // Atualização de status de conexão recebida
          }
        } catch (error) {
          console.error("Erro ao processar mensagem WebSocket:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket desconectado:", event.code, event.reason);
        setConnectionStatus("disconnected");
        
        // Agenda reconexão automática após 3 segundos
        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error);
        setConnectionStatus("error");
      };
      
    } catch (error) {
      console.error("Erro ao iniciar WebSocket:", error);
      setConnectionStatus("error");
      
      // Tenta reconectar após falha
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [user]);

  // Conecta quando o componente é montado e quando o usuário muda
  useEffect(() => {
    if (user) {
      connect();
    }
    
    // Limpeza na desmontagem
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socket.current) {
        socket.current.close();
      }
    };
  }, [user, connect]);

  // Função para enviar mensagens
  const sendMessage = useCallback((type: string, data: any) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type, data }));
      return true;
    }
    
    // Não foi possível enviar
    toast({
      title: "Erro de conexão",
      description: "Não foi possível enviar a mensagem. Verifique sua conexão.",
      variant: "destructive"
    });
    
    return false;
  }, [toast]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    connect
  };
};

export default useWebSocket;