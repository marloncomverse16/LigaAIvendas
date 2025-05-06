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
      // Conectar ao nosso backend WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log(`Conexão WebSocket estabelecida com o servidor`);
        // Autenticar com o usuário atual
        socket.send(JSON.stringify({
          type: 'authenticate',
          userId: localStorage.getItem('userId') || sessionStorage.getItem('userId'),
          token: localStorage.getItem('token') || sessionStorage.getItem('token')
        }));
        
        // Conectar à Evolution API
        socket.send(JSON.stringify({
          type: 'connect_evolution',
          apiUrl: serverUrl,
          instanceId: instanceId,
          token: token
        }));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensagem recebida:', data);
          
          // Processar eventos
          if (data.type === 'connection_status' || data.type === 'qr_code') {
            set({ 
              connectionStatus: {
                ...get().connectionStatus,
                connected: data.data?.connected || false,
                state: data.data?.state,
                qrCode: data.data?.qrCode,
                phone: data.data?.phone,
                batteryLevel: data.data?.batteryLevel,
                instance: data.data?.instance
              }
            });
          } 
          else if (data.type === 'contacts' || data.type === 'contacts_updated') {
            if (data.data && data.data.contacts) {
              set({ contacts: data.data.contacts });
            }
          }
          else if (data.type === 'messages' || data.type === 'messages_updated') {
            if (data.data && data.data.contactId && data.data.messages) {
              const contactId = data.data.contactId;
              const messages = data.data.messages;
              const currentChats = get().chats;
              
              set({
                chats: {
                  ...currentChats,
                  [contactId]: messages
                }
              });
            }
          }
          else if (data.type === 'message_sent' || data.type === 'message_received') {
            if (data.data && data.data.contactId && data.data.message) {
              const contactId = data.data.contactId;
              const message = data.data.message;
              const currentChats = get().chats;
              
              set({
                chats: {
                  ...currentChats,
                  [contactId]: [...(currentChats[contactId] || []), message]
                }
              });
            }
          }
          else if (data.type === 'error' || data.type === 'connection_error') {
            console.error('Erro reportado pelo WebSocket:', data.error || data.data?.error);
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
  
  sendMessage: (contactId, message) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'send_message',
        contactId: parseInt(contactId),
        content: message
      }));
    } else {
      console.error('WebSocket não está conectado para enviar mensagem');
    }
  },
  
  setCurrentChat: (contactId) => {
    set({ currentChatId: contactId });
    
    // Carregar histórico de mensagens se ainda não existir
    const { chats, socket } = get();
    if (!chats[contactId] && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'get_messages',
        contactId: parseInt(contactId)
      }));
    }
  },
  
  refreshContacts: () => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'get_contacts'
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