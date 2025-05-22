import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Phone, Search, MoreVertical, Paperclip, Smile, Mic, QrCode, Cloud, MessageSquare, Users, CheckCircle2, Clock, AlertCircle, Eye, Volume2, Download, FileImage, FileVideo, FileAudio, File as FileIcon, MapPin, Contact } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DirectEvolutionService } from "@/services/evolution-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Schema para validação do formulário de envio
const sendFormSchema = z.object({
  text: z.string().min(1, "Mensagem não pode estar vazia"),
});

type SendFormValues = z.infer<typeof sendFormSchema>;

interface Chat {
  id: string;
  remoteJid: string;
  pushName: string;
  profilePicUrl?: string;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  source?: 'evolution' | 'meta';
  updatedAt?: string;
}

interface Message {
  id: string;
  content: string;
  messageContent?: string;
  fromMe: boolean;
  timestamp: string;
  messageTimestamp?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  messageType?: string;
  mediaType?: string;
  mediaUrl?: string;
  caption?: string;
  quotedMessageId?: string;
  quotedContent?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    displayName: string;
    vcard: string;
  };
}

interface ConnectionStatus {
  connected: boolean;
  state?: string;
  qrCode?: string;
  error?: string;
  instance?: string;
}

export default function ChatOtimizado() {
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [connectionMode, setConnectionMode] = useState<'qr' | 'cloud'>('qr');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [service, setService] = useState<InstanceType<typeof DirectEvolutionService> | null>(null);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<Record<string, number>>({});
  const [showTemplateToggle, setShowTemplateToggle] = useState(true);
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendFormSchema),
    defaultValues: {
      text: "",
    },
  });

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket conectado");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
          console.log("Nova mensagem recebida via WebSocket:", data.message);
          
          // Adicionar nova mensagem ao chat correspondente
          const chatId = data.message.remoteJid;
          if (selectedChat && selectedChat.remoteJid === chatId) {
            setMessages(prev => {
              const messageExists = prev.some(m => m.id === data.message.id);
              if (!messageExists) {
                return [...prev, data.message];
              }
              return prev;
            });
          }
          
          // Atualizar cache de mensagens
          setMessagesByChatId(prev => ({
            ...prev,
            [chatId]: [
              ...(prev[chatId] || []),
              data.message
            ]
          }));
          
          // Rolagem automática
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else if (data.type === 'message_status') {
          console.log("Status de mensagem atualizado:", data);
          // Atualizar status da mensagem
        }
      } catch (error) {
        console.error("Erro ao processar mensagem WebSocket:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("Erro WebSocket:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket desconectado");
    };

    return () => {
      socket.close();
    };
  }, [selectedChat]);

  // Inicializar serviço Evolution API quando necessário
  useEffect(() => {
    if (connectionMode === 'qr') {
      initializeEvolutionService();
    }
  }, [connectionMode]);

  const initializeEvolutionService = async () => {
    try {
      console.log("Inicializando serviço com:", {
        apiUrl: "https://api.primerastreadores.com",
        apiKey: "4db623449606bcf2814521b73657dbc0",
        instanceName: "admin"
      });
      
      const evolutionService = new DirectEvolutionService(
        "https://api.primerastreadores.com",
        "4db623449606bcf2814521b73657dbc0",
        "admin"
      );
      
      console.log("Serviço inicializado com instância: admin");
      setService(evolutionService);
      
      console.log("Iniciando verificação de conexão...");
      await checkConnection(evolutionService);
    } catch (error: any) {
      console.error("Erro ao inicializar serviço:", error);
      toast({
        title: "Erro de conexão",
        description: error.message || "Não foi possível conectar ao serviço",
        variant: "destructive"
      });
    }
  };

  const checkConnection = async (evolutionService?: DirectEvolutionService) => {
    const serviceToUse = evolutionService || service;
    if (!serviceToUse) return;

    try {
      const status = await serviceToUse.checkConnection();
      console.log("Resultado da verificação:", status);
      setConnectionStatus(status);
    } catch (error: any) {
      console.error("Erro ao verificar conexão:", error);
      setConnectionStatus({ 
        connected: false, 
        error: error.message || "Erro de conexão" 
      });
    }
  };

  // Carregar chats com base no modo de conexão
  const loadChats = async () => {
    console.log(`Carregando chats para modo: ${connectionMode}`);
    
    try {
      if (connectionMode === 'cloud') {
        // Carregar chats da Meta Cloud API
        console.log("Buscando chats da Meta Cloud API...");
        const response = await fetch('/api/whatsapp-cloud/chats');
        if (response.ok) {
          const cloudChats = await response.json();
          console.log("Resposta da Meta API:", cloudChats);
          setChats(cloudChats || []);
        } else {
          console.error("Erro ao carregar chats da Meta API");
          setChats([]);
        }
      } else if (service && connectionStatus.connected) {
        // Carregar chats da Evolution API (comportamento original)
        console.log("Buscando chats da Evolution API...");
        const evolutionChats = await service.getChats();
        console.log("Chats da Evolution API:", evolutionChats);
        setChats(evolutionChats);
      } else {
        console.log("Nenhuma conexão válida disponível");
        setChats([]);
      }
    } catch (error: any) {
      console.error(`Erro ao carregar chats do ${connectionMode === 'cloud' ? 'Meta API' : 'QR Code'}:`, error);
      setChats([]);
    }
    
    console.log("Polling automático desativado para melhor performance");
  };

  // Carregar chats quando o modo de conexão muda
  useEffect(() => {
    console.log(`Modo de conexão alterado para: ${connectionMode}`);
    
    // Limpar estado ao trocar de modo
    setSelectedChat(null);
    setMessages([]);
    setChats([]);
    
    // Configurar visibilidade do toggle de template
    setShowTemplateToggle(connectionMode !== 'cloud');
    
    loadChats();
  }, [connectionMode, service, connectionStatus.connected]);

  // Função para carregar mensagens de um chat específico
  const loadMessages = async (chat: Chat, isInitialLoad = true) => {
    const chatId = chat.id || chat.remoteJid;
    
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

  // Auto scroll para a última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Função para lidar com upload de mídia
  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar tipo de arquivo
    const fileType = file.type;
    let mediaTypeSelected: 'image' | 'video' | 'audio' | 'document' = 'document';
    
    if (fileType.startsWith('image/')) {
      mediaTypeSelected = 'image';
    } else if (fileType.startsWith('video/')) {
      mediaTypeSelected = 'video';
    } else if (fileType.startsWith('audio/')) {
      mediaTypeSelected = 'audio';
    }
    
    setMediaType(mediaTypeSelected);

    // Converter para base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setMediaBase64(base64);
      
      if (mediaTypeSelected === 'image') {
        setMediaPreview(base64);
      } else {
        setMediaPreview(null);
      }
    };
    reader.readAsDataURL(file);
    
    setShowMediaPanel(true);
    
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaSend = async () => {
    if (!selectedChat || !mediaBase64) {
      toast({
        title: "Erro",
        description: "Selecione um chat e uma mídia para enviar",
        variant: "destructive"
      });
      return;
    }

    try {
      const chatId = selectedChat.id || selectedChat.remoteJid;
      const currentMessages = messagesByChatId[chatId] || [];
      
      // Criar mensagem temporária
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: mediaCaption || `[${mediaType.toUpperCase()}]`,
        fromMe: true,
        timestamp: Date.now().toString(),
        status: 'pending',
        mediaType,
        mediaUrl: mediaPreview || undefined,
        caption: mediaCaption
      };
      
      // Atualizar UI imediatamente
      setMessages([...currentMessages, tempMessage]);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: [...currentMessages, tempMessage]
      }));

      let success = false;
      
      if (connectionMode === 'cloud') {
        // Enviar via Meta Cloud API (implementar quando necessário)
        console.log("Enviando mídia via Meta Cloud API - funcionalidade em desenvolvimento");
      } else if (service) {
        // Enviar via Evolution API
        if (mediaType === 'image') {
          success = await service.sendImage(selectedChat.remoteJid, mediaBase64, mediaCaption);
        } else if (mediaType === 'video') {
          success = await service.sendVideo(selectedChat.remoteJid, mediaBase64, mediaCaption);
        } else if (mediaType === 'audio') {
          success = await service.sendAudio(selectedChat.remoteJid, mediaBase64);
        } else {
          success = await service.sendDocument(selectedChat.remoteJid, mediaBase64, mediaCaption);
        }
      }

      // Fechar painel de mídia
      setShowMediaPanel(false);
      setMediaType('image');
      setMediaPreview(null);
      setMediaBase64(null);
      setMediaCaption('');

      if (!success && mediaType) {
        toast({
          title: `Erro ao enviar ${mediaType}`,
          description: "Não foi possível enviar a mídia",
          variant: "destructive"
        });
      }

      // Recarregar mensagens para ver a mensagem enviada
      const updatedMessages = messagesByChatId[chatId] || [];
      const finalMessages = updatedMessages.map(m => 
        m.id === tempMessage.id ? { ...m, status: success ? 'sent' : 'error' } : m
      );
      
      setMessages(finalMessages);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: finalMessages
      }));

    } catch (error: any) {
      console.error("Erro ao enviar mídia:", error);
      
      // Atualizar mensagem temporária com erro
      const chatId = selectedChat.id || selectedChat.remoteJid;
      const updatedMessages = messagesByChatId[chatId] || [];
      const finalMessages = updatedMessages.map(m => 
        m.id.startsWith('temp-') ? { ...m, status: 'error' } : m
      );
      
      setMessages(finalMessages);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: finalMessages
      }));

      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  // Função para enviar mensagem
  const onSubmit = async (data: SendFormValues) => {
    if (!selectedChat) {
      toast({
        title: "Erro",
        description: "Selecione um chat para enviar mensagem",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Dados do formulário:", data);
      const chatId = selectedChat.id || selectedChat.remoteJid;
      const currentMessages = messagesByChatId[chatId] || [];
      
      // Criar mensagem temporária para feedback imediato
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: data.text,
        fromMe: true,
        timestamp: Date.now().toString(),
        status: 'pending'
      };
      
      // Atualizar UI imediatamente
      setMessages([...currentMessages, tempMessage]);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: [...currentMessages, tempMessage]
      }));

      // Limpar formulário
      form.reset();
      
      let success = false;
      
      if (connectionMode === 'cloud') {
        // Enviar via Meta Cloud API
        console.log("Enviando via Meta Cloud API:", data.text);
        const response = await fetch('/api/whatsapp-cloud/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: selectedChat.remoteJid,
            message: data.text,
            useTemplate: useTemplate && showTemplateToggle,
            templateMessage: templateMessage
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("Mensagem enviada via Meta Cloud API:", result);
          success = true;
        } else {
          console.error("Erro ao enviar via Meta Cloud API");
        }
      } else if (service) {
        // Enviar via Evolution API
        console.log("Enviando via Evolution API:", data.text, "para:", selectedChat.remoteJid);
        success = await service.sendMessage(selectedChat.remoteJid, data.text);
      }

      // Atualizar status da mensagem temporária
      const updatedMessages = messagesByChatId[chatId] || [];
      const finalMessages = updatedMessages.map(m => 
        m.id === tempMessage.id ? { ...m, status: success ? 'sent' : 'error' } : m
      );
      
      setMessages(finalMessages);
      setMessagesByChatId(prev => ({
        ...prev,
        [chatId]: finalMessages
      }));

      if (!success) {
        toast({
          title: "Erro ao enviar mensagem",
          description: "Não foi possível enviar a mensagem",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  // Filtrar chats baseado no termo de busca
  const filteredChats = useMemo(() => {
    if (!searchTerm) return chats;
    return chats.filter(chat => 
      chat.pushName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.remoteJid?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [chats, searchTerm]);

  // Função para formatar tempo da mensagem
  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(parseInt(timestamp) * 1000);
      return format(date, 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Função para formatar tempo do chat
  const formatChatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return format(date, 'HH:mm', { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  // Auto scroll para mensagens novas
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
    }
  }, [selectedChat]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar de Conversas */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header da Sidebar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp</h2>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Seletor de Modo de Conexão */}
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700">Modo de Conexão</Label>
            <Select value={connectionMode} onValueChange={(value: 'qr' | 'cloud') => setConnectionMode(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qr">
                  <div className="flex items-center">
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code (Evolution API)
                  </div>
                </SelectItem>
                <SelectItem value="cloud">
                  <div className="flex items-center">
                    <Cloud className="h-4 w-4 mr-2" />
                    WhatsApp Meta API
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status da Conexão */}
          <div className="flex items-center text-sm">
            {connectionMode === 'qr' ? (
              connectionStatus.connected ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Conectado (QR Code)
                </div>
              ) : connectionStatus.qrCode ? (
                <div className="flex items-center text-yellow-600">
                  <Clock className="h-4 w-4 mr-1" />
                  Aguardando scan do QR Code
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {connectionStatus.error || "Desconectado"}
                </div>
              )
            ) : (
              <div className="flex items-center text-blue-600">
                <Cloud className="h-4 w-4 mr-1" />
                Meta Cloud API
              </div>
            )}
          </div>

          {/* Campo de Busca */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredChats.map((chat) => (
              <div
                key={chat.id || chat.remoteJid}
                onClick={() => loadMessages(chat)}
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedChat?.remoteJid === chat.remoteJid
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={chat.profilePicUrl} />
                  <AvatarFallback className="bg-gray-200 text-gray-600">
                    {chat.pushName ? chat.pushName.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 truncate">
                      {chat.pushName || chat.remoteJid}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatChatTime(chat.lastMessageTime)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-600 truncate">
                      {chat.lastMessage || "Sem mensagens"}
                    </p>
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <Badge variant="secondary" className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                  
                  {chat.source === 'meta' && (
                    <div className="flex items-center mt-1">
                      <Cloud className="h-3 w-3 text-blue-500 mr-1" />
                      <span className="text-xs text-blue-600">Meta API</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área Principal do Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Header do Chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-gray-200 text-gray-600">
                      {selectedChat.pushName ? selectedChat.pushName.charAt(0).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedChat.pushName || selectedChat.remoteJid}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {connectionMode === 'cloud' ? 'Meta Cloud API' : 'Evolution API'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Área de Mensagens */}
            <ScrollArea className="flex-1 p-4 bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.fromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        {/* Conteúdo da mensagem baseado no tipo */}
                        {message.mediaType === 'image' && message.mediaUrl && (
                          <div className="mb-2">
                            <img 
                              src={message.mediaUrl} 
                              alt="Imagem" 
                              className="rounded-lg max-w-full h-auto"
                            />
                          </div>
                        )}
                        
                        {message.mediaType === 'video' && message.mediaUrl && (
                          <div className="mb-2">
                            <video 
                              src={message.mediaUrl} 
                              controls 
                              className="rounded-lg max-w-full h-auto"
                            />
                          </div>
                        )}
                        
                        {message.mediaType === 'audio' && message.mediaUrl && (
                          <div className="mb-2 flex items-center space-x-2">
                            <Volume2 className="h-4 w-4" />
                            <audio src={message.mediaUrl} controls className="max-w-full" />
                          </div>
                        )}
                        
                        {message.mediaType === 'document' && (
                          <div className="mb-2 flex items-center space-x-2">
                            <FileIcon className="h-4 w-4" />
                            <span className="text-sm">Documento</span>
                            {message.mediaUrl && (
                              <Button variant="ghost" size="sm">
                                <Download className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        
                        {message.location && (
                          <div className="mb-2 flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <div className="text-sm">
                              <div className="font-medium">{message.location.name || 'Localização'}</div>
                              {message.location.address && (
                                <div className="text-xs opacity-75">{message.location.address}</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {message.contact && (
                          <div className="mb-2 flex items-center space-x-2">
                            <Contact className="h-4 w-4" />
                            <div className="text-sm">
                              <div className="font-medium">{message.contact.displayName}</div>
                              <div className="text-xs opacity-75">Contato</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Mensagem de texto */}
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content || message.messageContent}
                        </p>
                        
                        {/* Caption para mídias */}
                        {message.caption && (
                          <p className="text-sm mt-1 opacity-90">
                            {message.caption}
                          </p>
                        )}
                        
                        {/* Timestamp e status */}
                        <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${
                          message.fromMe ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span>{formatMessageTime(message.timestamp || message.messageTimestamp || '')}</span>
                          {message.fromMe && (
                            <div className="flex">
                              {message.status === 'pending' && <Clock className="h-3 w-3" />}
                              {message.status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
                              {message.status === 'delivered' && <CheckCircle2 className="h-3 w-3" />}
                              {message.status === 'read' && <Eye className="h-3 w-3" />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Toggle de Template (apenas para QR Code) */}
            {showTemplateToggle && (
              <div className="bg-yellow-50 border-t border-yellow-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Switch
                      checked={useTemplate}
                      onCheckedChange={setUseTemplate}
                      id="template-mode"
                    />
                    <Label htmlFor="template-mode" className="text-sm font-medium">
                      Usar Mensagem Template
                    </Label>
                  </div>
                </div>
                
                {useTemplate && (
                  <div className="mt-3">
                    <Textarea
                      placeholder="Digite sua mensagem template aqui..."
                      value={templateMessage}
                      onChange={(e) => setTemplateMessage(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Painel de Mídia */}
            {showMediaPanel && (
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Enviar Mídia</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setShowMediaPanel(false);
                      setMediaType('image');
                      setMediaPreview(null);
                      setMediaBase64(null);
                      setMediaCaption('');
                    }}
                  >
                    ✕
                  </Button>
                </div>
                
                {mediaPreview && mediaType === 'image' && (
                  <div className="mb-3">
                    <img src={mediaPreview} alt="Preview" className="max-h-32 rounded-lg" />
                  </div>
                )}
                
                <div className="mb-3">
                  <Input
                    placeholder="Legenda (opcional)"
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={handleMediaSend} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                </div>
              </div>
            )}

            {/* Área de Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleMediaUpload}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    className="hidden"
                  />
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder={useTemplate && templateMessage ? templateMessage : "Digite uma mensagem..."}
                            {...field}
                            className="rounded-full"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(onSubmit)();
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="button" variant="ghost" size="sm">
                    <Smile className="h-5 w-5" />
                  </Button>
                  
                  <Button type="submit" size="sm" className="rounded-full">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </div>
          </>
        ) : (
          /* Estado Vazio */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Bem-vindo ao WhatsApp
              </h3>
              <p className="text-gray-600 mb-4">
                Selecione uma conversa para começar a enviar mensagens
              </p>
              
              {connectionMode === 'qr' && connectionStatus.qrCode && (
                <div className="bg-white p-6 rounded-lg border">
                  <h4 className="font-medium mb-4">Escaneie o QR Code</h4>
                  <div dangerouslySetInnerHTML={{ __html: connectionStatus.qrCode }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}