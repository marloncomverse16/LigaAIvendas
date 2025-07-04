import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import axios from "axios";
import { EvolutionApiClient } from "./evolution-api";
import { sendQRConnectionWebhook, sendQRDisconnectionWebhook } from "./api/qr-connection-webhook";

// Armazenar as conexões WebSocket ativas por usuário
const userConnections: Map<number, WebSocket[]> = new Map();

// Armazenar os clientes do Evolution API por usuário
const evolutionClients: Map<number, WebSocket | null> = new Map();

// Função para conectar diretamente ao WebSocket da Evolution API
async function connectToEvolutionSocket(userId: number, apiUrl: string, token: string) {
  try {
    // Fechar qualquer conexão existente
    const existingSocket = evolutionClients.get(userId);
    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      existingSocket.close();
    }
    
    // Formatar a URL do WebSocket
    const wsProtocol = apiUrl.startsWith('https') ? 'wss://' : 'ws://';
    const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, "");
    const wsUrl = `${wsProtocol}${baseUrl}/socket`;
    
    console.log(`Conectando ao WebSocket da Evolution API: ${wsUrl}`);
    
    // Criar nova conexão WebSocket
    const socket = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    socket.on('open', () => {
      console.log(`Conexão WebSocket com Evolution API estabelecida para usuário ${userId}`);
      sendToUser(userId, {
        type: 'connection_status',
        data: { connected: true, state: 'CONNECTED' }
      });
      
      // Armazenar cliente
      evolutionClients.set(userId, socket);
    });
    
    socket.on('message', (data) => {
      try {
        console.log(`Mensagem recebida da Evolution API para usuário ${userId}:`, data.toString());
        const message = JSON.parse(data.toString());
        
        // Processar mensagem recebida e encaminhar para o cliente
        if (message.event === 'status.instance') {
          const isConnected = message.data?.connected || false;
          const wasConnected = evolutionClients.has(userId) && evolutionClients.get(userId) !== null;
          
          sendToUser(userId, {
            type: 'connection_status',
            data: {
              connected: isConnected,
              state: message.data?.state,
              phone: message.data?.phone,
              batteryLevel: message.data?.batteryLevel
            }
          });
          
          // Detectar mudança de estado de conexão e enviar webhook
          if (isConnected && !wasConnected) {
            console.log(`🔔 QR Code conectado para usuário ${userId}, enviando webhook...`);
            sendQRConnectionWebhook(userId).catch(error => {
              console.error(`❌ Erro ao enviar webhook de conexão:`, error);
            });
          } else if (!isConnected && wasConnected) {
            console.log(`🔔 QR Code desconectado para usuário ${userId}, enviando webhook...`);
            sendQRDisconnectionWebhook(userId).catch(error => {
              console.error(`❌ Erro ao enviar webhook de desconexão:`, error);
            });
          }
        }
        // Adicionar outros eventos conforme necessário
      } catch (error) {
        console.error(`Erro ao processar mensagem da Evolution API:`, error);
      }
    });
    
    socket.on('error', (error) => {
      console.error(`Erro na conexão WebSocket da Evolution API para usuário ${userId}:`, error);
      sendToUser(userId, {
        type: 'connection_error',
        error: `Erro na conexão com Evolution API: ${error.message}`
      });
    });
    
    socket.on('close', () => {
      console.log(`Conexão WebSocket com Evolution API fechada para usuário ${userId}`);
      sendToUser(userId, {
        type: 'connection_status',
        data: { connected: false, state: 'DISCONNECTED' }
      });
      
      // Remover cliente
      evolutionClients.set(userId, null);
    });
    
    return socket;
  } catch (error) {
    console.error(`Erro ao conectar ao WebSocket da Evolution API para usuário ${userId}:`, error);
    sendToUser(userId, {
      type: 'connection_error',
      error: `Erro ao conectar: ${error.message}`
    });
    return null;
  }
}

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
    // Corrigir formato da URL para evitar barras duplicadas
    const baseUrl = user.whatsappApiUrl.replace(/\/+$/, "");
    // Usar o nome do usuário como instância
    const path = `/instances/${user.username}/contacts`.replace(/^\/+/, "");
    const fullUrl = `${baseUrl}/${path}`;
    console.log(`Usando nome do usuário (${user.username}) como instância para sincronizar contatos`);
    
    console.log(`Sincronizando contatos da Evolution API: ${fullUrl}`);
    
    const response = await axios.get(
      fullUrl,
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
    // Corrigir formato da URL e garantir que temos o caminho manager
    const baseUrl = user.whatsappApiUrl.replace(/\/+$/, "");
    
    // Verificar se a URL já contém 'manager', senão adicionar
    const managerPath = baseUrl.includes('/manager') ? '' : '/manager';
    // Usar nome do usuário como instância
    const path = `${managerPath}/instances/${user.username}/chats/${contact.contactId}/messages`.replace(/^\/+/, "");
    const fullUrl = `${baseUrl}/${path}`;
    console.log(`Usando nome do usuário (${user.username}) como instância para sincronizar mensagens`);
    
    console.log(`Sincronizando mensagens da Evolution API: ${fullUrl}`);
    
    const response = await axios.get(
      fullUrl,
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

// Função para enviar mensagem via Evolution API WebSocket
export async function sendMessage(userId: number, contactId: number, content: string) {
  try {
    const user = await storage.getUser(userId);
    const contact = await storage.getWhatsappContact(contactId);
    
    if (!user || !contact) return { success: false, error: 'Usuário ou contato não encontrado' };
    
    // Verificar se há um socket WebSocket ativo para o usuário
    const socket = evolutionClients.get(userId);
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log(`Socket da Evolution API não está disponível para usuário ${userId}, tentando conectar...`);
      
      if (!user.whatsappApiUrl || !user.whatsappApiToken) {
        return { success: false, error: 'Configuração da Evolution API não encontrada' };
      }
      
      // Tentar estabelecer nova conexão
      const newSocket = await connectToEvolutionSocket(userId, user.whatsappApiUrl, user.whatsappApiToken);
      if (!newSocket || newSocket.readyState !== WebSocket.OPEN) {
        return { success: false, error: 'Não foi possível estabelecer conexão com a Evolution API' };
      }
    }
    
    // A este ponto temos um socket válido
    const activeSocket = evolutionClients.get(userId);
    
    if (!activeSocket) {
      return { success: false, error: 'Socket não encontrado após conexão' };
    }
    
    console.log(`Enviando mensagem via Evolution API WebSocket para ${contact.number || contact.contactId}`);
    
    // Enviar mensagem utilizando WebSocket
    const messageId = `msg_${Date.now()}`;
    activeSocket.send(JSON.stringify({
      event: 'send-message',
      data: {
        instanceName: user.username, // Usando nome do usuário como instância
        phone: contact.number || contact.contactId,
        message: content,
        options: {
          messageId
        }
      }
    }));
    
    // Criar registro da mensagem enviada no banco de dados
    const message = await storage.createWhatsappMessage({
      userId,
      contactId,
      messageId,
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
          
          // Verificar se o usuário tem as configurações da Evolution API
          // Se não tiver, tenta buscar do servidor associado
          const user = await storage.getUser(userId);
          if (!user || (!user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId)) {
            console.log(`Usuário ${userId} não tem configuração da Evolution API, tentando buscar do servidor`);
            
            try {
              // Buscar servidor ativo do usuário
              const userServers = await storage.getUserServers(userId);
              console.log(`Servidores encontrados para usuário ${userId}:`, userServers ? userServers.length : 0);
              
              if (userServers && userServers.length > 0) {
                // Pegar o primeiro servidor ativo
                const activeServers = userServers.filter((us: any) => {
                  // Verificar se us.server existe e está ativo
                  return us && us.server && us.server.active === true;
                });
                
                console.log(`Servidores ativos encontrados: ${activeServers.length}`);
                
                if (activeServers.length > 0) {
                  const firstServer = activeServers[0].server;
                  console.log('Dados do servidor encontrado:', JSON.stringify(firstServer, null, 2));
                  
                  // Verificar se temos todas as informações necessárias
                  if (firstServer && firstServer.apiUrl && (firstServer.apiToken || firstServer.apiToken === null)) {
                    console.log(`Atualizando configurações da Evolution API para usuário ${userId} com dados do servidor ${firstServer.id}`);
                    
                    // Buscar informações do usuário para usar o nome como instância
                    const userInfo = await storage.getUser(userId);
                    if (!userInfo || !userInfo.username) {
                      throw new Error('Não foi possível obter informações do usuário');
                    }
                    
                    // Usar o nome do usuário como instância
                    const instanceId = userInfo.username;
                    console.log(`Usando nome do usuário como instância: ${instanceId}`);
                    
                    // Atualizar informações do usuário com os dados do servidor
                    await storage.updateUser(userId, {
                      whatsappApiUrl: firstServer.apiUrl,
                      whatsappApiToken: firstServer.apiToken,
                      whatsappInstanceId: instanceId
                    });
                    
                    // Notificar cliente que as configurações foram atualizadas
                    ws.send(JSON.stringify({
                      type: 'api_config_updated',
                      data: {
                        whatsappApiUrl: firstServer.apiUrl,
                        whatsappApiToken: firstServer.apiToken,
                        whatsappInstanceId: instanceId
                      }
                    }));
                  } else {
                    console.log('Servidor encontrado com configurações incompletas:', firstServer);
                    ws.send(JSON.stringify({
                      type: 'connection_error',
                      error: 'Servidor ativo encontrado, mas sem configurações completas da API'
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'connection_error',
                    error: 'Nenhum servidor ativo encontrado para o usuário'
                  }));
                }
              } else {
                ws.send(JSON.stringify({
                  type: 'connection_error',
                  error: 'Usuário não tem servidores associados'
                }));
              }
            } catch (error) {
              console.error(`Erro ao buscar configurações de servidor para usuário ${userId}:`, error);
              ws.send(JSON.stringify({
                type: 'connection_error',
                error: 'Erro ao buscar configurações de servidor'
              }));
            }
          }
          
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
        
        // Criar instância na Evolution API
        else if (data.type === 'create_evolution_instance') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          const user = await storage.getUser(userId);
          if (!user) {
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: 'Usuário não encontrado' 
            }));
            return;
          }
          
          // Primeiro buscar servidores do usuário para obter credenciais
          const userServers = await storage.getUserServers(userId);
          if (!userServers || userServers.length === 0 || !userServers[0].server || 
              !userServers[0].server.apiUrl || !userServers[0].server.apiToken) {
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: 'Servidor não configurado. Configure um servidor com API Evolution.' 
            }));
            return;
          }
          
          // Selecionar o primeiro servidor ativo
          const userServer = userServers[0];
          
          try {
            console.log(`Tentando criar instância para o usuário ${user.username}`);
            
            // Usar o token do ambiente se disponível
            const token = process.env.EVOLUTION_API_TOKEN || userServer.server.apiToken;
            console.log(`Usando token ${process.env.EVOLUTION_API_TOKEN ? 'do ambiente' : 'do servidor'} para criar instância`);
            
            const evolutionClient = new EvolutionApiClient(
              userServer.server.apiUrl,
              token,
              user.username // Nome do usuário como instância
            );
            
            // Tentar criar a instância
            const createResult = await evolutionClient.createInstance();
            console.log("Resultado da criação da instância:", createResult);
            
            ws.send(JSON.stringify({
              type: 'instance_created',
              data: {
                success: createResult.success,
                message: createResult.success 
                  ? 'Instância criada com sucesso' 
                  : 'Não foi possível criar a instância, mas tentaremos continuar',
                details: createResult
              }
            }));
            
          } catch (error) {
            console.error(`Erro ao criar instância para usuário ${userId}:`, error);
            ws.send(JSON.stringify({ 
              type: 'instance_created', 
              data: {
                success: false,
                error: `Erro ao criar instância: ${error.message}`
              }
            }));
          }
        }
        
        // Conectar à Evolution API via WebSocket direto
        else if (data.type === 'connect_evolution') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          const user = await storage.getUser(userId);
          if (!user || !user.whatsappApiUrl || !user.whatsappApiToken) {
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: 'Configuração da Evolution API não encontrada' 
            }));
            return;
          }
          
          try {
            // Tentando nova abordagem com a Evolution API
            console.log(`Tentando abordagem direta com a Evolution API para usuário ${userId}`);
            
            try {
              // API raiz para obter metadados e informações do servidor
              const baseUrl = 'https://api.primerastreadores.com';
              console.log(`Verificando API raiz em: ${baseUrl}`);
              
              // Fazer requisição para o endpoint raiz para obter informações
              const infoResponse = await axios.get(
                baseUrl,
                { 
                  headers: { 
                    Authorization: `Bearer ${user.whatsappApiToken}` 
                  }
                }
              );
              
              if (infoResponse.status !== 200) {
                throw new Error(`API retornou código de status ${infoResponse.status}`);
              }
              
              console.log('Informações da API:', infoResponse.data);
              
              // Usamos a resposta da API para determinar o endpoint correto
              const managerUrl = infoResponse.data.manager;
              if (!managerUrl) {
                throw new Error('Endpoint do manager não encontrado na resposta da API');
              }
              
              // Resolver o caso de usar HTTP vs HTTPS
              const resolvedManagerUrl = managerUrl.replace(/^http:/, 'https:');
              console.log(`Manager URL: ${resolvedManagerUrl}`);
              
              // Notificar cliente que estamos tentando conectar
              ws.send(JSON.stringify({
                type: 'connection_status',
                data: { 
                  connecting: true, 
                  message: 'Iniciando conexão com a Evolution API...',
                  apiVersion: infoResponse.data.version
                }
              }));
              
              // TENTATIVA DE CORREÇÃO: Criar a instância com o nome de usuário
              try {
                console.log(`Tentando criar instância para o usuário ${user.username}`);
                
                // Preparar dados para criação da instância
                const createInstanceBody = {
                  instanceName: user.username,
                  token: user.whatsappApiToken,
                  webhook: null,
                  webhookByEvents: false,
                  reject_call: false,
                  events_message: false,
                  ignore_group: false,
                  ignore_broadcast: false,
                  save_message: true,
                  webhook_base64: true
                };
                
                // Primeiro endpoint para tentar criar a instância
                try {
                  console.log(`Criando instância em ${baseUrl}/instance/create`);
                  const createResponse = await axios.post(
                    `${baseUrl}/instance/create`,
                    createInstanceBody,
                    { headers: { Authorization: `Bearer ${user.whatsappApiToken}` } }
                  );
                  
                  console.log(`Resposta da criação de instância:`, createResponse.data);
                  
                } catch (createErr) {
                  console.log(`Erro na primeira tentativa de criar instância: ${createErr.message}`);
                  
                  // Tentar segundo endpoint
                  try {
                    console.log(`Tentando endpoint alternativo ${baseUrl}/instance/create/${user.username}`);
                    const createAltResponse = await axios.post(
                      `${baseUrl}/instance/create/${user.username}`,
                      createInstanceBody,
                      { headers: { Authorization: `Bearer ${user.whatsappApiToken}` } }
                    );
                    
                    console.log(`Resposta da criação alternativa:`, createAltResponse.data);
                  } catch (altErr) {
                    console.log(`Erro na segunda tentativa: ${altErr.message}`);
                  }
                }
                
                // Com a instância criada, tentar obter o QR code
                // Tentativas com vários endpoints
                const qrEndpoints = [
                  `${baseUrl}/instance/qrcode/${user.username}`, 
                  `${resolvedManagerUrl}/instance/qrcode/${user.username}`,
                  `${baseUrl}/qrcode/${user.username}`
                ];
                
                let qrCodeObtained = false;
                let qrCodeData = null;
                
                for (const endpoint of qrEndpoints) {
                  if (qrCodeObtained) break;
                  
                  try {
                    console.log(`Tentando obter QR code em: ${endpoint}`);
                    
                    // Tentar POST com instanceName
                    try {
                      const qrResponse = await axios.post(
                        endpoint,
                        { instanceName: user.username },
                        { headers: { Authorization: `Bearer ${user.whatsappApiToken}` } }
                      );
                      
                      if (qrResponse.status === 200 || qrResponse.status === 201) {
                        console.log(`QR Code obtido com sucesso via POST em ${endpoint}`);
                        
                        // Tentar extrair o QR code da resposta
                        const qrCode = qrResponse.data?.qrcode || 
                                      qrResponse.data?.qrCode || 
                                      qrResponse.data?.base64 || 
                                      (typeof qrResponse.data === 'string' ? qrResponse.data : null);
                        
                        if (qrCode) {
                          qrCodeObtained = true;
                          qrCodeData = qrCode;
                          break;
                        }
                      }
                    } catch (postErr) {
                      console.log(`POST para QR code falhou: ${postErr.message}`);
                    }
                    
                    // Se POST falhar, tentar GET
                    try {
                      const qrGetResponse = await axios.get(
                        endpoint,
                        { headers: { Authorization: `Bearer ${user.whatsappApiToken}` } }
                      );
                      
                      if (qrGetResponse.status === 200 || qrGetResponse.status === 201) {
                        console.log(`QR Code obtido com sucesso via GET em ${endpoint}`);
                        
                        // Tentar extrair o QR code da resposta
                        const qrCode = qrGetResponse.data?.qrcode || 
                                      qrGetResponse.data?.qrCode || 
                                      qrGetResponse.data?.base64 || 
                                      (typeof qrGetResponse.data === 'string' ? qrGetResponse.data : null);
                        
                        if (qrCode) {
                          qrCodeObtained = true;
                          qrCodeData = qrCode;
                          break;
                        }
                      }
                    } catch (getErr) {
                      console.log(`GET para QR code falhou: ${getErr.message}`);
                    }
                  } catch (endpointErr) {
                    console.log(`Erro ao acessar endpoint ${endpoint}: ${endpointErr.message}`);
                  }
                }
                
                if (qrCodeObtained && qrCodeData) {
                  console.log("QR Code obtido com sucesso!");
                  
                  // Verifica o formato do QR code e ajusta conforme necessário
                  let formattedQrCode = qrCodeData;
                  
                  // Se a resposta for um objeto com propriedade 'code', usar esse valor (Evolution API v2)
                  if (typeof qrCodeData === 'object' && qrCodeData.code) {
                    formattedQrCode = qrCodeData.code;
                    console.log("Usando campo 'code' do objeto QR");
                  }
                  
                  // Verificar se não é HTML (evita enviar HTML como QR code)
                  if (typeof formattedQrCode === 'string' && 
                     (formattedQrCode.includes('<!doctype html>') || 
                      formattedQrCode.includes('<html>'))) {
                    console.log("QR Code contém HTML, enviando mensagem de erro");
                    console.log("Detalhes do problema: A API Evolution está retornando HTML em vez de um QR code válido.");
                    console.log("Isso geralmente acontece quando:");
                    console.log("1. A instância já existe mas está em estado inválido");
                    console.log("2. O token de autorização está incorreto ou não tem permissões suficientes");
                    console.log("3. A URL do webhook configurada não está acessível");
                    
                    // Verificar se o HTML contém mensagens de erro específicas da Evolution API
                    if (formattedQrCode.includes('Connection Error') || 
                        formattedQrCode.includes('Error 403') ||
                        formattedQrCode.includes('Forbidden')) {
                      console.log("Detectada mensagem de erro 403/Forbidden na resposta");
                      ws.send(JSON.stringify({
                        type: 'connection_error',
                        data: {
                          message: 'Erro de autorização na API Evolution. Verifique o token de API.'
                        }
                      }));
                      return;
                    }
                    
                    if (formattedQrCode.includes('Error 404') ||
                        formattedQrCode.includes('Not Found')) {
                      console.log("Detectada mensagem 404/Not Found na resposta");
                      ws.send(JSON.stringify({
                        type: 'connection_error',
                        data: {
                          message: 'Instância não encontrada na API Evolution. Verifique o nome da instância ou crie uma nova.'
                        }
                      }));
                      return;
                    }
                    
                    // Mensagem padrão se não for um erro específico conhecido
                    ws.send(JSON.stringify({
                      type: 'connection_error',
                      data: {
                        message: 'Erro na conexão com o servidor WhatsApp. Verifique a configuração do webhook e o token da API.'
                      }
                    }));
                    return;
                  }
                  
                  // Log para debug
                  console.log(`Tipo do QR code: ${typeof formattedQrCode}`);
                  if (typeof formattedQrCode === 'string') {
                    console.log(`QR code começa com: ${formattedQrCode.substring(0, 30)}...`);
                  }
                  
                  ws.send(JSON.stringify({
                    type: 'qr_code',
                    data: {
                      qrCode: formattedQrCode,
                      message: 'Por favor escaneie o QR code com seu WhatsApp'
                    }
                  }));
                } else {
                  console.log("Não foi possível obter QR code após tentar múltiplos endpoints");
                  
                  // Fornecer um QR code de teste para debug
                  const qrCodeExample = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WhatsAppConnectionTest';
                  
                  ws.send(JSON.stringify({
                    type: 'qr_code',
                    data: {
                      qrCode: qrCodeExample,
                      message: 'Por favor escaneie o QR code com seu WhatsApp (TESTE)'
                    }
                  }));
                  
                  ws.send(JSON.stringify({
                    type: 'connection_error', 
                    error: 'Não foi possível obter QR code da Evolution API. Por favor tente novamente mais tarde ou entre em contato com o suporte.'
                  }));
                }
                
              } catch (instanceErr) {
                console.error(`Erro ao gerenciar instância: ${instanceErr.message}`);
                
                // Mensagem de erro para o usuário
                ws.send(JSON.stringify({
                  type: 'connection_error', 
                  error: 'Ocorreu um erro ao configurar a instância na API Evolution. Por favor, entre em contato com o suporte.'
                }));
              }
            } catch (httpError) {
              console.error('Erro ao fazer solicitação HTTP para a Evolution API:', httpError);
              ws.send(JSON.stringify({
                type: 'connection_error',
                error: `Erro na conexão HTTP: ${httpError.message}`
              }));
            }
          } catch (error) {
            console.error(`Erro ao conectar à Evolution API para usuário ${userId}:`, error);
            ws.send(JSON.stringify({ 
              type: 'connection_error', 
              error: `Erro ao conectar: ${error.message}` 
            }));
          }
        }
        
        // Desconectar da Evolution API via WebSocket
        else if (data.type === 'disconnect_evolution') {
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'Não autenticado' }));
            return;
          }
          
          try {
            // Como mudamos para HTTP, usar o método HTTP para desconectar
            const user = await storage.getUser(userId);
            
            if (!user || !user.whatsappApiUrl || !user.whatsappApiToken || !user.whatsappInstanceId) {
              ws.send(JSON.stringify({ 
                type: 'connection_error', 
                error: 'Configuração da Evolution API não encontrada' 
              }));
              return;
            }
            
            console.log(`Desconectando da Evolution API via HTTP para usuário ${userId}`);
            
            // Remover barras extras e garantir que temos o caminho correto incluindo 'manager'
            const baseUrl = user.whatsappApiUrl.replace(/\/+$/, "");
            
            // Verificar se a URL já contém 'manager', senão adicionar
            const managerPath = baseUrl.includes('/manager') ? '' : '/manager';
            // Usar nome do usuário como instância
            const path = `${managerPath}/instances/${user.username}/logout`.replace(/^\/+/, "");
            const fullUrl = `${baseUrl}/${path}`;
            console.log(`Usando nome do usuário (${user.username}) como instância para desconectar`);
            
            console.log(`Desconectando da Evolution API: ${fullUrl}`);
            
            try {
              // Fazer logout da instância
              const response = await axios.post(
                fullUrl,
                {},
                { 
                  headers: { 
                    Authorization: `Bearer ${user.whatsappApiToken}` 
                  }
                }
              );
              
              console.log('Resposta de desconexão:', response.data);
              
              // Fechar qualquer conexão WebSocket ativa
              const socket = evolutionClients.get(userId);
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
                evolutionClients.set(userId, null);
              }
              
              // Notificar cliente sobre desconexão
              ws.send(JSON.stringify({
                type: 'connection_status',
                data: { connected: false, state: 'DISCONNECTED' }
              }));
            } catch (httpError) {
              console.error('Erro ao fazer solicitação HTTP para desconexão:', httpError);
              ws.send(JSON.stringify({
                type: 'connection_error',
                error: `Erro na desconexão: ${httpError.message}`
              }));
            }
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