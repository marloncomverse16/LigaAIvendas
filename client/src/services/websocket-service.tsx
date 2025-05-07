import { createContext, ReactNode, useContext, useState, useEffect, useRef, useCallback } from "react";

type WebSocketContextType = {
  lastMessage: WebSocketEventMap["message"] | null;
  connectionStatus: boolean;
  sendMessage: (data: any) => void;
};

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

type WebSocketProviderProps = {
  children: ReactNode;
  url: string;
};

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketEventMap["message"] | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean>(false);
  
  // Criar URL do WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = `${protocol}//${window.location.host}${url}`;
    const ws = new WebSocket(fullUrl);
    
    setSocket(ws);
    
    ws.onopen = () => {
      console.log("WebSocket conectado");
      setConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
      setLastMessage(event);
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket desconectado: ${event.code} ${event.reason}`);
      setConnectionStatus(false);
    };
    
    ws.onerror = (error) => {
      console.error("Erro na conexão WebSocket:", error);
      setConnectionStatus(false);
    };
    
    return () => {
      ws.close();
    };
  }, [url]);
  
  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      console.warn("Conexão WebSocket não está aberta. Não foi possível enviar a mensagem.");
    }
  }, [socket]);
  
  return (
    <WebSocketContext.Provider value={{ lastMessage, connectionStatus, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  
  if (context === undefined) {
    throw new Error("useWebSocket deve ser usado dentro de um WebSocketProvider");
  }
  
  return context;
}

export default useWebSocket;