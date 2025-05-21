/**
 * Versão otimizada da página de Chat que implementa o acesso direto à Evolution API
 * Com melhorias para gerenciamento eficiente de mensagens e evitar recarregamentos completos
 */
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Schema para o formulário de mensagem
const sendFormSchema = z.object({
  text: z.string().min(1, "Digite uma mensagem")
});

type SendFormValues = z.infer<typeof sendFormSchema>;

// Classe de serviço que encapsula as chamadas à Evolution API
class DirectEvolutionService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(apiUrl: string, apiKey: string, instanceName: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.instanceName = instanceName;
    console.log(`Serviço inicializado com instância: ${instanceName}`);
  }

  // Método central para realizar requisições à API
  async apiRequest(endpoint: string, method = 'GET', data?: any) {
    // Garantir que a URL está formatada corretamente
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.apiUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Usar o formato correto de apikey no cabeçalho
      'apikey': this.apiKey
    };
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });
      
      if (!response.ok) {
        // Tentar extrair mensagem de erro da resposta
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || 
          errorData?.error?.message || 
          `Erro ${response.status}: ${response.statusText}`
        );
      }
      
      // Tentar retornar os dados como JSON, ou undefined se vazio
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : undefined;
    } catch (error: any) {
      console.error(`Erro na requisição ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  // Verifica o status da conexão com WhatsApp
  async checkConnection() {
    try {
      // Obter status da instância
      const instanceInfo = await this.apiRequest(`/instance/connectionState/${this.instanceName}`);
      console.log("Status da conexão:", instanceInfo);
      
      // Analisar a resposta para determinar o estado
      const state = typeof instanceInfo.state === 'string' 
        ? instanceInfo.state.toLowerCase() 
        : 'unknown';
      
      // Verificar se está conectado com base no estado
      const connected = state === 'open' || state === 'connected';
      
      // Se não estiver conectado, verificar se há QR code disponível
      let qrCode = null;
      if (!connected) {
        try {
          const qrResponse = await this.apiRequest(`/instance/qrcode/${this.instanceName}`);
          qrCode = qrResponse?.qrcode || null;
        } catch (qrError) {
          console.warn("QR Code não disponível:", qrError);
        }
      }
      
      // Retornar informações de conexão
      return {
        connected,
        state,
        qrCode,
        instance: this.instanceName
      };
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
      return {
        connected: false,
        state: 'error',
        error: error instanceof Error ? error.message : String(error),
        instance: this.instanceName
      };
    }
  }

  // Carrega a lista de chats (contatos e grupos)
  async loadChats() {
    try {
      console.log(`Carregando chats para ${this.instanceName}`);
      
      // Fazer a requisição para obter os chats
      // Nota: a API pode ter diferentes endpoints dependendo da versão
      // Tentando o endpoint mais comum primeiro
      const chats = await this.apiRequest(`/chat/findChats/${this.instanceName}`);
      return this.normalizeChats(chats);
    } catch (error) {
      console.error("Erro ao carregar chats:", error);
      // Em caso de erro, retornar array vazio
      return [];
    }
  }

  // Carrega mensagens de um chat específico - exatamente como no exemplo
  async loadMessages(chatId: string, afterTimestamp?: number) {
    console.log(`Carregando mensagens para ${chatId} (instância: ${this.instanceName})`);
    
    // Criar um objeto de consulta com filtro opcional de timestamp
    const query: any = {
      where: {
        key: {
          remoteJid: chatId
        }
      },
      limit: 50,
      sort: {
        messageTimestamp: -1
      }
    };
    
    // Se temos um timestamp, adicionar à consulta para buscar apenas mensagens mais recentes
    if (afterTimestamp) {
      query.where.messageTimestamp = { gt: afterTimestamp };
    }
    
    // Fazer a requisição para obter as mensagens
    return await this.apiRequest(`/chat/findMessages/${this.instanceName}`, 'POST', query);
  }

  // Envia uma mensagem para um chat
  async sendMessage(chatId: string, text: string) {
    try {
      console.log(`Enviando mensagem para ${chatId}`);
      
      // Requisição para enviar a mensagem
      const result = await this.apiRequest(
        `/message/sendText/${this.instanceName}`,
        'POST',
        {
          number: chatId,
          options: {
            delay: 1200,
            presence: 'composing'
          },
          textMessage: {
            text
          }
        }
      );
      
      console.log("Mensagem enviada:", result);
      return result;
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      throw error;
    }
  }

  // Normaliza a resposta dos chats para um formato consistente
  normalizeChats(response: any) {
    if (!response) return [];
    
    try {
      let chats = [];
      
      // Se a resposta já for um array, usá-la diretamente
      if (Array.isArray(response)) {
        chats = response;
      } 
      // Se for um objeto com uma propriedade 'chats' que é um array
      else if (response.chats && Array.isArray(response.chats)) {
        chats = response.chats;
      }
      // Se for outro formato que contém um array 'records'
      else if (response.records && Array.isArray(response.records)) {
        chats = response.records;
      }
      
      // Ordena por data da última mensagem (mais recente primeiro)
      return chats.sort((a: any, b: any) => {
        const timeA = a.lastMessageTimestamp || 0;
        const timeB = b.lastMessageTimestamp || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Erro ao normalizar chats:", error);
      return [];
    }
  }

  // Normaliza a resposta das mensagens para um formato consistente
  normalizeMessages(response: any) {
    if (!response) return [];
    
    try {
      let messages = [];
      
      // Se a resposta já for um array, usá-la diretamente
      if (Array.isArray(response)) {
        messages = response;
      } 
      // Se for um objeto com uma propriedade que é um array
      else if (response.messages && response.messages.records) {
        messages = response.messages.records;
      }
      // Se for outro formato que contém um array 'records'
      else if (response.records && Array.isArray(response.records)) {
        messages = response.records;
      }
      
      // Ordenar por timestamp (mais antigas primeiro)
      return messages.sort((a: any, b: any) => {
        const timeA = Number(a.messageTimestamp) || 0;
        const timeB = Number(b.messageTimestamp) || 0;
        return timeA - timeB;
      });
    } catch (error) {
      console.error("Erro ao normalizar mensagens:", error);
      return [];
    }
  }

  // Extrai o conteúdo da mensagem a partir de diferentes formatos
  private extractMessageContent(msg: any): string {
    try {
      // Diferentes formatos possíveis da mensagem
      if (msg.message?.conversation) {
        return msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        return msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        return `[Imagem] ${msg.message.imageMessage.caption}`;
      } else if (msg.message?.videoMessage?.caption) {
        return `[Vídeo] ${msg.message.videoMessage.caption}`;
      } else if (msg.message?.documentMessage?.fileName) {
        return `[Documento] ${msg.message.documentMessage.fileName}`;
      } else if (msg.message?.audioMessage) {
        return `[Áudio]`;
      } else if (msg.message?.stickerMessage) {
        return `[Sticker]`;
      } else if (msg.message?.locationMessage) {
        return `[Localização]`;
      } else if (msg.message?.contactMessage) {
        return `[Contato]`;
      } else if (msg.body) {
        // Formato alternativo que pode vir da API
        return msg.body;
      } else if (msg.content) {
        // Outro formato alternativo
        return msg.content;
      }
      
      // Caso nenhum formato conhecido seja encontrado
      return '[Mensagem não suportada]';
    } catch (error) {
      console.error("Erro ao extrair conteúdo da mensagem:", error, msg);
      return '[Erro ao processar mensagem]';
    }
  }
}

export default function ChatOtimizado() {
  // Estado para armazenar dados da API
  const [apiUrl, setApiUrl] = useState('https://api.primerastreadores.com');
  const [apiKey, setApiKey] = useState('4db623449606bcf2814521b73657dbc0');
  const [instanceName, setInstanceName] = useState('admin');
  
  // Referência para o serviço
  const [service, setService] = useState<DirectEvolutionService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estado da UI
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, any[]>>({});
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<Record<string, number>>({});
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  
  const { toast } = useToast();
  
  // Inicializa o formulário para envio de mensagens
  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      text: ''
    }
  });
  
  // Inicializa o serviço quando o componente é montado
  useEffect(() => {
    console.log("Inicializando serviço com:", { apiUrl, apiKey, instanceName });
    
    // Criar instância do serviço
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
        loadMessages(selectedChat, false);
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
      toast({
        title: "Erro de conexão",
        description: error.message || "Não foi possível verificar o status da conexão",
        variant: "destructive"
      });
      setConnected(false);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Carrega a lista de chats
  const loadChats = async () => {
    if (!service) {
      console.log("Serviço não inicializado");
      return;
    }
    
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
  const loadMessages = async (chat: any, isInitialLoad = true) => {
    if (!service || !chat) return;
    
    const chatId = chat.remoteJid || chat.id;
    
    // Só mostra loading na carga inicial
    if (isInitialLoad) {
      setLoading(true);
      setSelectedChat(chat);
    }
    
    // Usar mensagens já carregadas se existirem
    const existingMessages = messagesByChatId[chatId] || [];
    
    // Determinar o timestamp da mensagem mais recente
    const lastTimestamp = !isInitialLoad && existingMessages.length > 0
      ? lastMessageTimestamp[chatId] || 0
      : 0;
    
    try {
      console.log(`Carregando mensagens para ${chatId} ${lastTimestamp ? '(apenas novas)' : '(todas)'}`);
      
      // Buscar mensagens (com parâmetro opcional para apenas novas)
      const response = await service.loadMessages(chatId, lastTimestamp > 0 ? lastTimestamp : undefined);
      console.log("Mensagens carregadas:", response);
      
      // Processamento das mensagens recebidas para formato consistente
      const messageList = service.normalizeMessages(response);
      
      // Encontrar o timestamp mais recente para a próxima busca
      let maxTimestamp = lastTimestamp;
      messageList.forEach((msg: any) => {
        const msgTs = Number(msg.messageTimestamp) || 0;
        if (msgTs > maxTimestamp) {
          maxTimestamp = msgTs;
        }
      });
      
      // Atualizar o lastTimestamp apenas se encontrou mensagens mais recentes
      if (maxTimestamp > lastTimestamp) {
        setLastMessageTimestamp(prev => ({
          ...prev,
          [chatId]: maxTimestamp
        }));
      }
      
      console.log(`Processadas ${messageList.length} mensagens.`);
      
      // Se for uma atualização (não inicial) e já temos mensagens existentes
      if (!isInitialLoad && existingMessages.length > 0) {
        // Obter IDs de mensagens existentes para evitar duplicatas
        const existingIds = new Set();
        existingMessages.forEach(msg => {
          const msgId = msg.id || (msg.key && msg.key.id);
          if (msgId) existingIds.add(msgId);
        });
        
        // Filtrar apenas mensagens novas
        const newMessages = messageList.filter((msg: any) => {
          const msgId = msg.id || (msg.key && msg.key.id);
          return msgId && !existingIds.has(msgId);
        });
        
        console.log(`Encontradas ${newMessages.length} novas mensagens`);
        
        if (newMessages.length > 0) {
          // Combinar mensagens existentes com novas e ordenar
          const combinedMessages = [...existingMessages, ...newMessages];
          combinedMessages.sort((a, b) => {
            const tsA = Number(a.messageTimestamp) || 0;
            const tsB = Number(b.messageTimestamp) || 0;
            return tsA - tsB;
          });
          
          // Atualizar o cache de mensagens
          setMessagesByChatId(prev => ({
            ...prev,
            [chatId]: combinedMessages
          }));
          
          // Atualizar mensagens visíveis
          setMessages(combinedMessages);
          
          // Rolagem automática para o final das mensagens
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        // Carga inicial: ordenar e salvar todas as mensagens
        console.log(`Carregadas ${messageList.length} mensagens iniciais`);
        
        // Atualizar o cache de mensagens
        setMessagesByChatId(prev => ({
          ...prev,
          [chatId]: messageList
        }));
        
        // Atualizar mensagens visíveis
        setMessages(messageList);
        
        // Rolagem automática para o final das mensagens
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (error: any) {
      console.error("Erro ao carregar mensagens:", error);
      
      // Mostrar toast apenas na primeira carga
      if (isInitialLoad) {
        toast({
          title: "Erro ao carregar mensagens",
          description: error.message || "Não foi possível carregar as mensagens",
          variant: "destructive"
        });
        
        setMessages([]);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };
  
  // Envia uma mensagem
  const onSubmit = async (values: SendFormValues) => {
    if (!service || !selectedChat) return;
    
    try {
      const chatId = selectedChat.remoteJid || selectedChat.id;
      console.log(`Enviando mensagem para ${chatId}: "${values.text}"`);
      
      // Chama o método do serviço para enviar a mensagem
      await service.sendMessage(chatId, values.text);
      
      // Limpa o formulário
      form.reset();
      
      // Recarrega as mensagens depois de enviar
      await loadMessages(selectedChat, false);
      
      // Após enviar, foca no campo de texto
      form.setFocus("text");
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };
  
  // Formata a data da mensagem para exibição
  const formatMessageDate = (timestamp: number | string) => {
    if (!timestamp) return '';
    
    const date = new Date(Number(timestamp) * 1000);
    return formatDistanceToNow(date, { 
      addSuffix: true,
      locale: ptBR 
    });
  };
  
  // Extrai o conteúdo da mensagem
  const getMessageContent = (msg: any) => {
    // Texto da mensagem
    if (msg.message?.conversation) {
      return msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    } else if (msg.body) {
      return msg.body;
    } else if (msg.content) {
      return msg.content;
    }
    
    // Tipos específicos de mídia
    if (msg.message?.imageMessage) {
      return '[Imagem]';
    } else if (msg.message?.videoMessage) {
      return '[Vídeo]';
    } else if (msg.message?.audioMessage) {
      return '[Áudio]';
    } else if (msg.message?.documentMessage) {
      return '[Documento]';
    } else if (msg.message?.stickerMessage) {
      return '[Sticker]';
    }
    
    // Fallback para outros tipos
    return '[Mensagem não suportada]';
  };
  
  // Determina se uma mensagem é do usuário atual (fromMe)
  const isFromMe = (msg: any) => {
    return msg.key?.fromMe === true || msg.fromMe === true;
  };
  
  // Formata o nome do chat para exibição
  const getChatName = (chat: any) => {
    if (!chat) return '';
    
    // Diferentes formatos possíveis para o nome do chat
    if (chat.name) return chat.name;
    if (chat.pushName) return chat.pushName;
    if (chat.notifyName) return chat.notifyName;
    if (chat.subject) return chat.subject;
    
    // Se não tiver nome, usar o ID formatado sem o sufixo @c.us ou @s.whatsapp.net
    const id = chat.id || chat.remoteJid || '';
    return id.split('@')[0] || 'Desconhecido';
  };
  
  // Formata o nome do contato da mensagem
  const getMessageSender = (msg: any) => {
    if (isFromMe(msg)) return 'Você';
    
    // Diferentes formatos possíveis
    if (msg.pushName) return msg.pushName;
    if (msg.notifyName) return msg.notifyName;
    if (msg.sender) return msg.sender;
    
    // Tenta extrair o nome do ID
    if (msg.key?.participant) {
      const participant = msg.key.participant.split('@')[0];
      return participant || 'Contato';
    }
    
    return 'Contato';
  };
  
  // Retorna a classe CSS para a bolha de mensagem
  const getMessageBubbleClass = (msg: any) => {
    return isFromMe(msg) 
      ? 'bg-green-100 dark:bg-green-950 ml-auto rounded-bl-lg rounded-tl-lg rounded-tr-lg' 
      : 'bg-white dark:bg-gray-800 mr-auto rounded-br-lg rounded-tr-lg rounded-tl-lg';
  };

  return (
    <div className="flex h-screen">
      {/* Barra lateral - lista de chats */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b bg-gray-100 dark:bg-gray-900 flex justify-between items-center">
          <h2 className="font-semibold">WhatsApp Web</h2>
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => checkConnection()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
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
                        {!isFromMe(msg) && (selectedChat.isGroup || selectedChat.participant) && (
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                            {getMessageSender(msg)}
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {getMessageContent(msg)}
                        </div>
                        <div className="text-right text-xs text-gray-500 mt-1">
                          {formatMessageDate(msg.messageTimestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Formulário de envio */}
            <div className="p-4 border-t bg-gray-100 dark:bg-gray-900">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex space-x-2">
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Digite uma mensagem"
                            {...field}
                            disabled={!connected || loading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="icon" disabled={!connected || loading || form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
            <div className="max-w-md text-center">
              <h2 className="text-2xl font-bold mb-4">Bem-vindo ao Chat LiguIA</h2>
              <p className="text-gray-500 mb-8">
                Selecione um contato na barra lateral para iniciar uma conversa.
              </p>
              {!connected && (
                <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg mb-4">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    Você está desconectado do WhatsApp. Verifique sua conexão.
                  </p>
                  <Button 
                    onClick={() => checkConnection()} 
                    variant="outline" 
                    className="mt-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Verificar Conexão
                      </>
                    )}
                  </Button>
                </div>
              )}
              {!loading && connected && chats.length === 0 && (
                <Button 
                  onClick={loadChats} 
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Carregar Contatos
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}