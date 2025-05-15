import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessagesSquare, 
  AlertCircle, 
  Loader2, 
  RefreshCcw, 
  Send, 
  Phone, 
  Image, 
  Smile, 
  Paperclip,
  CheckCheck,
  Check,
  User,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient } from "@/lib/queryClient";

// Interfaces para os tipos de dados
interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  avatarUrl?: string;
  isOnline?: boolean;
}

interface Message {
  id: string;
  contactId: string;
  content: string;
  timestamp: Date;
  isIncoming: boolean;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  type: 'text' | 'image' | 'audio' | 'document';
}

// Componente principal da página de chat
export default function ChatPage() {
  const { user } = useAuth();
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const contactsPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [contactsPanelWidth, setContactsPanelWidth] = useState(300);
  
  // Função para iniciar o redimensionamento da área de contatos
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const startWidth = contactsPanelWidth;
    const startX = e.clientX;
    
    function onMouseMove(moveEvent: MouseEvent) {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 400) {
        setContactsPanelWidth(newWidth);
      }
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [contactsPanelWidth]);
  
  // Verificar status da conexão do WhatsApp
  const { data: connectionStatus, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/connections/status"],
    queryFn: async () => {
      const res = await fetch("/api/connections/status");
      if (!res.ok) throw new Error("Falha ao verificar status da conexão");
      return res.json();
    },
    refetchInterval: 15000, // Refetch a cada 15 segundos
  });

  // Buscando contatos
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: ["/api/whatsapp/contacts"],
    queryFn: async () => {
      // Temporariamente usando dados simulados para demonstração
      // Na implementação real, isso buscaria dados da API
      const mockContacts: Contact[] = [
        {
          id: "1",
          name: "João Silva",
          phone: "5543991142751",
          lastMessage: "Olá, tudo bem?",
          lastMessageTime: new Date(Date.now() - 5 * 60000),
          unreadCount: 3,
          isOnline: true
        },
        {
          id: "2",
          name: "Maria Oliveira",
          phone: "5511987654321",
          lastMessage: "Preciso de informações sobre o produto",
          lastMessageTime: new Date(Date.now() - 120 * 60000),
          unreadCount: 0,
          isOnline: false
        },
        {
          id: "3",
          name: "Carlos Pereira",
          phone: "5521912345678",
          lastMessage: "Obrigado pelo atendimento",
          lastMessageTime: new Date(Date.now() - 24 * 60 * 60000),
          unreadCount: 0,
          isOnline: false
        }
      ];
      
      return mockContacts;
    },
    enabled: Boolean(connectionStatus?.connected),
  });

  // Buscando mensagens para o contato ativo
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["/api/whatsapp/messages", activeContactId],
    queryFn: async () => {
      // Temporariamente usando dados simulados para demonstração
      // Na implementação real, isso buscaria dados da API baseado no contactId
      const mockMessages: Message[] = [
        {
          id: "1",
          contactId: activeContactId || "",
          content: "Olá, como posso ajudar?",
          timestamp: new Date(Date.now() - 30 * 60000),
          isIncoming: false,
          status: 'read',
          type: 'text'
        },
        {
          id: "2",
          contactId: activeContactId || "",
          content: "Estou com uma dúvida sobre o produto",
          timestamp: new Date(Date.now() - 25 * 60000),
          isIncoming: true,
          status: 'read',
          type: 'text'
        },
        {
          id: "3",
          contactId: activeContactId || "",
          content: "Qual produto especificamente?",
          timestamp: new Date(Date.now() - 20 * 60000),
          isIncoming: false,
          status: 'read',
          type: 'text'
        },
        {
          id: "4",
          contactId: activeContactId || "",
          content: "O modelo X2000",
          timestamp: new Date(Date.now() - 15 * 60000),
          isIncoming: true,
          status: 'read',
          type: 'text'
        },
        {
          id: "5",
          contactId: activeContactId || "",
          content: "Ah sim, posso ajudar com isso. O modelo X2000 tem garantia de 2 anos e suporte técnico gratuito.",
          timestamp: new Date(Date.now() - 10 * 60000),
          isIncoming: false,
          status: 'delivered',
          type: 'text'
        }
      ];
      
      return mockMessages;
    },
    enabled: Boolean(activeContactId) && Boolean(connectionStatus?.connected),
  });

  // Mutação para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (message: { contactId: string, content: string }) => {
      // Simulação do envio de mensagem
      // Na implementação real, isso enviaria para a API
      console.log("Enviando mensagem:", message);
      
      // Simular um atraso de rede
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retornar a mensagem como se tivesse sido enviada com sucesso
      return {
        id: `temp-${Date.now()}`,
        contactId: message.contactId,
        content: message.content,
        timestamp: new Date(),
        isIncoming: false,
        status: 'sent',
        type: 'text' as const
      };
    },
    onSuccess: (newMessage) => {
      // Atualizar o cache localmente com a nova mensagem
      queryClient.setQueryData(
        ["/api/whatsapp/messages", activeContactId],
        (oldData: Message[] = []) => [...oldData, newMessage]
      );
      
      // Limpar campo de mensagem
      setMessageText("");
      
      // Focar o input novamente
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
      
      // Rolar para o final
      setTimeout(() => {
        if (chatContentRef.current) {
          chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
        }
      }, 100);
    }
  });

  // Função para enviar mensagem
  const handleSendMessage = () => {
    if (!messageText.trim() || !activeContactId) return;
    
    sendMessageMutation.mutate({
      contactId: activeContactId,
      content: messageText.trim()
    });
  };

  // Rolar para o final das mensagens quando carregar ou mudar de contato
  useEffect(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages]);

  // Filtrar contatos com base no termo de busca
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    contact.phone.includes(searchTerm)
  );

  // Encontrar o contato ativo
  const activeContact = contacts.find(contact => contact.id === activeContactId);

  // Função para manusear tecla Enter no campo de mensagem
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // Se não estiver conectado, mostrar tela de conexão necessária
  if (!isLoading && !connectionStatus?.connected) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">CHAT</h1>
            <p className="text-muted-foreground">
              Interface de conversas do WhatsApp
            </p>
          </div>
          
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>WhatsApp Não Conectado</CardTitle>
              <CardDescription>
                Você precisa conectar seu WhatsApp antes de acessar o chat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Conexão necessária</AlertTitle>
                <AlertDescription>
                  Acesse a página "Conexões" para escanear o QR code e conectar sua conta WhatsApp.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button onClick={() => window.location.href = "/conexoes"} className="w-full">
                Ir para Conexões WhatsApp
              </Button>
            </CardFooter>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen w-full p-0 m-0 overflow-hidden flex-1 bg-white dark:bg-black">
        <div className="p-0 py-1 px-2 bg-background/95 backdrop-blur-sm z-10 sticky top-0 border-b border-border">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold">CHAT</h1>
            <Badge variant="outline" className="text-xs">
              {connectionStatus?.connected ? "CONECTADO ✅" : "DESCONECTADO ❌"}
            </Badge>
          </div>
        </div>
        
        {/* Interface do Chat */}
        <div className="h-[calc(100vh-2.5rem)] flex flex-1 overflow-hidden">
          {/* Painel de contatos (Esquerda) - Com largura redimensionável */}
          <div
            ref={contactsPanelRef}
            className="flex flex-col h-full relative group/contacts border-r border-border bg-card"
            style={{ width: `${contactsPanelWidth}px`, minWidth: '200px', maxWidth: '400px' }}
          >
            {/* Handle de redimensionamento */}
            <div 
              ref={resizeHandleRef}
              className="absolute right-0 top-0 w-2 h-full bg-primary/20 opacity-0 group-hover/contacts:opacity-100 cursor-ew-resize z-10 transition-opacity"
              onMouseDown={startResize}
            ></div>
            {/* Dica de redimensionamento visível */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-primary/30 rounded-l-full p-1 opacity-0 group-hover/contacts:opacity-100 z-20 transition-opacity">
              <div className="flex flex-col items-center justify-center gap-1">
                <ChevronLeft className="h-3 w-3 text-primary-foreground" />
                <ChevronRight className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            {/* Cabeçalho do painel de contatos */}
            <div className="p-2 bg-background border-b border-border flex items-center justify-between">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-white">
                    {user?.name?.charAt(0) || user?.username?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-sm font-medium">{user?.name || user?.username}</h2>
                  <p className="text-xs text-muted-foreground">WhatsApp conectado</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Campo de busca */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Buscar contatos" 
                  className="pl-7 h-8 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* Lista de contatos */}
            <ScrollArea className="flex-1">
              {isLoadingContacts ? (
                <div className="space-y-4 p-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessagesSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum contato encontrado</p>
                </div>
              ) : (
                <div>
                  {filteredContacts.map((contact) => (
                    <div 
                      key={contact.id}
                      className={`p-3 hover:bg-muted cursor-pointer flex items-center border-b border-border ${activeContactId === contact.id ? 'bg-muted' : ''}`}
                      onClick={() => setActiveContactId(contact.id)}
                    >
                      <div className="relative mr-3">
                        <Avatar>
                          <AvatarImage src={contact.avatarUrl} />
                          <AvatarFallback className="bg-primary/20">
                            {contact.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {contact.isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium truncate">{contact.name}</h3>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {contact.lastMessageTime && format(contact.lastMessageTime, 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                          {contact.unreadCount ? (
                            <Badge variant="default" className="rounded-full h-5 w-5 p-0 flex items-center justify-center">
                              {contact.unreadCount}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Área de conversa (Direita) */}
          <div className="flex-1 flex flex-col h-full">
            {activeContactId ? (
              <>
                {/* Cabeçalho do chat */}
                <div className="p-3 bg-card border-b border-border flex items-center justify-between">
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setActiveContactId(null)}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 mr-2">
                      <AvatarImage src={activeContact?.avatarUrl} />
                      <AvatarFallback className="bg-primary/20">
                        {activeContact?.name.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">{activeContact?.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {activeContact?.isOnline ? 'Online' : 'Offline'} • {activeContact?.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <Search className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Área de mensagens */}
                <div 
                  ref={chatContentRef}
                  className="flex-1 p-4 overflow-y-auto bg-muted/5"
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23e5e5e5\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
                    padding: '16px',
                  }}
                >
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <MessagesSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nenhuma mensagem ainda</p>
                        <p className="text-sm">Comece uma conversa agora</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => {
                        // Agrupar por data
                        const showDateHeader = index === 0 || 
                          messages[index - 1].timestamp.toDateString() !== message.timestamp.toDateString();
                        
                        return (
                          <div key={message.id}>
                            {showDateHeader && (
                              <div className="flex justify-center my-4">
                                <Badge variant="outline" className="bg-background">
                                  {format(message.timestamp, "dd 'de' MMMM", { locale: ptBR })}
                                </Badge>
                              </div>
                            )}
                            
                            <div className={`flex ${message.isIncoming ? 'justify-start' : 'justify-end'} mb-2`}>
                              <div 
                                className={`relative max-w-[80%] rounded-lg p-3 shadow-sm ${
                                  message.isIncoming 
                                    ? 'bg-background border border-border' 
                                    : 'bg-primary/20 text-primary-foreground'
                                }`}
                                style={{
                                  borderTopLeftRadius: message.isIncoming ? '4px' : '16px',
                                  borderTopRightRadius: message.isIncoming ? '16px' : '4px',
                                  borderBottomLeftRadius: '16px',
                                  borderBottomRightRadius: '16px',
                                }}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                                <div className="text-xs text-muted-foreground flex items-center justify-end mt-1 space-x-1">
                                  <span>{format(message.timestamp, 'HH:mm')}</span>
                                  {!message.isIncoming && (
                                    <>
                                      {message.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
                                      {message.status === 'sent' && <Check className="h-3 w-3" />}
                                      {message.status === 'delivered' && <CheckCheck className="h-3 w-3" />}
                                      {message.status === 'read' && <CheckCheck className="h-3 w-3 text-green-500" />}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Área de entrada de mensagem */}
                <div className="p-3 bg-card border-t border-border">
                  <div className="flex items-end bg-background rounded-full px-4 py-2 shadow-sm">
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9 rounded-full">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9 rounded-full">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Textarea 
                      ref={messageInputRef}
                      placeholder="Digite uma mensagem"
                      className="flex-1 mx-2 resize-none min-h-[40px] max-h-[120px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 rounded-full"
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Tela de boas-vindas quando nenhum chat está selecionado
              <div className="flex flex-col items-center justify-center h-full bg-background">
                <div className="text-center max-w-md p-6">
                  <div className="bg-primary/10 rounded-full p-6 mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                    <MessagesSquare className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Chat WhatsApp</h2>
                  <p className="text-muted-foreground mb-6">
                    Selecione um contato na lista à esquerda para iniciar ou continuar uma conversa.
                    Todas as mensagens são sincronizadas com seu WhatsApp.
                  </p>
                  <Card className="mb-6 bg-muted/10 border-dashed">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCheck className="h-5 w-5 mr-2 text-green-500" />
                        <span className="font-medium">Conexão estabelecida com sucesso</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Mantenha seu telefone conectado e com acesso à internet para sincronização contínua
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}