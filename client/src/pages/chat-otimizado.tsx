/**
 * Versão otimizada da página de Chat com seletor de números Meta API
 * Implementa busca automática e seleção visual dos números disponíveis
 */

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  RefreshCw, 
  MessageSquare,
  Send,
  Phone,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Schema para validação do formulário de envio
const sendFormSchema = z.object({
  text: z.string().min(1, 'Digite uma mensagem'),
});

type SendFormValues = z.infer<typeof sendFormSchema>;

// Serviço direto para Evolution API
class DirectEvolutionService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(apiUrl: string, apiKey: string, instanceName: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.instanceName = instanceName;
  }

  async apiRequest(endpoint: string, method = 'GET', data?: any) {
    try {
      const url = `${this.apiUrl}${endpoint}`;
      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
      };

      if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Evolution API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async checkConnection() {
    try {
      const response = await this.apiRequest(`/instance/connectionState/${this.instanceName}`);
      return {
        connected: response?.instance?.state === 'open',
        state: response?.instance?.state || 'unknown',
        instance: this.instanceName
      };
    } catch (error) {
      return {
        connected: false,
        state: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        instance: this.instanceName
      };
    }
  }

  async loadChats() {
    try {
      const response = await this.apiRequest(`/chat/findChats/${this.instanceName}`);
      return this.normalizeChats(response);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
      return [];
    }
  }

  async loadMessages(chatId: string, afterTimestamp?: number) {
    try {
      const cleanChatId = chatId.replace('@c.us', '').replace('@g.us', '');
      const endpoint = `/chat/findMessages/${this.instanceName}`;
      const params = new URLSearchParams({
        where: JSON.stringify({
          key: {
            remoteJid: chatId
          }
        })
      });

      if (afterTimestamp) {
        params.append('afterTimestamp', afterTimestamp.toString());
      }

      const response = await this.apiRequest(`${endpoint}?${params}`);
      return this.normalizeMessages(response);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return [];
    }
  }

  async sendMessage(chatId: string, text: string) {
    try {
      const cleanChatId = chatId.replace('@c.us', '').replace('@g.us', '');
      const response = await this.apiRequest(`/message/sendText/${this.instanceName}`, 'POST', {
        number: cleanChatId,
        text: text
      });
      return response;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  normalizeChats(response: any) {
    if (!response || !Array.isArray(response)) return [];
    
    return response.map((chat: any) => ({
      id: chat.id || chat.remoteJid,
      remoteJid: chat.id || chat.remoteJid,
      name: chat.name || chat.pushName || this.formatPhoneNumber(chat.id || chat.remoteJid),
      lastMessage: chat.lastMessage?.message || chat.lastMessage,
      lastMessageTimestamp: chat.lastMessage?.messageTimestamp || chat.lastMessageTimestamp || Date.now(),
      unreadCount: chat.unreadCount || 0,
      isGroup: (chat.id || chat.remoteJid || '').includes('@g.us'),
      profilePictureUrl: chat.profilePictureUrl
    }));
  }

  normalizeMessages(response: any) {
    if (!response || !Array.isArray(response)) return [];
    
    return response.map((msg: any) => ({
      id: msg.key?.id || msg.id,
      key: msg.key,
      content: this.extractMessageContent(msg),
      timestamp: msg.messageTimestamp || msg.timestamp || Date.now(),
      fromMe: msg.key?.fromMe || msg.fromMe || false,
      status: msg.status || 'sent',
      remoteJid: msg.key?.remoteJid || msg.remoteJid,
      pushName: msg.pushName || '',
      messageType: msg.messageType || 'text'
    }));
  }

  private extractMessageContent(msg: any): string {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message?.imageMessage?.caption) return `[Imagem] ${msg.message.imageMessage.caption}`;
    if (msg.message?.videoMessage?.caption) return `[Vídeo] ${msg.message.videoMessage.caption}`;
    if (msg.message?.documentMessage) return `[Documento] ${msg.message.documentMessage.title || 'Arquivo'}`;
    if (msg.message?.audioMessage) return '[Áudio]';
    if (msg.message?.stickerMessage) return '[Figurinha]';
    if (msg.content) return msg.content;
    return '[Mensagem não suportada]';
  }

  private formatPhoneNumber(jid: string): string {
    const number = jid.replace('@c.us', '').replace('@g.us', '');
    if (number.startsWith('55')) {
      const cleaned = number.substring(2);
      if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
      }
    }
    return number;
  }
}

