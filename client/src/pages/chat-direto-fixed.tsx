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

  // Envia mensagem - corrigido conforme teste com curl
  async sendMessage(chatId: string, text: string) {
    console.log(`Enviando mensagem para o chat ${chatId}: "${text}"`);
    
    // CORREÇÃO IMPORTANTE: O parâmetro que estamos recebendo é o ID do chat, 
    // mas precisamos do número de telefone do remoteJid
    
    try {
      // Primeiro precisamos carregar o chat para obter o remoteJid (número de telefone)
      const chatResponse = await this.apiRequest(`/chat/findChats/${this.instanceName}`, 'POST', {});
      console.log("Buscando número correto nos chats disponíveis");
      
      // Procura pelo chat com o ID correspondente
      const chatInfo = Array.isArray(chatResponse) 
        ? chatResponse.find(chat => chat.id === chatId)
        : null;
      
      if (!chatInfo || !chatInfo.remoteJid) {
        throw new Error(`Não foi possível encontrar o número de telefone para o chat ${chatId}`);
      }
      
      // Extrair o número do remoteJid (ex: 554391142751@s.whatsapp.net -> 554391142751)
      const phoneNumber = chatInfo.remoteJid.split('@')[0];
      console.log(`Número de telefone identificado: ${phoneNumber}`);
      
      // Usando exatamente o formato que funcionou no teste com curl:
      // { "number": "554391142751", "text": "mensagem" }
      return await this.apiRequest(`/message/sendText/${this.instanceName}`, 'POST', {
        number: phoneNumber,
        text: text
      });
    } catch (error) {
      console.error("Erro ao processar envio de mensagem:", error);
      throw error;
    }
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
  
  // Configuração de polling para atualização automática de mensagens
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Se tiver um chat selecionado, configura polling
    if (service && selectedChat && connected) {
      // Atualiza as mensagens a cada 5 segundos
      intervalId = setInterval(() => {
        console.log("Atualizando mensagens automaticamente...");
        loadMessages(selectedChat);
      }, 5000);
    }
    
    // Limpeza ao desmontar
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [service, selectedChat, connected]);
  
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
        
        // Se conectado, carrega os chats
        await loadChats();
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
      
      const response = await service.loadChats();
      console.log("Resposta do findChats:", response);
      
      // Usa os dados brutos retornados pela API, sem normalizar
      setChats(response || []);
      
      toast({
        title: "Contatos carregados",
        description: `${(response || []).length} contatos encontrados`,
      });
    } catch (error: any) {
      console.error("Erro ao carregar contatos:", error);
      
      toast({
        title: "Erro ao carregar contatos",
        description: error.message || "Não foi possível carregar a lista de contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Carrega as mensagens de um chat
  const loadMessages = async (chat: any) => {
    if (!service || !chat) return;
    
    setLoading(true);
    setSelectedChat(chat);
    
    try {
      const response = await service.loadMessages(chat.remoteJid);
      console.log("Mensagens carregadas:", response);
      
      // Extrai as mensagens da estrutura de resposta
      if (response && response.messages && response.messages.records) {
        setMessages(response.messages);
      } else {
        // Caso a estrutura seja diferente, tentar adaptar
        if (Array.isArray(response)) {
          setMessages({ records: response, total: response.length });
        } else {
          console.warn("Formato de resposta inesperado:", response);
          setMessages({ records: [], total: 0 });
        }
      }
      
      // Rolagem automática para o final das mensagens
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens:", error);
      
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Não foi possível carregar as mensagens do chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Envia uma mensagem
  const sendMessage = async () => {
    if (!service || !selectedChat || !messageText.trim()) return;
    
    try {
      await service.sendMessage(selectedChat.id, messageText);
      
      // Limpa o campo de mensagem
      setMessageText('');
      
      // Recarrega as mensagens para ver a nova mensagem enviada
      await loadMessages(selectedChat);
      
      toast({
        title: "Mensagem enviada",
        description: "A mensagem foi enviada com sucesso",
      });
      
      // Configura um intervalor para verificar novas mensagens
      setTimeout(() => {
        loadMessages(selectedChat);
      }, 2000);
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };
  
  // Desconecta o WhatsApp
  const disconnect = async () => {
    if (!service) return;
    
    setLoading(true);
    try {
      await service.apiRequest(`/instance/logout/${instanceName}`, 'DELETE');
      
      setConnected(false);
      setChats([]);
      setMessages([]);
      setSelectedChat(null);
      
      toast({
        title: "Desconectado",
        description: "A sessão do WhatsApp foi encerrada",
      });
    } catch (error: any) {
      console.error("Erro ao desconectar:", error);
      
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Não foi possível desconectar a sessão",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Interface do usuário
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 shadow">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold">Chat Evolution API</h1>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => checkConnection()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={disconnect}
            disabled={!connected || loading}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="flex flex-grow overflow-hidden">
        {/* Lista de chats */}
        <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <Button 
              className="w-full" 
              onClick={loadChats}
              disabled={!connected || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Atualizar Contatos'}
            </Button>
          </div>
          
          <div className="flex-grow overflow-y-auto">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="text-slate-500 dark:text-slate-400">
                  {connected 
                    ? 'Nenhum contato encontrado. Clique em "Atualizar Contatos".' 
                    : 'Conecte-se para ver os contatos.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      selectedChat?.id === chat.id ? 'bg-slate-100 dark:bg-slate-800' : ''
                    }`}
                    onClick={() => loadMessages(chat)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                        <span className="text-slate-700 dark:text-slate-300">
                          {chat.pushName?.charAt(0) || '#'}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between">
                          <p className="font-medium truncate">{chat.pushName || 'Sem nome'}</p>
                          <p className="text-xs text-slate-500">
                            {chat.updatedAt 
                              ? new Date(chat.updatedAt).toLocaleDateString() 
                              : ''}
                          </p>
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {chat.remoteJid?.split('@')[0] || 'Sem número'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Área de mensagens */}
        <div className="flex-grow flex flex-col">
          {selectedChat ? (
            <>
              {/* Cabeçalho do chat */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedChat.pushName?.charAt(0) || '#'}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedChat.pushName || 'Sem nome'}</p>
                  <p className="text-xs text-slate-500">{selectedChat.remoteJid?.split('@')[0] || 'Sem número'}</p>
                </div>
              </div>
              
              {/* Mensagens */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {!messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <p className="text-slate-500 dark:text-slate-400">
                      {loading 
                        ? 'Carregando mensagens...' 
                        : 'Nenhuma mensagem encontrada.'}
                    </p>
                  </div>
                ) : (
                  Array.isArray(messages.records || messages) ? 
                  (messages.records || messages).map((msg: any) => (
                    <div
                      key={msg.key?.id || Math.random().toString()}
                      className={`flex ${msg.key?.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.key?.fromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-slate-700 dark:text-white shadow'
                        }`}
                      >
                        <p>{msg.message?.conversation || 'Sem conteúdo'}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {msg.messageTimestamp
                            ? new Date(Number(msg.messageTimestamp) * 1000).toLocaleTimeString()
                            : ''}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <p className="text-slate-500 dark:text-slate-400">
                        Erro ao processar mensagens. Formato desconhecido.
                      </p>
                    </div>
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input de mensagem */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex space-x-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!connected || loading}
                  className="flex-grow"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!connected || loading || !messageText.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                Selecione um contato para iniciar a conversa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}