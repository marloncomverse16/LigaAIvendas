/**
 * Versão otimizada da página de Chat que implementa o acesso direto à Evolution API
 * Com melhorias para gerenciamento eficiente de mensagens e evitar recarregamentos completos
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { Loader2, RefreshCw, Send, Image as ImageIcon, FileAudio, FileVideo, Paperclip, ExternalLink, Eye, Video, Headphones } from 'lucide-react';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Schema para o formulário de mensagem
const sendFormSchema = z.object({
  text: z.string().min(1, "Digite uma mensagem").optional(),
  mediaType: z.enum(["image", "audio", "video", "document"]).optional(),
  mediaUrl: z.string().optional(),
  caption: z.string().optional()
}).refine(data => data.text || (data.mediaType && data.mediaUrl), {
  message: "Você precisa enviar um texto ou uma mídia",
  path: ["text"]
});

type SendFormValues = z.infer<typeof sendFormSchema>;

// Componente isolado para o campo de entrada que mantém seu próprio estado
const MessageInput = React.memo(({ 
  onSubmit, 
  disabled, 
  inputRef,
  chatId
}: {
  onSubmit: (text: string) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  chatId: string | null;
}) => {
  const [localText, setLocalText] = useState("");
  
  // Limpar o campo quando trocar de chat
  useEffect(() => {
    setLocalText("");
  }, [chatId]);
  
  const handleSubmit = () => {
    if (localText.trim()) {
      onSubmit(localText.trim());
      setLocalText(""); // Limpar após enviar
    }
  };
  
  return (
    <Input
      ref={inputRef}
      placeholder="Digite uma mensagem"
      value={localText}
      onChange={(e) => setLocalText(e.target.value)}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      }}
      autoComplete="off"
    />
  );
});

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
    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    console.log(`Fazendo requisição ${method} para ${url}${data ? ' com dados' : ''}`);
    if (data) {
      console.log(`JSON formatado:`, JSON.stringify(data, null, 2));
    }
    
    // Incluir todos os possíveis formatos de autenticação para compatibilidade com diferentes versões da API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'apikey': this.apiKey,
      'api_key': this.apiKey
    };
    
    // Adicionar token à URL para máxima compatibilidade
    const urlWithToken = url.includes('?') 
      ? `${url}&apikey=${this.apiKey}` 
      : `${url}?apikey=${this.apiKey}`;
    
    try {
      const response = await fetch(urlWithToken, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });
      
      console.log(`Resposta bem-sucedida de ${url}:`, response.status);
      
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
      const responseData = responseText ? JSON.parse(responseText) : undefined;
      console.log(`Resposta processada com sucesso:`, responseData);
      return responseData;
    } catch (error: any) {
      console.error(`Erro na requisição ${method} ${url}:`, error);
      throw error;
    }
  }

  // Verifica o status da conexão com WhatsApp
  async checkConnection() {
    try {
      // Verificar status da conexão (usar o mesmo formato da outra implementação)
      console.log(`Verificando status da conexão na instância ${this.instanceName}`);
      
      // Obter status da instância
      const instanceInfo = await this.apiRequest(`/instance/connectionState/${this.instanceName}`);
      console.log("Resposta completa do estado de conexão:", instanceInfo);
      
      // Extrair o estado real
      let state = 'unknown';
      if (instanceInfo && instanceInfo.instance && instanceInfo.instance.state) {
        state = instanceInfo.instance.state.toLowerCase();
      }
      
      console.log(`Estado real da instância: ${state} (Conectado: ${state === 'open'})`);
      
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
      const result = {
        connected,
        state,
        qrCode,
        instance: this.instanceName
      };
      
      console.log("Resultado da verificação:", result);
      return result;
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
      
      // Usar o método POST em vez de GET (como na implementação que funciona)
      try {
        // Primeira tentativa com o formato de posts na nova API
        const chats = await this.apiRequest(`/chat/findChats/${this.instanceName}`, 'POST', {
          where: {},
          limit: 100
        });
        return this.normalizeChats(chats);
      } catch (error) {
        console.warn("Erro com primeiro formato, tentando alternativa...");
        // Segunda tentativa com formato alternativo
        try {
          const contacts = await this.apiRequest(`/instance/fetchContacts/${this.instanceName}`);
          return this.normalizeChats(contacts);
        } catch (altError) {
          console.warn("Erro com segundo formato, tentando final...");
          // Terceira tentativa com outro formato
          const directContacts = await this.apiRequest(`/contacts/getContacts/${this.instanceName}`);
          return this.normalizeChats(directContacts);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar chats:", error);
      // Em caso de erro, retornar array vazio
      return [];
    }
  }

  // Carrega mensagens de um chat específico - exatamente como no exemplo que funciona
  async loadMessages(chatId: string, afterTimestamp?: number) {
    console.log(`Carregando mensagens para ${chatId} (instância: ${this.instanceName})`);
    
    // Usar formato de consulta que sabemos que funciona
    const query = {
      where: {
        key: {
          remoteJid: chatId
        }
      },
      limit: 100,
      sort: {
        messageTimestamp: -1
      }
    };
    
    // Se temos um timestamp, adicionar à consulta para buscar apenas mensagens mais recentes
    if (afterTimestamp && afterTimestamp > 0) {
      console.log(`Buscando apenas mensagens após timestamp ${afterTimestamp}`);
      // @ts-ignore - ignora erro de tipo já que sabemos que o formato funciona
      query.where.messageTimestamp = { gt: afterTimestamp };
    }
    
    try {
      // Usar método POST que é o correto para este endpoint
      return await this.apiRequest(`/chat/findMessages/${this.instanceName}`, 'POST', query);
    } catch (error) {
      console.error(`Erro ao buscar mensagens de ${chatId}:`, error);
      // Em caso de erro, retornar mensagens vazias em formato consistente
      return { messages: { records: [] } };
    }
  }

  // Envia uma mensagem para um chat - método compatível com o servidor
  async sendMessage(chatId: string, text: string) {
    try {
      console.log(`Enviando mensagem para ${chatId}`);
      
      // Remover qualquer sufixo do número para garantir compatibilidade
      const cleanNumber = chatId.includes('@') 
        ? chatId.split('@')[0] 
        : chatId;
      
      console.log(`Número formatado para envio: ${cleanNumber}`);
      
      // Analisando o erro "Bad Request", parece que a API espera um formato específico
      // A mensagem de erro diz que falta a propriedade "text", então vamos simplificar o formato
      const payload = {
        number: cleanNumber,
        text: text,  // Colocando o texto diretamente aqui como indicado pelo erro
        options: {
          delay: 1200,
          presence: "composing"
        }
      };
      
      console.log("Enviando mensagem com payload:", JSON.stringify(payload, null, 2));
      
      // Usando o endpoint de forma exata como no código que funciona
      const apiUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
      const endpoint = `/message/sendText/${this.instanceName}`;
      const urlWithToken = `${apiUrl}${endpoint}?apikey=${this.apiKey}`;
      
      const response = await fetch(urlWithToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'apikey': this.apiKey,
          'api_key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Erro HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        throw new Error(`Falha ao enviar mensagem: ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log("Mensagem enviada com sucesso:", result);
      return { success: true, result };
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      // Retornar objeto de erro estruturado para tratamento na UI
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Envia uma mídia (imagem, vídeo, documento, etc) para um chat
  async sendMedia(chatId: string, mediaType: string, mediaUrl: string, caption: string = '') {
    try {
      console.log(`Enviando mídia do tipo ${mediaType} para ${chatId}`);
      
      // Remover qualquer sufixo do número para garantir compatibilidade
      const cleanNumber = chatId.includes('@') 
        ? chatId.split('@')[0] 
        : chatId;
      
      // Validar o tipo de mídia
      const validMediaTypes = ['image', 'video', 'audio', 'document'];
      if (!validMediaTypes.includes(mediaType)) {
        throw new Error(`Tipo de mídia deve ser um dos seguintes: ${validMediaTypes.join(', ')}`);
      }
      
      // Payload para envio de mídia conforme Evolution API
      // Corrigindo a estrutura do payload de acordo com a API
      const payload = {
        number: cleanNumber,
        mediatype: mediaType, // Colocado fora da estrutura mediaMessage como requisitado pela API
        options: {
          delay: 1200
        },
        media: mediaUrl, // Movido para o nível raiz
        caption: caption, // Movido para o nível raiz
        fileName: mediaUrl.split('/').pop() || `file.${this.getDefaultExtension(mediaType)}` // Movido para o nível raiz
      };
      
      console.log(`Enviando mídia com payload:`, JSON.stringify(payload, null, 2));
      
      // Usando o endpoint específico para envio de mídia
      const apiUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
      const endpoint = `/message/sendMedia/${this.instanceName}`;
      const urlWithToken = `${apiUrl}${endpoint}?apikey=${this.apiKey}`;
      
      const response = await fetch(urlWithToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'apikey': this.apiKey,
          'api_key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Erro HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        throw new Error(`Falha ao enviar mídia: ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log("Mídia enviada com sucesso:", result);
      return { success: true, result };
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Envia um áudio no formato específico do WhatsApp (mensagem de voz)
  async sendWhatsAppAudio(chatId: string, audioUrl: string) {
    try {
      console.log(`Enviando áudio WhatsApp para ${chatId}`);
      
      // Remover qualquer sufixo do número para garantir compatibilidade
      const cleanNumber = chatId.includes('@') 
        ? chatId.split('@')[0] 
        : chatId;
      
      // Payload específico para mensagens de áudio WhatsApp
      // A estrutura correta para envio de áudio precisa seguir o mesmo padrão
      const payload = {
        number: cleanNumber,
        options: {
          delay: 1200
        },
        audioMessage: {
          audio: audioUrl
        }
      };
      
      console.log(`Enviando áudio com payload:`, JSON.stringify(payload, null, 2));
      
      // Usando o endpoint específico para envio de áudio
      const apiUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
      // sendPTT é o endpoint para envio de áudio no formato WhatsApp
      const endpoint = `/message/sendPTT/${this.instanceName}`;
      const urlWithToken = `${apiUrl}${endpoint}?apikey=${this.apiKey}`;
      
      const response = await fetch(urlWithToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'apikey': this.apiKey,
          'api_key': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Erro HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        throw new Error(`Falha ao enviar áudio: ${errorText || response.statusText}`);
      }
      
      const result = await response.json();
      console.log("Áudio enviado com sucesso:", result);
      return { success: true, result };
    } catch (error) {
      console.error("Erro ao enviar áudio WhatsApp:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Utilitário para obter a extensão padrão para um tipo de mídia
  private getDefaultExtension(mediaType: string): string {
    switch (mediaType.toLowerCase()) {
      case 'image':
        return 'jpg';
      case 'video':
        return 'mp4';
      case 'audio':
        return 'mp3';
      case 'document':
      default:
        return 'pdf';
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
  const [connectionMode, setConnectionMode] = useState<'qr' | 'cloud' | 'both'>('cloud');
  const [metaConnectionStatus, setMetaConnectionStatus] = useState<any>(null);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "audio" | "video" | "document" | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, any[]>>({});
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<Record<string, number>>({});
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  
  // Estado para preservar o texto digitado durante atualizações
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Formulário definido uma única vez para evitar re-renderização
  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      text: "",
      mediaType: undefined,
      mediaUrl: "",
      caption: ""
    }
  });
  
  const { toast } = useToast();

  // Funções para WhatsApp Cloud API - usando as mesmas rotas que funcionam na aba Conexões
  const checkMetaConnectionStatus = async () => {
    try {
      const response = await fetch('/api/meta-connections/status');
      if (response.ok) {
        const result = await response.json();
        setMetaConnectionStatus(result);
      }
    } catch (error) {
      console.error('Erro ao verificar status da conexão Meta:', error);
      setMetaConnectionStatus(null);
    }
  };

  const connectMetaWhatsApp = async () => {
    try {
      setLoading(true);
      
      // Primeiro, buscar as configurações do usuário para obter phoneNumberId e businessId
      const settingsResponse = await fetch('/api/settings');
      if (!settingsResponse.ok) {
        throw new Error('Não foi possível carregar as configurações');
      }
      
      const settings = await settingsResponse.json();
      
      // Verificar se as configurações Meta estão disponíveis
      if (!settings.whatsappMetaPhoneNumberId || !settings.whatsappMetaBusinessId) {
        throw new Error('Configure primeiro as credenciais do WhatsApp Meta API em Configurações > Integrações');
      }
      
      // Usar as mesmas rotas que funcionam na aba Conexões
      const response = await fetch('/api/meta-connections/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: settings.whatsappMetaPhoneNumberId,
          businessId: settings.whatsappMetaBusinessId
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setMetaConnectionStatus(result);
        toast({
          title: "Sucesso",
          description: "WhatsApp Cloud API conectado com sucesso!",
        });
        // Atualizar status após conexão
        checkMetaConnectionStatus();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao conectar WhatsApp Cloud API');
      }
    } catch (error) {
      console.error('Erro ao conectar Meta WhatsApp:', error);
      toast({
        title: "Erro",
        description: `Falha ao conectar WhatsApp Cloud API: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const disconnectMetaWhatsApp = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meta-connections/disconnect', {
        method: 'POST',
      });
      
      if (response.ok) {
        setMetaConnectionStatus(null);
        toast({
          title: "Sucesso",
          description: "WhatsApp Cloud API desconectado com sucesso!",
        });
      }
    } catch (error) {
      console.error('Erro ao desconectar Meta WhatsApp:', error);
      toast({
        title: "Erro",
        description: "Falha ao desconectar WhatsApp Cloud API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  

  
  // Inicializa o serviço quando o componente é montado
  useEffect(() => {
    console.log("Inicializando serviço com:", { apiUrl, apiKey, instanceName });
    
    // Criar instância do serviço
    const evolutionService = new DirectEvolutionService(apiUrl, apiKey, instanceName);
    setService(evolutionService);
    
    // Verificar conexão inicial
    checkConnection(evolutionService);
  }, [apiUrl, apiKey, instanceName]);
  
  // Atualização automática dos contatos a cada 5 segundos
  // Função específica para atualizar APENAS a lista de contatos
  const updateContactsOnly = useCallback(async () => {
    try {
      console.log("📱 Atualizando APENAS lista de contatos (sem recarregar página)...");
      
      const currentSelectedId = selectedChat?.id || selectedChat?.remoteJid;
      
      if (connectionMode === 'cloud') {
        // Busca contatos da Meta Cloud API
        const response = await fetch('/api/whatsapp-cloud/chats');
        if (response.ok) {
          const newChats = await response.json();
          console.log("✅ Lista de contatos atualizada:", newChats.length, "contatos");
          
          // Atualiza apenas o estado dos chats, preservando tudo mais
          setChats(newChats);
          
          // Preserva a seleção do chat atual
          if (currentSelectedId) {
            const stillExists = newChats.find((chat: any) => 
              chat.id === currentSelectedId || chat.remoteJid === currentSelectedId
            );
            if (stillExists && !selectedChat) {
              setSelectedChat(stillExists);
            }
          }
        }
      } else if (connectionMode === 'qr' && service && connected) {
        // Busca contatos da Evolution API
        const response = await service.loadChats();
        const contacts = service.normalizeChats(response);
        console.log("✅ Lista de contatos atualizada:", contacts.length, "contatos");
        
        setChats(contacts);
        
        // Preserva a seleção do chat atual
        if (currentSelectedId) {
          const stillExists = contacts.find((chat: any) => 
            chat.id === currentSelectedId || chat.remoteJid === currentSelectedId
          );
          if (stillExists && !selectedChat) {
            setSelectedChat(stillExists);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar lista de contatos:", error);
    }
  }, [connectionMode, service, selectedChat]);

  // 1. Atualização automática APENAS da lista de contatos (10 segundos)
  useEffect(() => {
    let contactsIntervalId: NodeJS.Timeout | null = null;
    
    if (connectionMode) {
      console.log("🔄 Ativando atualização automática da lista de contatos...");
      
      contactsIntervalId = setInterval(() => {
        updateContactsOnly();
      }, 10000); // A cada 10 segundos
    }
    
    return () => {
      if (contactsIntervalId) {
        console.log("🛑 Desativando atualização automática de contatos");
        clearInterval(contactsIntervalId);
      }
    };
  }, [connectionMode, updateContactsOnly]);

  // Atualização automática quando troca de modo de conexão
  useEffect(() => {
    if (connectionMode) {
      console.log(`🔄 Modo de conexão alterado para: ${connectionMode}`);
      console.log("🔄 Carregando contatos automaticamente...");
      
      // Pequeno delay para garantir que o serviço está inicializado
      setTimeout(() => {
        if (connectionMode === 'cloud') {
          console.log("☁️ Tentando conectar automaticamente ao Meta Cloud API...");
          // Conecta automaticamente ao Cloud API
          if (!metaConnectionStatus?.connected) {
            console.log("🔘 Clicando automaticamente no botão 'Conectar' do Cloud API...");
            connectMetaWhatsApp();
          } else {
            console.log("✅ Cloud API já está conectado, carregando contatos...");
            loadChats();
          }
        } else if (connectionMode === 'qr' && service) {
          loadChats();
        }
      }, 500);
    }
  }, [connectionMode, service]);

  // 2. Atualização automática APENAS das mensagens do chat selecionado (5 segundos)
  useEffect(() => {
    let messagesIntervalId: NodeJS.Timeout | null = null;
    
    if (selectedChat && (connected || connectionMode === 'cloud')) {
      console.log("🔄 Ativando atualização automática de mensagens...");
      
      messagesIntervalId = setInterval(async () => {
        console.log("💬 Atualizando APENAS mensagens do chat selecionado...");
        try {
          // Carrega apenas mensagens sem afetar o campo de entrada
          await loadMessages(selectedChat, false); // Não é carregamento inicial
        } catch (error) {
          console.error("Erro na atualização automática de mensagens:", error);
        }
      }, 5000); // A cada 5 segundos
    }
    
    return () => {
      if (messagesIntervalId) {
        console.log("🛑 Desativando atualização automática de mensagens");
        clearInterval(messagesIntervalId);
      }
    };
  }, [selectedChat, connected, connectionMode]);
  
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
  
  // Carrega a lista de chats baseado no modo de conexão selecionado
  const loadChats = async (preserveSelection = false) => {
    setLoading(true);
    
    // Salva o chat selecionado se deve preservar
    const currentSelectedChat = preserveSelection ? selectedChat : null;
    
    // Só limpa dados quando trocar de modo (não durante atualizações automáticas)
    if (!preserveSelection) {
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setMessagesByChatId({});
    }
    
    try {
      console.log(`Carregando chats para modo: ${connectionMode}`);
      
      let response;
      
      if (connectionMode === 'cloud') {
        // APENAS buscar da Meta Cloud API quando Cloud estiver selecionado
        console.log('Buscando chats da Meta Cloud API...');
        const apiResponse = await fetch('/api/whatsapp-cloud/chats');
        if (apiResponse.ok) {
          const result = await apiResponse.json();
          response = result || [];
          console.log('Resposta da Meta API:', response);
        } else {
          throw new Error(`Erro HTTP: ${apiResponse.status}`);
        }
      } else if (connectionMode === 'qr' && service && connected) {
        // APENAS buscar da Evolution API quando QR estiver selecionado
        console.log('Buscando chats da Evolution API...');
        response = await service.loadChats();
        console.log('Resposta da Evolution API:', response);
      } else {
        console.log('Nenhuma conexão válida disponível para o modo:', connectionMode);
        return;
      }
      
      // Se preserva seleção, atualiza inteligentemente os contatos
      if (preserveSelection) {
        setChats(prevChats => {
          if (!response) return prevChats;
          
          // Mapa dos contatos existentes por ID
          const existingChatsMap = new Map(prevChats.map(chat => [chat.id, chat]));
          
          // Atualiza ou adiciona novos contatos
          const updatedChats = [...prevChats];
          response.forEach((newChat: any) => {
            const existingIndex = updatedChats.findIndex(chat => chat.id === newChat.id);
            if (existingIndex >= 0) {
              // Atualiza contato existente
              updatedChats[existingIndex] = newChat;
            } else {
              // Adiciona novo contato
              updatedChats.push(newChat);
            }
          });
          
          return updatedChats;
        });
        
        // Restaurar conversa selecionada se preservação estiver ativa
        if (currentSelectedChat && response) {
          const restoredChat = response.find((chat: any) => 
            (chat.id === currentSelectedChat.id) || 
            (chat.remoteJid === currentSelectedChat.remoteJid)
          );
          if (restoredChat) {
            setSelectedChat(restoredChat);
          }
        }
      } else {
        // Na primeira carga, substitui completamente
        setChats(response || []);
      }
      
      // Só mostra toast na primeira carga
      if (!preserveSelection) {
        const apiName = connectionMode === 'cloud' ? 'Meta Cloud API' : 'Evolution API';
        toast({
          title: "Contatos carregados",
          description: `${(response || []).length} contatos encontrados da ${apiName}`,
        });
      }
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
    if (!chat) return;
    
    const chatId = chat.remoteJid || chat.id;
    
    // Só mostra loading na carga inicial
    if (isInitialLoad) {
      setLoading(true);
      setSelectedChat(chat);
      

    }
    
    if (!service && connectionMode === 'qr') return;
    
    // Usar mensagens já carregadas se existirem
    const existingMessages = messagesByChatId[chatId] || [];
    
    // Determinar o timestamp da mensagem mais recente
    const lastTimestamp = !isInitialLoad && existingMessages.length > 0
      ? lastMessageTimestamp[chatId] || 0
      : 0;
    
    try {
      console.log(`Carregando mensagens para ${chatId} ${lastTimestamp ? '(apenas novas)' : '(todas)'}`);
      
      let response;
      let messageList: any[] = [];
      
      if (connectionMode === 'cloud') {
        // BUSCAR DA META CLOUD API
        console.log('🌐 Buscando mensagens da Meta Cloud API...');
        const apiResponse = await fetch(`/api/meta-cloud/messages/${chatId}`);
        if (apiResponse.ok) {
          response = await apiResponse.json();
          messageList = response || [];
          console.log("✅ Mensagens da Meta Cloud API carregadas:", messageList);
        } else {
          throw new Error(`Erro HTTP: ${apiResponse.status}`);
        }
      } else if (connectionMode === 'qr' && service) {
        // BUSCAR DA EVOLUTION API
        console.log('Buscando mensagens da Evolution API...');
        response = await service.loadMessages(chatId, lastTimestamp > 0 ? lastTimestamp : undefined);
        console.log("Mensagens da Evolution API carregadas:", response);
        messageList = service.normalizeMessages(response);
      } else {
        console.log('Nenhuma conexão válida disponível para carregar mensagens');
        return;
      }
      
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
        // 🚀 PRESERVAR mensagens otimistas SEMPRE
        const optimisticMessages = existingMessages.filter(msg => 
          msg.id && msg.id.startsWith('local-') && 
          (msg.status === 'sending' || msg.status === 'sent')
        );
        
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
        
        // Combinar mensagens do servidor + mensagens otimistas + mensagens novas
        const allMessages = [...messageList, ...optimisticMessages, ...newMessages];
        
        // Remover duplicatas por ID
        const uniqueMessages = allMessages.filter((msg, index, arr) => {
          const msgId = msg.id || (msg.key && msg.key.id);
          return arr.findIndex(m => {
            const mId = m.id || (m.key && m.key.id);
            return mId === msgId;
          }) === index;
        });
        
        // Ordenar por timestamp
        uniqueMessages.sort((a, b) => {
          const tsA = Number(a.messageTimestamp) || 0;
          const tsB = Number(b.messageTimestamp) || 0;
          return tsA - tsB;
        });
        
        // Atualizar o cache de mensagens
        setMessagesByChatId(prev => ({
          ...prev,
          [chatId]: uniqueMessages
        }));
        
        // Atualizar mensagens visíveis
        setMessages(uniqueMessages);
        
        // Rolagem automática APENAS se houver mensagens realmente novas E estiver no final
        if (newMessages.length > 0) {
          const container = messagesEndRef.current?.parentElement;
          if (container) {
            const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
            if (isAtBottom) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          }
        }
      } else {
        // Carga inicial: ordenar e salvar todas as mensagens
        console.log(`Carregadas ${messageList.length} mensagens iniciais`);
        
        // 🚀 CORREÇÃO: Preservar mensagens otimistas durante carga inicial
        const optimisticMessages = existingMessages.filter(msg => 
          msg.id && msg.id.startsWith('local-') && 
          (msg.status === 'sending' || msg.status === 'sent')
        );
        
        // Combinar mensagens do servidor com mensagens otimistas
        const allMessages = [...messageList, ...optimisticMessages];
        
        // Ordenar por timestamp
        allMessages.sort((a, b) => {
          const tsA = Number(a.messageTimestamp) || 0;
          const tsB = Number(b.messageTimestamp) || 0;
          return tsA - tsB;
        });
        
        // Atualizar o cache de mensagens
        setMessagesByChatId(prev => ({
          ...prev,
          [chatId]: allMessages
        }));
        
        // Atualizar mensagens visíveis
        setMessages(allMessages);
        
        // Rolagem automática APENAS na primeira carga da conversa (isInitialLoad = true)
        if (isInitialLoad && !lastTimestamp) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
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
  
  // Função para converter arquivo para Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remover prefixo data:image/jpeg;base64, para obter apenas o base64
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Erro ao converter arquivo para base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  // Função para lidar com a seleção de arquivos
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Determinar o tipo de mídia com base no tipo MIME
      let mediaType: "image" | "audio" | "video" | "document" | null = null;
      
      if (file.type.startsWith('image/')) {
        mediaType = "image";
      } else if (file.type.startsWith('audio/')) {
        mediaType = "audio";
      } else if (file.type.startsWith('video/')) {
        mediaType = "video";
      } else {
        mediaType = "document";
      }
      
      setMediaType(mediaType);
      
      // Converter para base64
      const base64Data = await fileToBase64(file);
      setMediaBase64(base64Data);
      
      // Criar URL para preview (apenas para imagens e vídeos)
      if (mediaType === "image" || mediaType === "video") {
        const previewUrl = URL.createObjectURL(file);
        setMediaPreview(previewUrl);
      } else {
        setMediaPreview(null);
      }
      
      // Mostrar painel de mídia com opção para adicionar legenda
      setShowMediaPanel(true);
      
      // Resetar o input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
    }
  };

  // Função para cancelar o envio de mídia
  const cancelMediaUpload = () => {
    setShowMediaPanel(false);
    setMediaType(null);
    setMediaPreview(null);
    setMediaBase64(null);
    setMediaCaption('');
  };
  
  // Função auxiliar para atualizar mensagens otimistas
  const updateOptimisticMessage = (messageId: string, updates: Partial<any>) => {
    if (!selectedChat) return;
    
    const chatId = selectedChat.remoteJid;
    const existingMessages = messagesByChatId[chatId] || [];
    const messageIndex = existingMessages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      const updatedMessages = [...existingMessages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        ...updates
      };
      
      setMessages(updatedMessages);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: updatedMessages
      }));
    }
  };

  // Envia uma mensagem com sistema de UI otimista
  const onSubmit = async (values: SendFormValues) => {
    if (!service || !selectedChat) {
      toast({
        title: "Erro",
        description: "Serviço não inicializado ou nenhum chat selecionado",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const chatId = selectedChat.remoteJid || selectedChat.id;
      const timestamp = Math.floor(Date.now() / 1000);
      const localMsgId = `local-${Date.now()}`;
      let optimisticMsg;
      let result;
      
      // Verifica se estamos enviando mídia ou mensagem de texto
      if (showMediaPanel && mediaType && mediaBase64) {
        console.log(`Enviando ${mediaType} para ${chatId}`);
        
        // Texto da legenda (pode vir do campo de mídia ou do campo de texto)
        const caption = mediaCaption || values.text || '';
        
        // Criar uma mensagem otimista para mostrar imediatamente na interface
        // Estrutura adaptada para mostrar que é uma mídia
        optimisticMsg = {
          id: localMsgId,
          key: {
            id: localMsgId,
            fromMe: true,
            remoteJid: chatId
          },
          message: {
            // A mensagem vai conter uma indicação do tipo de mídia
            conversation: `[${mediaType.toUpperCase()}]${caption ? ' ' + caption : ''}`
          },
          messageTimestamp: timestamp,
          fromMe: true,
          status: 'sending',
          // Propriedades adicionais para identificar que é uma mídia
          isMedia: true,
          mediaType: mediaType
        };
        
        try {
          console.log(`Preparando envio de ${mediaType} para ${chatId} (tamanho base64: ${mediaBase64.length} caracteres)`);
          
          // Envia a mídia para o servidor de acordo com o tipo
          switch (mediaType) {
            case "image":
              result = await service.sendMedia(chatId, "image", mediaBase64, caption);
              console.log(`Imagem enviada com sucesso para ${chatId}`);
              break;
            case "audio":
              result = await service.sendWhatsAppAudio(chatId, mediaBase64);
              console.log(`Áudio enviado com sucesso para ${chatId}`);
              break;
            case "video":
              result = await service.sendMedia(chatId, "video", mediaBase64, caption);
              console.log(`Vídeo enviado com sucesso para ${chatId}`);
              break;
            case "document":
              result = await service.sendMedia(chatId, "document", mediaBase64, caption);
              console.log(`Documento enviado com sucesso para ${chatId}`);
              break;
          }
          
          // Limpar o estado de mídia após o envio
          setShowMediaPanel(false);
          setMediaType(null);
          setMediaPreview(null);
          setMediaBase64(null);
          setMediaCaption('');
        } catch (error) {
          console.error(`Erro ao enviar ${mediaType}:`, error);
          toast({
            title: `Erro ao enviar ${mediaType}`,
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive"
          });
          
          // Buscar a mensagem e atualizar o status
          const existingMessages = messagesByChatId[chatId] || [];
          const messageIndex = existingMessages.findIndex(m => m.id === localMsgId);
          
          if (messageIndex !== -1) {
            const updatedMessages = [...existingMessages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex], 
              status: 'failed'
            };
            
            setMessages(updatedMessages);
            setMessagesByChatId(prev => ({
              ...prev,
              [chatId]: updatedMessages
            }));
          }
          
          return; // Encerra o processamento em caso de erro
        }
      } else {
        // Envio normal de mensagem de texto
        if (!values.text || values.text.trim() === '') {
          console.log("Mensagem vazia, ignorando envio");
          return;
        }
        
        console.log(`Enviando mensagem para ${chatId}: "${values.text}"`);
        
        // Criar uma mensagem otimista para mostrar imediatamente na interface
        optimisticMsg = {
          id: localMsgId,
          key: {
            id: localMsgId,
            fromMe: true,
            remoteJid: chatId
          },
          message: {
            conversation: values.text
          },
          messageTimestamp: timestamp,
          fromMe: true,
          status: 'sending'
        };
        
        try {
          // Verificar se o texto está definido
          if (!values.text) {
            throw new Error("Texto da mensagem não pode ser vazio");
          }
          
          // Enviar a mensagem de texto baseado no modo de conexão
          console.log(`🔍 DEBUG: connectionMode = "${connectionMode}"`);
          console.log(`🔍 DEBUG: metaConnectionStatus =`, metaConnectionStatus);
          console.log(`🔍 DEBUG: service =`, service ? 'Existe' : 'Null');
          console.log(`🔍 DEBUG: Verificando condição connectionMode === 'cloud':`, connectionMode === 'cloud');
          
          if (connectionMode === 'cloud') {
            // ENVIAR VIA META CLOUD API
            console.log('🌐 Enviando mensagem via Meta Cloud API...');
            const response = await fetch('/api/meta-cloud/send-message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phoneNumber: chatId,
                message: values.text,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erro ao enviar mensagem via Meta Cloud API');
            }
            
            result = await response.json();
            console.log("✅ Mensagem enviada via Meta Cloud API:", result);
            
            toast({
              title: "Mensagem enviada",
              description: "Mensagem enviada com sucesso via Meta Cloud API",
            });
          } else if (connectionMode === 'qr' && service) {
            // ENVIAR VIA EVOLUTION API
            console.log('Enviando mensagem via Evolution API...');
            result = await service.sendMessage(chatId, values.text);
            console.log("Mensagem enviada via Evolution API:", result);
          } else {
            throw new Error('Nenhuma conexão válida disponível para envio');
          }
        } catch (error) {
          console.error("Erro ao enviar mensagem:", error);
          
          // Melhor tratamento de erro para evitar erro vazio
          let errorMessage = "Erro desconhecido ao enviar mensagem";
          
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && typeof error === 'object') {
            errorMessage = JSON.stringify(error);
          }
          
          // Se ainda estiver vazio, usar mensagem padrão
          if (!errorMessage || errorMessage === '{}' || errorMessage.trim() === '') {
            errorMessage = "Falha na comunicação com o servidor";
          }
          
          toast({
            title: "Erro ao enviar mensagem",
            description: errorMessage,
            variant: "destructive"
          });
          
          // Buscar a mensagem e atualizar o status
          const existingMessages = messagesByChatId[chatId] || [];
          const messageIndex = existingMessages.findIndex(m => m.id === localMsgId);
          
          if (messageIndex !== -1) {
            const updatedMessages = [...existingMessages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex], 
              status: 'failed'
            };
            
            setMessages(updatedMessages);
            setMessagesByChatId(prev => ({
              ...prev,
              [chatId]: updatedMessages
            }));
          }
          
          return; // Encerra o processamento em caso de erro
        }
      }
      
      // Adicionar a mensagem otimista ao estado local
      const existingMessages = messagesByChatId[chatId] || [];
      const updatedMessages = [...existingMessages, optimisticMsg];
      
      // Atualizar as mensagens exibidas imediatamente
      setMessages(updatedMessages);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: updatedMessages
      }));
      
      // Atualizar o último timestamp para evitar recarregar a mensagem que acabamos de adicionar
      setLastMessageTimestamp(prev => ({
        ...prev,
        [chatId]: timestamp
      }));
      
      // Rolar para a nova mensagem
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      
      // Limpa o formulário e o campo de texto local imediatamente para melhor experiência do usuário
      form.reset();
      setInputText("");
      
      // Focar no campo de texto para permitir enviar outra mensagem
      const inputElement = document.querySelector('input[placeholder="Digite uma mensagem"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
      
      // Verificar se houve erro no envio
      if (result && result.success === false) {
        throw new Error(result.error || "Falha no envio da mensagem");
      }
      
      // Atualizar mensagens para obter o status real da mensagem enviada
      // Mas com um pequeno atraso para não interferir na experiência
      setTimeout(() => {
        loadMessages(selectedChat, false);
      }, 500);
      
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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Seletor de Conexão WhatsApp */}
      <div className="flex-shrink-0 p-4 border-b bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Conexão WhatsApp</h3>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          {/* Seletor de Modo */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Modo:</label>
            <select 
              value={connectionMode} 
              onChange={(e) => {
                setConnectionMode(e.target.value as 'qr' | 'cloud' | 'both');
                // Atualizar contatos imediatamente quando trocar de modo
                setTimeout(() => loadChats(), 100);
              }}
              className="px-3 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="qr">QR Code</option>
              <option value="cloud">Cloud API</option>
              <option value="both">Ambos</option>
            </select>
          </div>

          {/* Status QR Code */}
          {(connectionMode === 'qr' || connectionMode === 'both') && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">QR Code: {connected ? 'Conectado' : 'Desconectado'}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => checkConnection()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            </div>
          )}

          {/* Status Cloud API */}
          {(connectionMode === 'cloud' || connectionMode === 'both') && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${metaConnectionStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">Cloud API: {metaConnectionStatus?.connected ? 'Conectado' : 'Desconectado'}</span>
              {metaConnectionStatus?.connected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={disconnectMetaWhatsApp}
                  disabled={loading}
                >
                  Desconectar
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={connectMetaWhatsApp}
                  disabled={loading}
                >
                  Conectar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Barra lateral - lista de chats */}
        <div className="w-1/3 border-r flex flex-col min-h-0">
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
        <div className="flex-1 overflow-y-auto scrollbar-custom max-h-full">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {loading ? 'Carregando contatos...' : 'Nenhum chat encontrado'}
            </div>
          ) : (
            <div className="divide-y">
              {chats.map((chat) => (
                <div
                  key={chat.id || chat.remoteJid}
                  className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3 relative ${
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
                    <span className="font-medium truncate">{getChatName(chat)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Área principal - mensagens */}
      <div className="flex-1 flex flex-col min-h-0">
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
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-950 scrollbar-custom min-h-0">
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
                {/* Conteúdo do formulário */}
                <div>
                  {/* Painel de mídia */}
                  {showMediaPanel && (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      console.log("Formulário de mídia enviado");
                      onSubmit(form.getValues());
                    }} className="p-4 border rounded-md mb-2 bg-gray-50 dark:bg-gray-800">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">
                          {mediaType === "image" && "Imagem"}
                          {mediaType === "audio" && "Áudio"}
                          {mediaType === "video" && "Vídeo"}
                          {mediaType === "document" && "Documento"}
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => cancelMediaUpload()}
                          type="button"
                        >
                          Cancelar
                        </Button>
                      </div>
                      
                      {/* Preview para imagens */}
                      {mediaType === "image" && mediaPreview && (
                        <div className="mb-2 max-h-48 overflow-hidden rounded-md">
                          <img src={mediaPreview} alt="Preview" className="object-contain max-w-full" />
                        </div>
                      )}
                      
                      {/* Preview para vídeos */}
                      {mediaType === "video" && mediaPreview && (
                        <div className="mb-2">
                          <video src={mediaPreview} controls className="max-w-full max-h-48 rounded-md" />
                        </div>
                      )}
                      
                      {/* Ícone para áudio e documentos */}
                      {(mediaType === "audio" || mediaType === "document") && (
                        <div className="flex items-center justify-center h-16 mb-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                          {mediaType === "audio" ? (
                            <FileAudio className="h-8 w-8 text-blue-500" />
                          ) : (
                            <div className="h-8 w-8 text-blue-500">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Campo de legenda para mídia */}
                      <Input
                        placeholder="Adicionar legenda (opcional)"
                        value={mediaCaption}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        className="mb-2"
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        disabled={!connected || loading || form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                
                  {/* Campo de upload oculto */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={(e) => handleFileSelect(e)}
                    accept="image/*,audio/*,video/*,application/*"
                    style={{ display: 'none' }} 
                  />
                
                  {/* Formulário de mensagem principal */}
                  {!showMediaPanel && (
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex space-x-2">
                      {/* Botão de anexo */}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!connected || loading}
                        className="rounded-full"
                      >
                        <Paperclip className="h-5 w-5 text-gray-500" />
                      </Button>
                      
                      <div className="flex-1">
                        <MessageInput
                          onSubmit={(text) => {
                            setInputText(text);
                            form.setValue("text", text);
                            form.handleSubmit(onSubmit)();
                          }}
                          disabled={!connected || loading}
                          inputRef={inputRef}
                          chatId={selectedChat?.id || null}
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        size="icon" 
                        disabled={!connected || loading || form.formState.isSubmitting}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {form.formState.isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Send className="h-4 w-4 text-white" />
                        )}
                      </Button>
                    </form>
                  )}
                </div>
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
    </div>
  );
}