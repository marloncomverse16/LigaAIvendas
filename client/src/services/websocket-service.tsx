import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export interface ConnectionStatus {
  connected: boolean;
  qrCode?: string;
  lastUpdated: Date;
  method?: 'qrcode' | 'cloud';
  phoneNumber?: string;
  businessId?: string;
  cloudConnection?: boolean;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

export interface WebSocketService {
  connectionStatus: ConnectionStatus | null;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  isConnected: boolean;
}

const useWebSocket = (): WebSocketService => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket conectado');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          if (message.type === 'connection_status') {
            setConnectionStatus(message.data);
          } else if (message.type === 'qr_code') {
            if (message.data.qrcode) {
              setConnectionStatus(prev => {
                const current = prev || { 
                  connected: false, 
                  lastUpdated: new Date()
                };
                return {
                  ...current,
                  qrCode: message.data.qrcode,
                  lastUpdated: new Date()
                };
              });
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log(`WebSocket desconectado: ${event.code} ${event.reason}`);
        
        // Reconectar após 5 segundos se não foi fechado intencionalmente
        if (event.code !== 1000) {
          setTimeout(() => connectWebSocket(), 5000);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        toast({
          title: "Erro de conexão",
          description: "A conexão em tempo real foi interrompida. Tentando reconectar...",
          variant: "destructive"
        });
      };
    } catch (error) {
      console.error('Erro ao criar WebSocket:', error);
    }
  }, [toast]);

  // Conectar ao WebSocket quando o componente montar
  useEffect(() => {
    if (user) {
      connectWebSocket();
    }
    
    // Limpar conexão quando o componente desmontar
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [user, connectWebSocket]);

  // Reconectar se o WebSocket se desconectar
  useEffect(() => {
    if (!isConnected && user) {
      const timer = setTimeout(() => connectWebSocket(), 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, user, connectWebSocket]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket não está conectado');
      toast({
        title: "Erro de conexão",
        description: "Não foi possível enviar mensagem. WebSocket não está conectado.",
        variant: "destructive"
      });
    }
  }, [toast]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    isConnected
  };
};

export default useWebSocket;