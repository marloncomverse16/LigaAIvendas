import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";

type WebSocketContextType = {
  lastMessage: WebSocketEventMap["message"] | null;
  connectionStatus: boolean;
  sendMessage: (data: any) => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

type WebSocketProviderProps = {
  children: ReactNode;
  url: string;
};

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const [lastMessage, setLastMessage] = useState<WebSocketEventMap["message"] | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // Usar protocolo correto de acordo com a URL atual (ws ou wss)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = url.startsWith("ws") 
      ? url
      : `${protocol}//${window.location.host}${url}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnectionStatus(true);
      console.log("WebSocket conectado");
    };

    socket.onclose = (event) => {
      setConnectionStatus(false);
      console.log("WebSocket desconectado:", event.code, event.reason);
      
      // Tentar reconectar após 3 segundos
      setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error("Erro no WebSocket:", error);
    };

    socket.onmessage = (event) => {
      setLastMessage(event);
    };

    socketRef.current = socket;

    return () => {
      socket.close();
    };
  }, [url]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.error("WebSocket não está conectado");
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ lastMessage, connectionStatus, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(url: string = "/api/ws") {
  const contextValue = useContext(WebSocketContext);
  
  // Se o contexto já estiver disponível, retorne-o
  if (contextValue) {
    return contextValue;
  }
  
  // Caso contrário, crie um hook personalizado
  const [lastMessage, setLastMessage] = useState<WebSocketEventMap["message"] | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.error("WebSocket não está conectado");
    }
  }, []);
  
  useEffect(() => {
    // Usar protocolo correto de acordo com a URL atual (ws ou wss)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = url.startsWith("ws") 
      ? url
      : `${protocol}//${window.location.host}${url}`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      setConnectionStatus(true);
      console.log("WebSocket conectado");
    };
    
    socket.onclose = (event) => {
      setConnectionStatus(false);
      console.log("WebSocket desconectado:", event.code, event.reason);
    };
    
    socket.onerror = (error) => {
      console.error("Erro no WebSocket:", error);
    };
    
    socket.onmessage = (event) => {
      setLastMessage(event);
    };
    
    socketRef.current = socket;
    
    return () => {
      socket.close();
    };
  }, [url]);
  
  return { lastMessage, connectionStatus, sendMessage };
}