/**
 * Página de Chat que implementa o acesso direto à Evolution API
 * Baseado no exemplo chatteste2.html que está funcionando
 */

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Send, LogOut } from 'lucide-react';
import axios from 'axios';

// Classe de serviço para comunicação direta com a Evolution API
class DirectEvolutionService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(apiUrl: string, apiKey: string, instanceName: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.instanceName = instanceName;
  }

  // Requisição genérica para a API com log detalhado para diagnóstico
  async apiRequest(endpoint: string, method = 'GET', data?: any) {
    // Normaliza a URL
    const url = `${this.apiUrl}${endpoint}`;
    
    try {
      // Log detalhado dos dados sendo enviados
      if (data) {
        console.log(`Fazendo requisição ${method} para ${url} com dados:`, data);
        console.log("JSON formatado:", JSON.stringify(data, null, 2));
      } else {
        console.log(`Fazendo requisição ${method} para ${url} sem dados`);
      }
      
      // Opções de requisição
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey  // SOMENTE apikey, sem Bearer
        },
        body: data ? JSON.stringify(data) : undefined
      };
      
      // Usa fetch nativo
      const response = await fetch(url, options);
      
      // Obtém o texto da resposta antes de tentar processar como JSON
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Erro HTTP ${response.status} na requisição para ${url}`);
        console.error(`Corpo da resposta de erro: ${responseText}`);
        console.error(`Dados enviados na requisição:`, data);
        
        try {
          // Tenta fazer parse do JSON do erro se possível
          const errorData = responseText ? JSON.parse(responseText) : { message: response.statusText };
          console.error("Resposta de erro processada:", errorData);
          throw new Error(errorData.message || `Erro ${response.status}`);
        } catch (e) {
          // Se não for JSON, usa o texto bruto
          throw new Error(`Erro ${response.status}: ${responseText || response.statusText}`);
        }
      }
      
      // Processa a resposta bem-sucedida
      console.log(`Resposta bem-sucedida de ${url}:`, response.status);
      
      try {
        // Convertemos de volta para JSON, já que já consumimos o texto
        const responseData = responseText ? JSON.parse(responseText) : {};
        console.log("Resposta processada com sucesso:", responseData);
        return responseData;
      } catch (jsonError) {
        console.error("Erro ao processar JSON da resposta:", jsonError);
        console.log("Resposta em texto bruto:", responseText);
        return {}; // Retorna objeto vazio se falhar ao processar JSON
      }
    } catch (error: any) {
      console.error(`Erro completo na requisição ${method} para ${url}:`, error);
      throw error;
    }
  }

  // Verifica estado da conexão - ajustado para formato real da API
  async checkConnection() {
    try {
      console.log(`Verificando status da conexão na instância ${this.instanceName}`);
      
      const response = await this.apiRequest(`/instance/connectionState/${this.instanceName}`);
      console.log("Resposta completa do estado de conexão:", response);
      
      // Formato identificado com curl: {"instance":{"instanceName":"admin","state":"open"}}
      if (response && response.instance) {
        // Novo formato detectado via curl
        if (response.instance.state) {
          const state = response.instance.state.toString().toLowerCase();
          const isConnected = state === 'connected' || state === 'open';
          
          console.log(`Estado real da instância: ${state} (Conectado: ${isConnected})`);
          
          return { 
            connected: isConnected,
            state: state,
            qrCode: response.qrcode || null
          };
        }
      } else if (response) {
        // Verificando formatos alternativos
        if (response.state) {
          const state = response.state.toString().toLowerCase();
          const isConnected = state === 'connected' || state === 'open';
          
          console.log(`Estado direto: ${state} (Conectado: ${isConnected})`);
          
          return { 
            connected: isConnected,
            state: state,
            qrCode: response.qrcode || null
          };
        }
        
        // Verificar se temos status diretamente no objeto
        if (response.status && response.status === 'connected') {
          console.log("Status conectado encontrado diretamente no objeto");
          return { connected: true, state: 'connected', qrCode: null };
        }
        
        // Verificar o campo específico 'connected' 
        if (response.connected === true) {
          console.log("Campo 'connected' é true");
          return { connected: true, state: 'connected', qrCode: null };
        }
      }
      
      console.log("Não foi possível determinar o estado de conexão, considerando como desconectado");
      return { connected: false, state: 'unknown', qrCode: response?.qrcode || null };
    } catch (error) {
      console.error('Erro ao verificar status da conexão:', error);
      return { connected: false, state: 'error', qrCode: null };
    }
  }

  // Carrega lista de contatos/chats - exatamente como no exemplo que funciona
  async loadChats() {
    try {
      // Usa o mesmo endpoint e payload do exemplo HTML
      console.log(`Tentando carregar chats para instância ${this.instanceName}`);
      return await this.apiRequest(`/chat/findChats/${this.instanceName}`, 'POST', {
        // Importante: não passar nenhum parâmetro (where/limit) conforme exemplo
      });
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
      console.log('Tentando encontrar contatos via endpoint alternativo...');
      try {
        // Tenta método alternativo conforme documentação
        return await this.apiRequest(`/chat/findContacts/${this.instanceName}`, 'POST', {});
      } catch (altError) {
        console.error('Erro no endpoint alternativo findContacts:', altError);
        // Último recurso: tenta o endpoint padrão de contatos
        return await this.apiRequest(`/instance/fetchContacts/${this.instanceName}`);
      }
    }
  }

  // Carrega mensagens de um chat específico - exatamente como no exemplo
  async loadMessages(chatId: string) {
    console.log(`Carregando mensagens para ${chatId} (instância: ${this.instanceName})`);
    
    // Usar exatamente o mesmo formato do exemplo que funciona
    return await this.apiRequest(`/chat/findMessages/${this.instanceName}`, 'POST', {
      where: {
        key: {
          remoteJid: chatId
        }
      },
      limit: 50,
      sort: {
        messageTimestamp: 'desc'
      }
    });
  }

  // Envia mensagem - corrigido com o formato exato obtido no teste com curl
  async sendMessage(number: string, text: string) {
    console.log(`Enviando mensagem para ${number}: "${text}"`);
    
    // Trata diferentes formatos de número:
    // - 554391142751@s.whatsapp.net (formato que vem do chat)
    // - 554391142751@c.us (formato alternativo)
    let formattedNumber = number;
    if (number.includes('@s.whatsapp.net')) {
      formattedNumber = number.split('@')[0];
    } else if (number.includes('@c.us')) {
      formattedNumber = number.split('@')[0];
    }
    
    // Usando exatamente o formato que funcionou no teste com curl:
    // { "number": "554391142751", "text": "mensagem" }
    return await this.apiRequest(`/message/sendText/${this.instanceName}`, 'POST', {
      number: formattedNumber,
      text: text
    });
  }
  
  // Normaliza os dados de chats
  normalizeChats(response: any) {
    let chats: any[] = [];
    
    // Extrai chats com base na estrutura da resposta
    if (Array.isArray(response)) {
      chats = response;
    } else if (response?.chats && Array.isArray(response.chats)) {
      chats = response.chats;
    } else if (response?.data && Array.isArray(response.data)) {
      chats = response.data;
    } else if (typeof response === 'object') {
      // Tenta outras estruturas comuns
      if (response.data?.chats && Array.isArray(response.data.chats)) {
        chats = response.data.chats;
      }
    }
    
    return chats.map(chat => {
      const id = chat.id || chat.jid || '';
      const name = chat.name || chat.pushName || id.split('@')[0];
      
      return {
        id,
        name,
        lastMessage: chat.lastMessage?.body || '...',
        timestamp: chat.lastMessageTime || Date.now(),
      };
    });
  }
  
  // Normaliza as mensagens
  normalizeMessages(response: any) {
    let messages: any[] = [];
    
    if (Array.isArray(response)) {
      messages = response;
    } else if (response?.messages && Array.isArray(response.messages)) {
      messages = response.messages;
    } else if (response?.data && Array.isArray(response.data)) {
      messages = response.data;
    }
    
    return messages.map(msg => {
      return {
        id: msg.id || msg.key?.id || '',
        fromMe: msg.fromMe || msg.key?.fromMe || false,
        content: this.extractMessageContent(msg),
        timestamp: msg.timestamp || msg.messageTimestamp || Date.now()
      };
    });
  }
  
  // Extrai o conteúdo da mensagem
  private extractMessageContent(msg: any): string {
    if (typeof msg === 'string') return msg;
    if (msg.text || msg.body) return msg.text || msg.body;
    
    // Extrai de objetos complexos
    if (msg.message) {
      if (typeof msg.message === 'string') return msg.message;
      if (msg.message.conversation) return msg.message.conversation;
      if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
      if (msg.message.imageMessage) return msg.message.imageMessage.caption || '🖼️ Imagem';
      if (msg.message.videoMessage) return msg.message.videoMessage.caption || '🎬 Vídeo';
      if (msg.message.audioMessage) return '🔊 Áudio';
    }
    
    return 'Mensagem não suportada';
  }
}

export default function ChatDireto() {
  const [apiUrl, setApiUrl] = useState('https://api.primerastreadores.com');
  const [apiKey, setApiKey] = useState('4db623449606bcf2814521b73657dbc0');
  const [instanceName, setInstanceName] = useState('admin');
  const [service, setService] = useState<DirectEvolutionService | null>(null);
  
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messageText, setMessageText] = useState('');
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Inicializa o serviço
  useEffect(() => {
    const evolutionService = new DirectEvolutionService(apiUrl, apiKey, instanceName);
    setService(evolutionService);
    
    // Verificar conexão inicial
    checkConnection(evolutionService);
  }, [apiUrl, apiKey, instanceName]);
  
  // Verifica a conexão
  const checkConnection = async (serviceInstance?: DirectEvolutionService) => {
    setLoading(true);
    try {
      const svc = serviceInstance || service;
      if (!svc) return false;
      
      console.log("Iniciando verificação de conexão...");
      const statusInfo = await svc.checkConnection();
      console.log("Resultado da verificação:", statusInfo);
      
      // Atualiza o estado da conexão com base na resposta
      setConnected(statusInfo.connected);
      
      if (statusInfo.connected) {
        toast({
          title: "Conectado",
          description: `Status: ${statusInfo.state}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Desconectado",
          description: `Status: ${statusInfo.state}`,
          variant: "destructive"
        });
        
        // Se houver QR Code, poderia mostrar aqui
        if (statusInfo.qrCode) {
          console.log("QR Code disponível para conexão");
          // Implementar exibição do QR Code se necessário
        }
      }
      
      return statusInfo.connected;
    } catch (error: any) {
      console.error("Erro ao verificar conexão:", error);
      setConnected(false);
      
      toast({
        title: "Erro de conexão",
        description: error.message || "Não foi possível verificar o estado da conexão",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Carrega a lista de chats/contatos
  const loadChats = async () => {
    if (!service) return;
    
    setLoading(true);
    try {
      console.log("Tentando carregar contatos...");
      
      // Tentando abordagem direta primeiro (que funciona no exemplo)
      try {
        // Tenta o endpoint exato do HTML que funciona: /chat/findChats/{instance}
        console.log("Tentando endpoint /chat/findChats...");
        const response = await service.apiRequest(`/chat/findChats/${instanceName}`, 'POST', {});
        console.log("Resposta do findChats:", response);
        
        const normalizedChats = service.normalizeChats(response);
        setChats(normalizedChats);
        
        toast({
          title: "Contatos carregados",
          description: `${normalizedChats.length} contatos encontrados`,
        });
        
        return;
      } catch (findError) {
        console.error("Erro no endpoint findChats:", findError);
        
        try {
          // Tenta endpoint alternativo /instances/{instance}/contacts
          console.log("Tentando endpoint alternativo /instances/*/contacts...");
          const response = await service.apiRequest(`/instances/${instanceName}/contacts`);
          console.log("Resposta do endpoint contatos:", response);
          
          const normalizedChats = service.normalizeChats(response);
          setChats(normalizedChats);
          
          toast({
            title: "Contatos carregados",
            description: `${normalizedChats.length} contatos encontrados`,
          });
          
          return;
        } catch (contactsError) {
          console.error("Erro no endpoint contacts:", contactsError);
          
          // Terceira tentativa com outro caminho
          console.log("Tentando último endpoint alternativo...");
          const response = await service.apiRequest(`/instance/fetchContacts/${instanceName}`);
          console.log("Resposta do fetchContacts:", response);
          
          const normalizedChats = service.normalizeChats(response);
          setChats(normalizedChats);
          
          toast({
            title: "Contatos carregados",
            description: `${normalizedChats.length} contatos encontrados`,
          });
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar contatos (todos os métodos):", error);
      
      toast({
        title: "Erro ao carregar contatos",
        description: error.message || "Não foi possível obter a lista de contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Seleciona um chat para exibir mensagens
  const selectChat = async (chat: any) => {
    if (!service) return;
    
    setSelectedChat(chat);
    setLoading(true);
    
    try {
      const response = await service.loadMessages(chat.id);
      const normalizedMessages = service.normalizeMessages(response);
      
      setMessages(normalizedMessages);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens:", error);
      
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Não foi possível obter as mensagens deste chat",
        variant: "destructive"
      });
      
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Envia uma mensagem
  const sendMessage = async () => {
    if (!service || !selectedChat || !messageText.trim()) return;
    
    try {
      // Obtém o número de telefone do chat selecionado
      const phoneNumber = selectedChat.id.includes('@') 
        ? selectedChat.id.split('@')[0] 
        : selectedChat.id;
      
      // Adiciona a mensagem à UI imediatamente para melhor UX
      const newMessage = {
        id: `temp-${Date.now()}`,
        fromMe: true,
        content: messageText,
        timestamp: Date.now(),
        status: 'sending'
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      
      // Scrolls para a última mensagem
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // Envia mensagem para a API
      await service.sendMessage(phoneNumber, messageText);
      
      // Atualiza status da mensagem
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, status: 'sent' } 
          : msg
      ));
      
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };
  
  // Formata a data/hora
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Renderização da interface
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-medium">Chat Direto WhatsApp</h1>
          <p className="text-sm opacity-90">
            Conexão {connected ? 'estabelecida' : 'desconectada'}
          </p>
          <p className="text-xs opacity-80">
            URL: {apiUrl} | Token: {apiKey.substring(0, 5)}... | Instância: {instanceName}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => checkConnection()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verificar
          </Button>
        </div>
      </div>
      
      {/* Main container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r flex flex-col">
          {/* Search and actions */}
          <div className="p-4 border-b">
            <Input 
              placeholder="Buscar conversa..." 
              className="mb-3"
            />
            
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm"
                className="flex-1"
                onClick={loadChats}
                disabled={loading || !connected}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Atualizar Contatos
              </Button>
            </div>
          </div>
          
          {/* Chats list */}
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="text-center p-4 text-gray-500">
                {loading 
                  ? "Carregando contatos..." 
                  : "Nenhum contato encontrado. Clique em Atualizar Contatos."}
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 flex items-center ${
                    selectedChat?.id === chat.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
                  }`}
                  onClick={() => selectChat(chat)}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-300 text-white flex items-center justify-center mr-3 flex-shrink-0">
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{chat.name}</div>
                    <div className="text-sm text-gray-500 truncate">{chat.lastMessage}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-gray-100">
          {selectedChat ? (
            <>
              {/* Chat header */}
              <div className="p-4 bg-white border-b flex items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-300 text-white flex items-center justify-center mr-3">
                  {selectedChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{selectedChat.name}</div>
                  <div className="text-sm text-gray-500">
                    {connected ? 'Online' : 'Desconectado'}
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    Nenhuma mensagem encontrada nesta conversa.
                  </div>
                ) : (
                  messages.map(message => (
                    <div 
                      key={message.id}
                      className={`flex mb-4 ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.fromMe 
                            ? 'bg-green-100 rounded-tr-none' 
                            : 'bg-white rounded-tl-none'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className="text-xs text-gray-500 text-right mt-1">
                          {formatTime(message.timestamp)}
                          {message.fromMe && (
                            <span className="ml-1">
                              {message.status === 'sending' ? '⌛' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input area */}
              <div className="p-4 bg-white border-t flex items-end gap-2">
                <Textarea
                  placeholder="Digite uma mensagem..."
                  className="flex-1 min-h-10 max-h-32 resize-none"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button 
                  variant="default" 
                  size="icon"
                  disabled={!messageText.trim() || !connected}
                  onClick={sendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="text-lg mb-2">Nenhuma conversa selecionada</div>
              <p className="text-sm">Selecione um contato para começar a conversar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}