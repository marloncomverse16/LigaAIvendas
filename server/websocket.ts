import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import axios from "axios";

// Armazenar as conexões WebSocket ativas por usuário
const userConnections: Map<number, WebSocket[]> = new Map();

// Armazenar os clientes do Evolution API por usuário
const evolutionClients: Map<number, WebSocket | null> = new Map();

interface WebSocketMessage {
  type: string;
  data?: any;
  userId?: number;
}

// Função para enviar mensagens para um usuário específico
export function sendToUser(userId: number, message: WebSocketMessage) {
  const connections = userConnections.get(userId);
  if (connections && connections.length > 0) {
    const payload = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

// Função para buscar e atualizar contatos
export async function syncContacts(userId: number, force = false) {
  try {
    const user = await storage.getUser(userId);
    if (!user) return;
    
    // Verificar se temos URL e token da API
    if (!user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
      console.log(`Usuário ${userId} não tem configuração da Evolution API`);
      return;
    }
    
    // Buscar contatos da Evolution API
    const response = await axios.get(
      `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/contacts`,
      { 
        headers: { 
          Authorization: `Bearer ${user.whatsappApiToken}` 
        }
      }
    );
    
    if (!response.data || !response.data.contacts) {
      console.log(`Não foi possível obter contatos para usuário ${userId}`);
      return;
    }
    
    // Processar e armazenar contatos
    const contacts = response.data.contacts;
    console.log(`Recebidos ${contacts.length} contatos para usuário ${userId}`);
    
    // Para cada contato, verificar se já existe e atualizar ou criar
    for (const contact of contacts) {
      const existingContact = await storage.getWhatsappContactByContactId(userId, contact.id);
      
      if (existingContact) {
        // Atualizar contato existente
        await storage.updateWhatsappContact(existingContact.id, {
          name: contact.name,
          profilePicture: contact.profilePicture,
          lastActivity: contact.lastActivity ? new Date(contact.lastActivity) : undefined,
          lastMessageContent: contact.lastMessage?.content,
          unreadCount: contact.unreadCount || 0,
        });
      } else {
        // Criar novo contato
        await storage.createWhatsappContact({
          userId,
          contactId: contact.id,
          name: contact.name,
          number: contact.number,
          profilePicture: contact.profilePicture,
          isGroup: contact.isGroup || false,
          lastActivity: contact.lastActivity ? new Date(contact.lastActivity) : undefined,
          lastMessageContent: contact.lastMessage?.content,
          unreadCount: contact.unreadCount || 0,
        });
      }
    }
    
    // Notificar o cliente sobre novos contatos
    const updatedContacts = await storage.getWhatsappContacts(userId);
    sendToUser(userId, {
      type: 'contacts_updated',
      data: { contacts: updatedContacts }
    });
    
    return updatedContacts;
  } catch (error) {
    console.error(`Erro ao sincronizar contatos para usuário ${userId}:`, error);
  }
}

// Função para buscar e atualizar mensagens de um contato
export async function syncMessages(userId: number, contactId: number) {
  try {
    const user = await storage.getUser(userId);
    const contact = await storage.getWhatsappContact(contactId);
    
    if (!user || !contact) return;
    
    // Verificar se temos URL e token da API
    if (!user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
      console.log(`Usuário ${userId} não tem configuração da Evolution API`);
      return;
    }
    
    // Buscar mensagens da Evolution API
    const response = await axios.get(
      `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/chats/${contact.contactId}/messages`,
      { 
        headers: { 
          Authorization: `Bearer ${user.whatsappApiToken}` 
        }
      }
    );
    
    if (!response.data || !response.data.messages) {
      console.log(`Não foi possível obter mensagens para ${contact.name} (${contactId})`);
      return;
    }
    
    // Processar e armazenar mensagens
    const messages = response.data.messages;
    console.log(`Recebidas ${messages.length} mensagens do contato ${contact.name}`);
    
    // Para cada mensagem, verificar se já existe e criar se não
    const storedMessages = [];
    
    for (const message of messages) {
      const existingMessage = await storage.getWhatsappMessageByMessageId(userId, message.id);
      
      if (!existingMessage) {
        // Criar nova mensagem
        const newMessage = await storage.createWhatsappMessage({
          userId,
          contactId,
          messageId: message.id,
          content: message.content,
          fromMe: message.fromMe,
          timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
          mediaType: message.media?.type,
          mediaUrl: message.media?.url,
          isRead: message.isRead || message.fromMe,
        });
        
        storedMessages.push(newMessage);
      } else {
        storedMessages.push(existingMessage);
      }
    }
    
    // Notificar o cliente sobre novas mensagens
    if (storedMessages.length > 0) {
      sendToUser(userId, {
        type: 'messages_updated',
        data: { 
          contactId,
          messages: storedMessages 
        }
      });
    }
    
    return storedMessages;
  } catch (error) {
    console.error(`Erro ao sincronizar mensagens para contato ${contactId}:`, error);
  }
}

// Função para enviar mensagem via Evolution API
export async function sendMessage(userId: number, contactId: number, content: string) {
  try {
    const user = await storage.getUser(userId);
    const contact = await storage.getWhatsappContact(contactId);
    
    if (!user || !contact) return { success: false, error: 'Usuário ou contato não encontrado' };
    
    // Verificar se temos URL e token da API
    if (!user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
      return { success: false, error: 'Configuração da Evolution API não encontrada' };
    }
    
    // Enviar mensagem via Evolution API
    const response = await axios.post(
      `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/chats/${contact.contactId}/messages`,
      { 
        content
      },
      { 
        headers: { 
          Authorization: `Bearer ${user.whatsappApiToken}` 
        }
      }
    );
    
    if (!response.data || !response.data.success) {
      return { success: false, error: 'Falha ao enviar mensagem via API' };
    }
    
    // Criar registro da mensagem enviada no banco de dados
    const message = await storage.createWhatsappMessage({
      userId,
      contactId,
      messageId: response.data.messageId || `local-${Date.now()}`,
      content,
      fromMe: true,
      timestamp: new Date(),
      isRead: true,
    });
    
    // Notificar cliente sobre a nova mensagem
    sendToUser(userId, {
      type: 'message_sent',
      data: { contactId, message }
    });
    
    return { success: true, message };
  } catch (error) {
    console.error(`Erro ao enviar mensagem para ${contactId}:`, error);
    return { success: false, error: `Erro ao enviar mensagem: ${error.message}` };
  }
}

// Configurar WebSocket no servidor HTTP
export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ 
    noServer: true, // Usar noServer para manipular o upgrade manualmente
  });
  
  // Configurar upgrade manualmente para ter mais controle sobre headers e cors
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    if (pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  console.log('Servidor WebSocket iniciado em /api/ws');
  
  wss.on('connection', (ws, req) => {
    console.log('Nova conexão WebSocket');
    
    // Identificar o usuário da conexão
    let userId: number | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Mensagem de autenticação
        if (data.type === 'authenticate') {
          // Por enquanto, aceitamos um token simples baseado no userId
          // No futuro, implementaremos um sistema de token JWT
          if (!data.token || !data.userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Token não fornecido ou inválido' }));
            return;
          }
          
          // Verificação simples: o token deve ser igual ao userId como string
          if (data.token !== data.userId.toString()) {
            ws.send(JSON.stringify({ type: 'error', error: 'Token inválido' }));
            return;
          }
          
          userId = data.userId;
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Autenticação falhou' }));
            return;
          }
          
          // Registrar conexão do usuário
          if (!userConnections.has(userId)) {
            userConnections.set(userId, []);
          }
          userConnections.get(userId)?.push(ws);
          
          // Responder com confirmação
          ws.send(JSON.stringify({ 
            type: 'authenticated', 
            userId 
          }));
          
          console.log(`Usuário ${userId} autenticado via WebSocket`);
          
          // Enviar dados iniciais
          const contacts = await storage.getWhatsappContacts(userId);
          ws.send(JSON.stringify({
            type: 'contacts',
            data: { contacts }
          }));
          
          // Iniciar sincronização de contatos
          syncContacts(userId);
        }
        
        // Requisição de contatos
        else if (data.type === 'get_contacts') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          const contacts = await syncContacts(userId, true);
          ws.send(JSON.stringify({
            type: 'contacts',
            data: { contacts }
          }));
        }
        
        // Requisição de mensagens de um contato
        else if (data.type === 'get_messages') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          if (!data.contactId) {
            ws.send(JSON.stringify({ type: 'error', error: 'ID do contato não fornecido' }));
            return;
          }
          
          // Verificar se o contato existe
          const contact = await storage.getWhatsappContact(data.contactId);
          if (!contact || contact.userId !== userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Contato não encontrado' }));
            return;
          }
          
          // Buscar mensagens locais primeiro
          const localMessages = await storage.getWhatsappMessages(userId, data.contactId);
          ws.send(JSON.stringify({
            type: 'messages',
            data: { 
              contactId: data.contactId,
              messages: localMessages
            }
          }));
          
          // Sincronizar com API em segundo plano
          syncMessages(userId, data.contactId);
        }
        
        // Envio de mensagem
        else if (data.type === 'send_message') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          if (!data.contactId || !data.content) {
            ws.send(JSON.stringify({ type: 'error', error: 'Dados incompletos' }));
            return;
          }
          
          // Verificar se o contato existe
          const contact = await storage.getWhatsappContact(data.contactId);
          if (!contact || contact.userId !== userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Contato não encontrado' }));
            return;
          }
          
          // Enviar mensagem
          const result = await sendMessage(userId, data.contactId, data.content);
          
          ws.send(JSON.stringify({
            type: 'message_result',
            data: result
          }));
        }
        
        // Conectar à Evolution API
        else if (data.type === 'connect_evolution') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          const user = await storage.getUser(userId);
          if (!user || !user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: 'Configuração da Evolution API não encontrada' 
            }));
            return;
          }
          
          try {
            // Verificar status atual da instância
            const response = await axios.get(
              `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/status`,
              { 
                headers: { 
                  Authorization: `Bearer ${user.whatsappApiToken}` 
                }
              }
            );
            
            const status = response.data;
            
            ws.send(JSON.stringify({
              type: 'connection_status',
              data: status
            }));
            
            // Se não estiver conectado, iniciar processo de conexão
            if (!status.connected) {
              // Iniciar conexão com QR code
              const connectResponse = await axios.post(
                `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/connect`,
                {},
                { 
                  headers: { 
                    Authorization: `Bearer ${user.whatsappApiToken}` 
                  }
                }
              );
              
              if (connectResponse.data && connectResponse.data.qrcode) {
                ws.send(JSON.stringify({
                  type: 'qr_code',
                  data: {
                    qrCode: connectResponse.data.qrcode
                  }
                }));
              }
            }
          } catch (error) {
            console.error(`Erro ao conectar à Evolution API para usuário ${userId}:`, error);
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: `Erro ao conectar: ${error.message}` 
            }));
          }
        }
        
        // Desconectar da Evolution API
        else if (data.type === 'disconnect_evolution') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          const user = await storage.getUser(userId);
          if (!user || !user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: 'Configuração da Evolution API não encontrada' 
            }));
            return;
          }
          
          try {
            // Fazer logout da instância
            const response = await axios.post(
              `${user.whatsappApiUrl}/instances/${user.whatsappInstanceId}/logout`,
              {},
              { 
                headers: { 
                  Authorization: `Bearer ${user.whatsappApiToken}` 
                }
              }
            );
            
            // Notificar cliente sobre desconexão
            ws.send(JSON.stringify({
              type: 'connection_status',
              data: { connected: false }
            }));
            
          } catch (error) {
            console.error(`Erro ao desconectar da Evolution API para usuário ${userId}:`, error);
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: `Erro ao desconectar: ${error.message}` 
            }));
          }
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Erro ao processar mensagem' 
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('Conexão WebSocket fechada');
      
      // Remover esta conexão da lista do usuário
      if (userId) {
        const connections = userConnections.get(userId);
        if (connections) {
          const index = connections.indexOf(ws);
          if (index !== -1) {
            connections.splice(index, 1);
          }
          
          // Se não houver mais conexões, limpar a entrada do usuário
          if (connections.length === 0) {
            userConnections.delete(userId);
          }
        }
      }
    });
  });
  
  return wss;
}