/**
 * Serviço para comunicação com a Evolution API
 * Implementação baseada no exemplo chatteste2.html
 */

import axios from 'axios';

// Classe principal para comunicação com a Evolution API
export class EvolutionApiService {
  private apiUrl: string = '';
  private apiToken: string = '';
  private instanceName: string = '';
  
  constructor(apiUrl?: string, apiToken?: string, instanceName?: string) {
    this.apiUrl = apiUrl || '';
    this.apiToken = apiToken || '';
    this.instanceName = instanceName || '';
  }

  // Configurar os parâmetros da API
  public configure(apiUrl: string, apiToken: string, instanceName: string) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
    this.instanceName = instanceName;
  }

  // Verificar se a configuração está completa
  private checkConfig() {
    if (!this.apiUrl || !this.apiToken || !this.instanceName) {
      throw new Error('API não configurada. Configure apiUrl, apiToken e instanceName.');
    }
  }

  // Método genérico para requisições à API Evolution
  public async apiRequest(endpoint: string, method: string = 'GET', data?: any) {
    this.checkConfig();
    
    // Normaliza a URL base
    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    
    // Prepara a URL final da requisição
    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    // Resolve endpoints que podem ser ambíguos
    if (!endpoint.startsWith('/instances/') && 
        !url.includes('/instance/') && 
        !url.includes('/chat/') && 
        !url.includes('/message/')) {
      url = `${baseUrl}/instance/${endpoint}`;
    }
    
    // Log para debug
    console.log(`Requisição ${method} para Evolution API:`, { 
      url, 
      method,
      instanceName: this.instanceName,
      hasToken: !!this.apiToken
    });
    
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        data: method !== 'GET' ? data : undefined,
        params: method === 'GET' ? data : undefined
      });
      
      console.log(`Resposta recebida da Evolution API (${url}):`, {
        status: response.status,
        dataType: typeof response.data,
        hasData: !!response.data
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`Erro na requisição ${method} para ${url}:`, error);
      
      // Tenta extrair detalhes do erro da resposta
      if (error.response) {
        console.log('Detalhes do erro da API:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          throw new Error(`Erro de autenticação: O token fornecido não é válido para a Evolution API. Verifique as configurações do servidor.`);
        }
        
        throw new Error(`Erro ${error.response.status}: ${error.response.data?.message || error.response.statusText}`);
      }
      
      throw new Error(error.message || 'Erro desconhecido na API');
    }
  }

  // Verificar o estado da conexão
  public async checkConnectionState() {
    try {
      console.log("Tentando verificar conexão com:", {
        apiUrl: this.apiUrl,
        token: this.apiToken ? this.apiToken.substring(0, 5) + "..." : "não configurado", 
        instance: this.instanceName
      });
      
      // Tenta vários endpoints diferentes para garantir compatibilidade
      let response;
      try {
        // Primeiro tenta o endpoint padrão
        response = await this.apiRequest(`/instance/connectionState/${this.instanceName}`);
      } catch (err) {
        try {
          // Se falhar, tenta endpoint alternativo
          response = await this.apiRequest(`/instance/connect/${this.instanceName}`);
        } catch (err2) {
          // Último recurso: verifica informações da instância
          response = await this.apiRequest(`/instance/info/${this.instanceName}`);
        }
      }
      
      // Possíveis estados: connected, connecting, disconnected, error
      const state = response?.state || response?.data?.state || response?.status || 'unknown';
      const connected = state === 'open' || state === 'connected';
      
      return {
        connected,
        state,
        data: response
      };
    } catch (error: any) {
      console.error('Erro ao verificar estado da conexão:', error);
      return {
        connected: false,
        state: 'error',
        error: error.message
      };
    }
  }

  // Carregar lista de chats/contatos
  public async loadChats() {
    try {
      console.log("Tentando carregar contatos para instância:", this.instanceName);
      
      // Primeiro tenta o endpoint padrão
      try {
        const response = await this.apiRequest(`/chat/findChats/${this.instanceName}`, 'POST', {
          // Parâmetros adicionais como paginação ou filtros podem ser adicionados aqui
          // where: {},
          // limit: 100
        });
        
        return this.normalizeChatsResponse(response);
      } catch (err) {
        // Se falhar, tenta endpoint alternativo (instances/admin/contacts)
        console.log("Tentando endpoint alternativo para contatos");
        
        const alternativeEndpoint = `/instances/${this.instanceName}/contacts`;
        const response = await this.apiRequest(alternativeEndpoint, 'GET');
        
        return this.normalizeChatsResponse(response);
      }
    } catch (error: any) {
      console.error('Erro ao carregar chats:', error);
      throw error;
    }
  }

  // Carregar mensagens de um chat específico
  public async loadMessages(chatId: string) {
    try {
      const response = await this.apiRequest(`/chat/findMessages/${this.instanceName}`, 'POST', {
        jid: chatId,
        limit: 50 // Ajuste conforme necessário
      });
      
      return this.normalizeMessagesResponse(response);
    } catch (error) {
      console.error(`Erro ao carregar mensagens para ${chatId}:`, error);
      throw error;
    }
  }

  // Enviar mensagem
  public async sendMessage(to: string, message: string) {
    try {
      const response = await this.apiRequest(`/message/sendText/${this.instanceName}`, 'POST', {
        number: to,
        text: message
      });
      
      return response;
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${to}:`, error);
      throw error;
    }
  }

  // Normalizar resposta de chats para formato padrão
  private normalizeChatsResponse(apiResponse: any) {
    // Array final de chats normalizados
    let chatsArray: any[] = [];
    
    // Tenta extrair a lista de chats dependendo da estrutura da resposta
    if (Array.isArray(apiResponse)) {
      chatsArray = apiResponse;
    } else if (apiResponse && Array.isArray(apiResponse.chats)) {
      chatsArray = apiResponse.chats;
    } else if (apiResponse && Array.isArray(apiResponse.data)) {
      chatsArray = apiResponse.data;
    } else if (apiResponse && Array.isArray(apiResponse.result)) {
      chatsArray = apiResponse.result;
    } else if (apiResponse && typeof apiResponse === 'object') {
      // Tenta extrair de padrões comuns
      if (apiResponse.data && Array.isArray(apiResponse.data.chats)) {
        chatsArray = apiResponse.data.chats;
      } else {
        // Fallback: trata valores do objeto como potenciais chats se tiverem ID
        chatsArray = Object.values(apiResponse).filter(item => 
          item && (item.id || item.jid || item.remoteJid));
      }
    }
    
    // Normaliza os objetos de chat para um formato consistente
    return chatsArray.map(chat => {
      const chatId = chat.id || chat.jid || chat.remoteJid;
      const name = chat.name || chat.pushName || chat.subject || (chatId ? chatId.split('@')[0] : 'Desconhecido');
      const timestamp = chat.t || chat.timestamp || chat.lastMessageTimestamp || Date.now();
      
      // Determina o texto da última mensagem
      let lastMessage = 'Nenhuma mensagem';
      if (chat.lastMessage) {
        lastMessage = this.getMessagePreview(chat.lastMessage);
      } else if (chat.messages && chat.messages.length > 0) {
        lastMessage = this.getMessagePreview(chat.messages[chat.messages.length - 1]);
      }
      
      return {
        id: chatId,
        name,
        pushName: chat.pushName || name,
        phone: chatId,
        lastMessage,
        lastMessageTime: this.formatTime(timestamp),
        timestamp,
        unreadCount: chat.unreadCount || 0,
        originalData: chat // Mantém os dados originais caso precisemos deles
      };
    }).sort((a, b) => b.timestamp - a.timestamp); // Ordena por data (mais recente primeiro)
  }

  // Normalizar resposta de mensagens
  private normalizeMessagesResponse(apiResponse: any) {
    let messagesArray: any[] = [];
    
    // Extrai a lista de mensagens dependendo da estrutura da resposta
    if (Array.isArray(apiResponse)) {
      messagesArray = apiResponse;
    } else if (apiResponse && Array.isArray(apiResponse.messages)) {
      messagesArray = apiResponse.messages;
    } else if (apiResponse && Array.isArray(apiResponse.data)) {
      messagesArray = apiResponse.data;
    } else if (apiResponse && typeof apiResponse === 'object') {
      if (apiResponse.data && Array.isArray(apiResponse.data.messages)) {
        messagesArray = apiResponse.data.messages;
      }
    }
    
    // Normaliza as mensagens para um formato consistente
    return messagesArray.map(msg => {
      // Define valores padrão para campos fundamentais
      const messageId = msg.id || msg.key?.id || 'unknown';
      const fromMe = msg.fromMe || msg.key?.fromMe || false;
      
      // Extrai o conteúdo da mensagem
      let content = '';
      if (typeof msg === 'string') {
        content = msg;
      } else if (msg.text || msg.body || msg.content) {
        content = msg.text || msg.body || msg.content;
      } else if (msg.message) {
        if (typeof msg.message === 'string') {
          content = msg.message;
        } else {
          // Extrai conteúdo de diferentes tipos de mensagem
          if (msg.message.conversation) content = msg.message.conversation;
          else if (msg.message.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
          else if (msg.message.imageMessage) content = msg.message.imageMessage.caption || '🖼️ Imagem';
          else if (msg.message.videoMessage) content = msg.message.videoMessage.caption || '🎬 Vídeo';
          else if (msg.message.audioMessage) content = '🔊 Áudio';
          else if (msg.message.documentMessage) content = msg.message.documentMessage.caption || '📄 Documento';
          else if (msg.message.stickerMessage) content = '😊 Sticker';
          else if (msg.message.locationMessage) content = '📍 Localização';
          else if (msg.message.contactMessage) content = `👤 ${msg.message.contactMessage.displayName || 'Contato'}`;
          else content = 'Mensagem não suportada';
        }
      }
      
      // Normaliza timestamp
      let timestamp = msg.timestamp || msg.messageTimestamp || msg.t || Date.now();
      // Converte para milissegundos se necessário
      if (timestamp < 1e12) timestamp *= 1000;
      
      return {
        id: messageId,
        content,
        timestamp: new Date(timestamp).toISOString(),
        fromMe,
        status: msg.status || (fromMe ? 'sent' : 'received')
      };
    }).sort((a, b) => {
      // Ordena por data (mais antiga primeiro)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  // Obter preview legível de uma mensagem
  private getMessagePreview(message: any): string {
    if (!message) return '...';
    if (typeof message === 'string') return message;
    
    // Trata objetos de mensagem complexos
    if (message.message) {
      if (message.message.conversation) return message.message.conversation;
      if (message.message.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
      if (message.message.imageMessage) return `🖼️ ${message.message.imageMessage.caption || 'Imagem'}`;
      if (message.message.videoMessage) return `🎬 ${message.message.videoMessage.caption || 'Vídeo'}`;
      if (message.message.audioMessage) return '🔊 Áudio';
      if (message.message.documentMessage) return `📄 ${message.message.documentMessage.caption || 'Documento'}`;
      if (message.message.stickerMessage) return '😊 Sticker';
      if (message.message.locationMessage) return '📍 Localização';
      if (message.message.contactMessage) return `👤 ${message.message.contactMessage.displayName || 'Contato'}`;
    }
    
    if (message.text) return message.text;
    if (message.body) return message.body;
    if (message.content) return message.content;
    if (message.type) return `(${message.type})`;
    
    return '...';
  }

  // Formatar timestamp para exibição amigável
  private formatTime(timestamp: number): string {
    if (!timestamp) return '';
    
    // Garantir que o timestamp esteja em milissegundos
    const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const date = new Date(timestampMs);
    const now = new Date();
    
    // Verifica se é hoje ou ontem
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  }
}

// Exporta uma instância padrão do serviço
export default new EvolutionApiService();