export default function ChatOtimizado() {
  // Estados para Evolution API
  const [service, setService] = useState<DirectEvolutionService | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [connectionType, setConnectionType] = useState<'qr' | 'meta' | 'both'>('qr');
  
  // Estados para Meta API
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<any[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [fetchingNumbers, setFetchingNumbers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      text: ''
    }
  });

  // Configuração da Evolution API
  const EVOLUTION_API_URL = 'https://api.primerastreadores.com';
  const EVOLUTION_API_KEY = '4db623449606bcf2814521b73657dbc0';
  const INSTANCE_NAME = 'admin';

  useEffect(() => {
    const evolutionService = new DirectEvolutionService(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      INSTANCE_NAME
    );
    setService(evolutionService);
    checkConnection(evolutionService);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const checkConnection = async (serviceInstance?: DirectEvolutionService) => {
    const currentService = serviceInstance || service;
    if (!currentService) return;

    setLoading(true);
    try {
      const result = await currentService.checkConnection();
      setConnected(result.connected);
      
      if (result.connected) {
        await loadChats(currentService);
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async (serviceInstance?: DirectEvolutionService) => {
    const currentService = serviceInstance || service;
    if (!currentService) return;

    try {
      const chatsData = await currentService.loadChats();
      setChats(chatsData);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
    }
  };

  const loadMessages = async (chat: any) => {
    if (!service || !chat) return;

    setSelectedChat(chat);
    setLoading(true);
    
    try {
      const messagesData = await service.loadMessages(chat.remoteJid || chat.id);
      setMessages(messagesData);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: SendFormValues) => {
    if (!service || !selectedChat) return;

    try {
      if (connectionType === 'meta') {
        // Enviar via Meta API
        const response = await fetch('/api/whatsapp/send-message-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumberId: selectedPhoneNumberId,
            to: selectedChat.remoteJid?.replace('@c.us', ''),
            message: values.text
          })
        });

        if (!response.ok) {
          throw new Error('Erro ao enviar mensagem via Meta API');
        }
      } else {
        // Enviar via Evolution API
        await service.sendMessage(selectedChat.remoteJid || selectedChat.id, values.text);
      }

      form.reset();
      // Recarregar mensagens
      await loadMessages(selectedChat);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const getChatName = (chat: any) => {
    if (!chat) return '';
    return chat.name || chat.pushName || formatPhoneNumber(chat.remoteJid || chat.id);
  };

  const formatPhoneNumber = (jid: string) => {
    if (!jid) return '';
    const number = jid.replace('@c.us', '').replace('@g.us', '');
    if (number.startsWith('55') && number.length >= 11) {
      const cleaned = number.substring(2);
      if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
      }
    }
    return number;
  };

  const formatMessageDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageContent = (msg: any) => {
    if (typeof msg === 'string') return msg;
    return msg?.content || msg?.text || '[Mensagem não suportada]';
  };

  const getMessageBubbleClass = (msg: any) => {
    const isFromMe = msg.fromMe;
    return `${isFromMe 
      ? 'bg-green-500 text-white ml-auto rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl' 
      : 'bg-white dark:bg-gray-800 border mr-auto rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl'
    }`;
  };

  // Funções para Meta API
  const fetchAvailableNumbers = async () => {
    setFetchingNumbers(true);
    try {
      const response = await fetch('/api/whatsapp/meta/phone-numbers');
      if (response.ok) {
        const data = await response.json();
        setAvailablePhoneNumbers(data.phoneNumbers || []);
      }
    } catch (error) {
      console.error('Erro ao buscar números:', error);
    } finally {
      setFetchingNumbers(false);
    }
  };

  const connectToMeta = async () => {
    if (!selectedPhoneNumberId) return;
    
    setMetaLoading(true);
    try {
      const response = await fetch('/api/whatsapp/meta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: selectedPhoneNumberId })
      });

      if (response.ok) {
        setMetaConnected(true);
      }
    } catch (error) {
      console.error('Erro ao conectar Meta API:', error);
    } finally {
      setMetaLoading(false);
    }
  };

  const getSelectedPhoneNumber = () => {
    return availablePhoneNumbers.find(phone => phone.id === selectedPhoneNumberId);
  };

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Sidebar - Lista de Chats */}
      <div className="w-1/3 bg-white dark:bg-gray-800 border-r flex flex-col">
        {/* Cabeçalho da sidebar */}
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Chat WhatsApp
            </h1>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => checkConnection()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {/* Seletor de Conexão */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Conexão WhatsApp</Label>
            <Select value={connectionType} onValueChange={(value: 'qr' | 'meta' | 'both') => setConnectionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qr">QR Code (Evolution API)</SelectItem>
                <SelectItem value="meta">Cloud API (Meta)</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>

            {/* Painel Meta API */}
            {(connectionType === 'meta' || connectionType === 'both') && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    WhatsApp Cloud API
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!metaConnected ? (
                    <>
                      <Button 
                        onClick={fetchAvailableNumbers}
                        disabled={fetchingNumbers}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        {fetchingNumbers ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Buscando...
                          </>
                        ) : (
                          'Buscar Números'
                        )}
                      </Button>

                      {availablePhoneNumbers.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">Selecionar Número:</Label>
                          <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Escolha um número" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePhoneNumbers.map((phone: any) => (
                                <SelectItem key={phone.id} value={phone.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{phone.display_phone_number}</span>
                                    {phone.verified_name && (
                                      <Badge variant="secondary" className="text-xs">
                                        {phone.verified_name}
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button 
                            onClick={connectToMeta}
                            disabled={!selectedPhoneNumberId || metaLoading}
                            size="sm"
                            className="w-full"
                          >
                            {metaLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Conectando...
                              </>
                            ) : (
                              'Conectar'
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">Conectado</p>
                        {getSelectedPhoneNumber() && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-mono">
                            📱 {getSelectedPhoneNumber().display_phone_number}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Status da Conexão Evolution */}
            {(connectionType === 'qr' || connectionType === 'both') && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                {connected ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">
                  Evolution: {connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {loading ? 'Carregando contatos...' : 'Nenhum chat encontrado'}
            </div>
          ) : (
            <div className="divide-y">
              {chats.map((chat) => (
                <div
                  key={chat.id || chat.remoteJid}
                  className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3 ${
                    selectedChat && (selectedChat.id === chat.id || selectedChat.remoteJid === chat.remoteJid)
                      ? 'bg-gray-200 dark:bg-gray-700'
                      : ''
                  }`}
                  onClick={() => loadMessages(chat)}
                >
                  <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-lg font-semibold">
                    {getChatName(chat).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="font-medium truncate">{getChatName(chat)}</span>
                      {chat.lastMessageTimestamp && (
                        <span className="text-xs text-gray-500">
                          {formatMessageDate(chat.lastMessageTimestamp)}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">
                        {getMessageContent(chat.lastMessage)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Área principal - mensagens */}
      <div className="flex-1 flex flex-col">
        {/* Cabeçalho do chat */}
        {selectedChat ? (
          <>
            <div className="p-4 border-b bg-gray-100 dark:bg-gray-900 flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-lg font-semibold">
                {getChatName(selectedChat).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold">{getChatName(selectedChat)}</h2>
                <p className="text-xs text-gray-500">
                  {connected ? 'Online' : 'Desconectado'}
                </p>
              </div>
            </div>
            
            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950">
              {loading && messages.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                  Nenhuma mensagem encontrada
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div key={msg.id || msg.key?.id || index} className="flex flex-col">
                      <div 
                        className={`${getMessageBubbleClass(msg)} p-3 max-w-[70%] shadow-sm`}
                      >
                        {!msg.fromMe && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {msg.pushName || formatPhoneNumber(msg.remoteJid)}
                          </p>
                        )}
                        <p className="text-sm">{getMessageContent(msg)}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatMessageDate(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Formulário de envio */}
            <div className="p-4 border-t bg-white dark:bg-gray-800">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex space-x-2">
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Digite sua mensagem..."
                            disabled={!connected && !metaConnected}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    disabled={!connected && !metaConnected}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
            <div className="text-center text-gray-500">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Selecione um chat para começar</p>
              <p className="text-sm">
                {!connected && !metaConnected ? (
                  <Button 
                    onClick={() => checkConnection()}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Conectando...
                      </>
                    ) : (
                      'Conectar WhatsApp'
                    )}
                  </Button>
                ) : (
                  `${loading || (!connected && chats.length === 0) ? 'Carregando chats...' : 'Escolha um contato na lista'}`
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}