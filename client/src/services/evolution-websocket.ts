import { create } from 'zustand';
import { useEffect } from 'react';

// Tipos para eventos da Evolution API
export interface EvolutionContact {
  id: string;
  name: string;
  number: string;
  profilePicture?: string;
  isGroup: boolean;
  unreadCount?: number;
  lastMessage?: {
    timestamp: number;
    content: string;
  };
}

export interface EvolutionMessage {
  id: string;
  content: string;
  fromMe: boolean;
  timestamp: number;
  chatId: string;
  sender?: {
    id: string;
    name: string;
    number: string;
  };
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    filename?: string;
    mimetype?: string;
  };
}

export interface EvolutionConnectionStatus {
  connected: boolean;
  qrCode?: string;
  state?: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'NEED_QR';
  phone?: string;
  batteryLevel?: number;
  instance?: {
    instanceId: string;
    instanceName: string;
  };
}

// Estado do Store
interface EvolutionState {
  connectionStatus: EvolutionConnectionStatus;
  contacts: EvolutionContact[];
  chats: Record<string, EvolutionMessage[]>;
  socket: WebSocket | null;
  currentChatId: string | null;
  
  // Ações
  connect: (serverUrl: string, instanceId: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (chatId: string, message: string) => void;
  setCurrentChat: (chatId: string) => void;
  refreshContacts: () => void;
}

// Store Zustand para gerenciar estado do WebSocket
export const useEvolutionStore = create<EvolutionState>((set, get) => ({
  connectionStatus: {
    connected: false
  },
  contacts: [],
  chats: {},
  socket: null,
  currentChatId: null,
  
  connect: (serverUrl, instanceId, token) => {
    // Fechar conexão existente se houver
    if (get().socket && get().socket.readyState === WebSocket.OPEN) {
      get().socket.close();
    }
    
    try {
      // Garantir que a URL está no formato correto para WebSocket
      const wsUrl = serverUrl.replace(/^http/, 'ws');
      const socket = new WebSocket(`${wsUrl}/instances/${instanceId}/connection`);
      
      socket.onopen = () => {
        console.log(`Conexão WebSocket estabelecida com Evolution API: ${instanceId}`);
        // Autenticar
        socket.send(JSON.stringify({
          action: 'authenticate',
          token: token
        }));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensagem recebida:', data);
          
          // Processar eventos
          if (data.type === 'connection') {
            set({ 
              connectionStatus: {
                ...get().connectionStatus,
                connected: data.state === 'CONNECTED',
                state: data.state,
                qrCode: data.qrCode,
                phone: data.phone
              }
            });
          } 
          else if (data.type === 'contacts') {
            set({ contacts: data.contacts });
          }
          else if (data.type === 'message') {
            const chatId = data.message.chatId;
            const currentChats = get().chats;
            
            set({
              chats: {
                ...currentChats,
                [chatId]: [...(currentChats[chatId] || []), data.message]
              }
            });
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('Erro na conexão WebSocket:', error);
      };
      
      socket.onclose = () => {
        console.log('Conexão WebSocket fechada');
        set({ 
          connectionStatus: { 
            ...get().connectionStatus, 
            connected: false,
            state: 'DISCONNECTED'
          } 
        });
      };
      
      set({ socket });
      
    } catch (error) {
      console.error('Falha ao conectar via WebSocket:', error);
    }
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null });
    }
  },
  
  sendMessage: (chatId, message) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'sendMessage',
        chatId,
        message
      }));
    } else {
      console.error('WebSocket não está conectado para enviar mensagem');
    }
  },
  
  setCurrentChat: (chatId) => {
    set({ currentChatId: chatId });
    
    // Carregar histórico de mensagens se ainda não existir
    const { chats, socket } = get();
    if (!chats[chatId] && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'getMessages',
        chatId
      }));
    }
  },
  
  refreshContacts: () => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'getContacts'
      }));
    }
  }
}));

// Hook para conectar com a Evolution API baseado nas configurações do usuário
export function useEvolutionWebSocket(user: any) {
  const { connect, connectionStatus } = useEvolutionStore();
  
  // Iniciar conexão quando o usuário estiver disponível
  useEffect(() => {
    if (user && user.whatsappApiUrl && user.whatsappInstanceId && user.whatsappApiToken) {
      connect(
        user.whatsappApiUrl,
        user.whatsappInstanceId,
        user.whatsappApiToken
      );
    }
  }, [user, connect]);
  
  return connectionStatus;
}