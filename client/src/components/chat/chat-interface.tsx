import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { User, MessageCircle, Send, Paperclip, Image, Smile, MoreVertical, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Interface para as mensagens de chat
interface ChatMessage {
  id: string;
  content: string;
  from: 'me' | 'contact';
  timestamp: Date;
  contact?: string;
  status?: 'enviado' | 'entregue' | 'lido';
}

// Interface para os contatos
interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string | null;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
}

// Componente principal do Chat
export default function ChatInterface() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  
  // Conectar WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket conectado");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'contact_message' && selectedContact?.id === data.contactId) {
          // Adicionar mensagem recebida se for do contato selecionado
          setMessages(prevMessages => [...prevMessages, {
            id: `msg_${Date.now()}`,
            content: data.content,
            from: 'contact',
            timestamp: new Date(),
            contact: selectedContact.name
          }]);
        } else if (data.type === 'contacts_updated') {
          // Atualizar lista de contatos
          loadContacts();
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket:", err);
      }
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket desconectado: ${event.code} ${event.reason}`);
      setTimeout(() => {
        // Reconectar após 3 segundos
        console.log("Tentando reconectar WebSocket...");
      }, 3000);
    };
    
    setSocket(ws);
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Carregar contatos
  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Fazer chamada para o endpoint real quando estiver disponível
      // const response = await fetch("/api/chat/contacts");
      // if (response.ok) {
      //   const data = await response.json();
      //   setContacts(data);
      // }
      
      // Por enquanto, usando dados simulados
      const simulatedContacts: Contact[] = [
        {
          id: "1",
          name: "João da Silva",
          phone: "5511999887766",
          lastMessage: "Olá, tudo bem?",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutos atrás
          unreadCount: 2
        },
        {
          id: "2",
          name: "Maria Oliveira",
          phone: "5511988776655",
          lastMessage: "Quando podemos conversar?",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutos atrás
        },
        {
          id: "3",
          name: "Carlos Souza",
          phone: "5511977665544",
          lastMessage: "Obrigado pela informação!",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 horas atrás
        },
        {
          id: "4",
          name: "Ana Ferreira",
          phone: "5511966554433",
          lastMessage: "Vou verificar e retorno em breve",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 dia atrás
        },
        {
          id: "5",
          name: "Paulo Mendes",
          phone: "5511955443322",
          lastMessage: "Precisamos conversar sobre o projeto",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 dias atrás
        }
      ];
      
      setContacts(simulatedContacts);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar contatos ao iniciar
  useEffect(() => {
    if (user) {
      // Carregar contatos quando o componente montar
      loadContacts();
    }
  }, [user]);
  
  // Fix TypeScript error
  const loadContatos = () => {
    loadContacts();
  };

  // Carregar mensagens ao selecionar contato
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact.id);
    }
  }, [selectedContact]);

  // Rolar para a última mensagem quando as mensagens são atualizadas
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Carregar mensagens do contato selecionado
  const loadMessages = async (contactId: string) => {
    try {
      setLoadingMessages(true);
      
      // Aqui você faria uma chamada real à API
      // const response = await fetch(`/api/chat/messages/${contactId}`);
      // const data = await response.json();
      
      // Por enquanto, vamos simular algumas mensagens
      const simulatedMessages: ChatMessage[] = [
        {
          id: "m1",
          content: "Olá, como posso ajudar?",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 10),
          status: "lido"
        },
        {
          id: "m2",
          content: "Olá! Gostaria de informações sobre seus serviços",
          from: "contact",
          timestamp: new Date(Date.now() - 1000 * 60 * 9),
          contact: selectedContact?.name
        },
        {
          id: "m3",
          content: "Claro, ficarei feliz em ajudar. O que você gostaria de saber especificamente?",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 8),
          status: "lido"
        },
        {
          id: "m4",
          content: "Quais são os pacotes disponíveis e os preços?",
          from: "contact",
          timestamp: new Date(Date.now() - 1000 * 60 * 7),
          contact: selectedContact?.name
        },
        {
          id: "m5",
          content: "Nós temos vários pacotes. O básico começa em R$ 99,90 por mês e inclui todas as funcionalidades essenciais.",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 6),
          status: "lido"
        },
        {
          id: "m6",
          content: "Também temos o pacote premium por R$ 199,90 que inclui suporte prioritário e recursos avançados.",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          status: "lido"
        },
        {
          id: "m7",
          content: "Interessante! E como funciona o período de teste?",
          from: "contact",
          timestamp: new Date(Date.now() - 1000 * 60 * 4),
          contact: selectedContact?.name
        },
        {
          id: "m8",
          content: "Oferecemos 14 dias de teste gratuito para todos os pacotes, sem necessidade de cartão de crédito.",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 3),
          status: "entregue"
        }
      ];
      
      setMessages(simulatedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  // Função para formatar timestamp
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) {
      return "agora";
    } else if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffMins < 24 * 60) {
      return `${Math.round(diffMins / 60)}h`;
    } else {
      return `${Math.round(diffMins / (60 * 24))}d`;
    }
  };

  // Enviar nova mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedContact) return;
    
    // Adicionar mensagem local imediatamente
    const messageId = `msg_${Date.now()}`;
    const newMessageObj: ChatMessage = {
      id: messageId,
      content: newMessage,
      from: "me",
      timestamp: new Date(),
      status: "enviado"
    };
    
    setMessages(prevMessages => [...prevMessages, newMessageObj]);
    setNewMessage("");
    
    try {
      // Chamada de API para enviar mensagem
      // const response = await fetch('/api/chat/send-message', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     contactId: selectedContact.id,
      //     message: newMessage
      //   }),
      // });
      
      // if (response.ok) {
      //   // Atualizar status da mensagem para entregue
      //   setMessages(prevMessages =>
      //     prevMessages.map(msg =>
      //       msg.id === messageId ? { ...msg, status: 'entregue' } : msg
      //     )
      //   );
      // } else {
      //   throw new Error('Falha ao enviar mensagem');
      // }
      
      // Simulação de sucesso após 1 segundo
      setTimeout(() => {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === messageId ? { ...msg, status: 'entregue' } : msg
          )
        );
      }, 1000);
      
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    }
  };

  // Componente de status de mensagem
  const MessageStatus = ({ status }: { status?: string }) => {
    if (!status) return null;
    
    return (
      <span className="text-xs text-muted-foreground ml-1">
        {status === 'enviado' && (
          <span className="text-gray-400">✓</span>
        )}
        {status === 'entregue' && (
          <span className="text-blue-400">✓✓</span>
        )}
        {status === 'lido' && (
          <span className="text-green-500">✓✓</span>
        )}
      </span>
    );
  };

  return (
    <Card className="flex h-[calc(100vh-180px)] overflow-hidden border-0 shadow-none">
      {/* Lista de contatos (esquerda) */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-3 border-b bg-secondary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Conversas</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <Input 
            placeholder="Pesquisar contatos..." 
            className="h-8 text-sm" 
          />
        </div>
        
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Carregando contatos...
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum contato encontrado
              </div>
            ) : (
              contacts.map(contact => (
                <div 
                  key={contact.id}
                  className={`flex items-start p-3 gap-3 cursor-pointer hover:bg-secondary/20 ${
                    selectedContact?.id === contact.id ? 'bg-secondary/30' : ''
                  }`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <Avatar className="h-10 w-10">
                    {contact.avatar ? (
                      <AvatarImage src={contact.avatar} alt={contact.name} />
                    ) : (
                      <AvatarFallback>
                        {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate">{contact.name}</span>
                      {contact.lastMessageTime && (
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(contact.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {contact.lastMessage || contact.phone}
                      </span>
                      {contact.unreadCount && contact.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Área de conversa (direita) */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Cabeçalho do chat */}
            <div className="p-3 border-b flex items-center justify-between bg-secondary/10">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {selectedContact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-sm">{selectedContact.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4 bg-secondary/5">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando mensagens...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                    <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para iniciar a conversa</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map(message => (
                    <div 
                      key={message.id}
                      className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] px-3 py-2 rounded-lg ${
                          message.from === 'me' 
                            ? 'bg-primary text-primary-foreground rounded-br-none' 
                            : 'bg-muted rounded-bl-none'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                        <div className="text-xs opacity-70 mt-1 flex justify-end">
                          {message.timestamp.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {message.from === 'me' && (
                            <MessageStatus status={message.status} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messageEndRef} />
                </div>
              )}
            </ScrollArea>
            
            {/* Formulário de envio */}
            <form onSubmit={handleSendMessage} className="p-3 border-t flex items-center gap-2">
              <Button variant="ghost" size="icon" type="button">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" type="button">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Input
                type="text"
                placeholder="Digite uma mensagem"
                className="h-10"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">WhatsApp Web</h3>
              <p className="text-muted-foreground mb-6">
                Selecione um contato à esquerda para iniciar ou continuar uma conversa.
              </p>
              <p className="text-xs text-muted-foreground">
                Todas as mensagens são enviadas e recebidas usando o WhatsApp conectado.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}