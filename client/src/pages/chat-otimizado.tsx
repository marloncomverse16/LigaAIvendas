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
  const [connectionMode, setConnectionMode] = useState<'qr' | 'cloud' | 'both'>('qr');
  const [metaConnectionStatus, setMetaConnectionStatus] = useState<any>(null);

  // Efeito para reagir à mudança de modo de conexão
  useEffect(() => {
    console.log(`Modo de conexão alterado para: ${connectionMode}`);
    
    // Limpar estado atual quando trocar de modo
    setSelectedChat(null);
    setMessages([]);
    setMessagesByChatId({});
    
    // Carregar dados específicos do modo selecionado
    if (connectionMode === 'cloud') {
      console.log('Carregando chats para modo: cloud');
      loadCloudChats();
    } else if (connectionMode === 'qr') {
      console.log('Carregando chats para modo: qr');
      loadQrChats();
    }
  }, [connectionMode]);

  // Função para carregar chats do Cloud API
  const loadCloudChats = async () => {
    try {
      console.log('Buscando chats da Meta Cloud API...');
      const response = await fetch('/api/whatsapp-cloud/chats');
      
      if (response.ok) {
        const cloudChats = await response.json();
        console.log('Resposta da Meta API:', cloudChats);
        setChats(cloudChats || []);
      } else {
        console.error('Erro ao buscar chats da Meta Cloud API');
        setChats([]);
      }
    } catch (error) {
      console.error('Erro ao carregar chats do Cloud API:', error);
      setChats([]);
    }
  };

  // Função para carregar chats do QR Code
  const loadQrChats = async () => {
    try {
      if (service) {
        console.log('Buscando chats da Evolution API...');
        const response = await service.getChats();
        console.log('Resposta da Evolution API:', response);
        setChats(response || []);
      }
    } catch (error) {
      console.error('Erro ao carregar chats do QR Code:', error);
      setChats([]);
    }
  };

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
      // Usar as mesmas rotas que funcionam na aba Conexões
      const response = await fetch('/api/meta-connections/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: '01234567890123',
          businessId: '650175278335138'
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
      const response = await fetch('/api/whatsapp-meta/disconnect', {
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
  
  // Polling automático DESATIVADO para evitar scroll infinito
  // O usuário pode atualizar manualmente se necessário
  useEffect(() => {
    // Removido o polling automático que causava problemas de scroll
    // As mensagens são carregadas apenas quando:
    // 1. Um chat é selecionado pela primeira vez
    // 2. O usuário clica no botão de atualizar
    console.log("Polling automático desativado para melhor performance");
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
  
  // Carrega a lista de chats baseado no modo de conexão selecionado
  const loadChats = async () => {
    setLoading(true);
    try {
      console.log(`Carregando chats para modo: ${connectionMode}`);
      
      let response;
      
      if (connectionMode === 'cloud') {
        // Buscar chats da Meta Cloud API - sempre que o modo Cloud estiver selecionado
        console.log('Buscando chats da Meta Cloud API...');
        const apiResponse = await fetch('/api/whatsapp-cloud/chats');
        if (apiResponse.ok) {
          const result = await apiResponse.json();
          response = result.data || [];
          console.log('Resposta da Meta API:', response);
        } else {
          throw new Error(`Erro HTTP: ${apiResponse.status}`);
        }
      } else if ((connectionMode === 'qr' || connectionMode === 'both') && service && connected) {
        // Buscar chats da Evolution API (comportamento original)
        console.log('Buscando chats da Evolution API...');
        response = await service.loadChats();
        console.log('Resposta da Evolution API:', response);
      } else {
        console.log('Nenhuma conexão válida disponível');
        setChats([]);
        return;
      }
      
      setChats(response || []);
      
      const apiName = connectionMode === 'cloud' ? 'Meta Cloud API' : 'Evolution API';
      toast({
        title: "Contatos carregados",
        description: `${(response || []).length} contatos encontrados da ${apiName}`,
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
    if (!chat) return;
    
    const chatId = chat.remoteJid || chat.id;
    
    // Só mostra loading na carga inicial
    if (isInitialLoad) {
      setLoading(true);
      setSelectedChat(chat);
    }
    
    try {
      console.log(`Carregando mensagens para ${chatId} ${connectionMode === 'cloud' ? '(Meta Cloud API)' : '(Evolution API)'}`);
      
      let messageList = [];
      
      if (connectionMode === 'cloud') {
        // Carregar mensagens do Meta Cloud API
        const response = await fetch(`/api/whatsapp-cloud/messages/${chatId}`);
        if (response.ok) {
          const cloudMessages = await response.json();
          console.log('Mensagens do Meta API:', cloudMessages);
          messageList = cloudMessages || [];
        } else {
          console.error('Erro ao carregar mensagens do Meta API');
        }
      } else if (service) {
        // Carregar mensagens da Evolution API (comportamento original)
        const response = await service.loadMessages(chatId);
        console.log("Mensagens da Evolution API:", response);
        messageList = service.normalizeMessages(response);
      }
      
      console.log(`Processadas ${messageList.length} mensagens.`);
      
      // Atualizar o estado das mensagens
      setMessages(messageList);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: messageList
      }));
      
      console.log(`Carregadas ${messageList.length} mensagens iniciais`);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  
  // Função para enviar mensagem
  const sendMessage = async (data: SendFormValues) => {
    // Implementação simplificada para teste
    console.log("Enviando mensagem:", data.text);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-80 bg-white border-r">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">WhatsApp Chat</h2>
          <select 
            value={connectionMode} 
            onChange={(e) => setConnectionMode(e.target.value as any)}
            className="w-full mt-2 p-2 border rounded"
          >
            <option value="qr">QR Code</option>
            <option value="cloud">Cloud API</option>
          </select>
        </div>
        <div className="p-4">
          {chats.map((chat: any) => (
            <div 
              key={chat.id || chat.remoteJid} 
              onClick={() => loadMessages(chat)}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b"
            >
              <div className="font-medium">{chat.pushName || chat.remoteJid}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 border-b bg-white">
              <h3 className="font-medium">{selectedChat.pushName || selectedChat.remoteJid}</h3>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {messages.map((msg: any, index: number) => (
                <div key={index} className={`mb-4 ${msg.fromMe ? "text-right" : "text-left"}`}>
                  <div className={`inline-block p-3 rounded-lg max-w-xs ${
                    msg.fromMe ? "bg-blue-500 text-white" : "bg-gray-200"
                  }`}>
                    {msg.content || msg.messageContent}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Digite uma mensagem..."
                  className="flex-1 p-3 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      console.log("Enviando:", e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
                <button className="px-6 py-3 bg-blue-500 text-white rounded-lg">
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Selecione uma conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}
