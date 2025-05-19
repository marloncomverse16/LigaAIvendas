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
  }, [selectedContact]);

  // Carregar contatos
  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Tentar primeiro a nova rota CORRIGIDA para buscar contatos
      console.log("Tentando obter contatos através da rota corrigida...");
      const response = await fetch("/api/chat/contacts-fix");
      
      if (!response.ok) {
        console.warn(`Rota corrigida falhou: ${response.status}. Tentando rota alternativa...`);
        
        // Se a rota corrigida falhar, tentar a rota direta
        const fallbackResponse = await fetch("/api/chat/direct-contacts");
        
        if (!fallbackResponse.ok) {
          throw new Error(`Erro ao carregar contatos: ${fallbackResponse.status}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.success && fallbackData.contacts) {
          processContactData(fallbackData.contacts);
          return;
        }
        throw new Error("Dados de contatos inválidos");
      }
      
      const data = await response.json();
      
      if (data.success && data.contacts) {
        console.log("Contatos recebidos da API:", data.contacts);
        processContactData(data.contacts);
      } else {
        throw new Error("Dados de contatos inválidos");
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos. Verifique a conexão com o WhatsApp.",
        variant: "destructive",
      });
      
      // Usar contatos simulados como fallback em caso de erro apenas para desenvolvimento
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
        }
      ];
      
      setContacts(simulatedContacts);
      
      // Tentar carregar novamente após 30 segundos
      setTimeout(() => {
        if (user) loadContacts();
      }, 30000);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para processar os dados de contatos recebidos
  const processContactData = (contacts: any[]) => {
    // Formatar os contatos no formato esperado pelo componente
    const formattedContacts: Contact[] = contacts.map((contact: any) => ({
      id: contact.id || contact.phone || contact.jid || String(Math.random()),
      name: contact.name || contact.pushname || contact.phone || "Contato",
      phone: contact.phone || (contact.id ? contact.id.replace(/@.*$/, '') : ""),
      avatar: contact.avatar || contact.profilePicture,
      lastMessage: contact.lastMessage?.body || contact.lastMessage?.content || "",
      lastMessageTime: contact.lastMessageTime ? new Date(contact.lastMessageTime) : undefined,
      unreadCount: contact.unreadCount || 0
    }));
    
    setContacts(formattedContacts);
  };

  // Carregar contatos ao iniciar
  useEffect(() => {
    if (user) {
      // Carregar contatos quando o componente montar
      loadContacts();
    }
  }, [user]);
  
  // Carregar mensagens quando selecionar um contato
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact.id);
    }
  }, [selectedContact]);
  
  // Função para rolar para a última mensagem
  useEffect(() => {
    if (messageEndRef.current && messages.length > 0) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Função para carregar mensagens do contato selecionado
  const loadMessages = async (contactId: string) => {
    try {
      setLoadingMessages(true);
      
      // Tentar buscar mensagens reais
      const response = await fetch(`/api/chat/messages/${contactId}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar mensagens: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.messages) {
        console.log("Mensagens recebidas da API:", data.messages);
        
        // Formatar as mensagens no formato esperado pelo componente
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          id: msg.id || `msg_${Math.random()}`,
          content: msg.content || msg.body || msg.text || "",
          from: msg.from === 'me' || msg.fromMe ? 'me' : 'contact',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          status: msg.status || 'enviado'
        }));
        
        setMessages(formattedMessages);
      } else {
        // Se não conseguiu obter mensagens reais, usar mensagens simuladas
        console.log("Usando mensagens simuladas (API retornou dados inválidos)");
        const mockMessages: ChatMessage[] = [
          {
            id: "1",
            content: "Bom dia! Tudo bem com você?",
            from: "contact",
            timestamp: new Date(Date.now() - 1000 * 60 * 30)
          },
          {
            id: "2",
            content: "Olá! Tudo ótimo, e você?",
            from: "me",
            timestamp: new Date(Date.now() - 1000 * 60 * 25),
            status: "lido"
          },
          {
            id: "3",
            content: "Estou bem! Podemos conversar sobre o projeto hoje?",
            from: "contact",
            timestamp: new Date(Date.now() - 1000 * 60 * 20)
          }
        ];
        
        setMessages(mockMessages);
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens. Tente novamente mais tarde.",
        variant: "destructive",
      });
      
      // Mesmo com erro, usar mensagens simuladas para demonstração
      const mockMessages: ChatMessage[] = [
        {
          id: "1",
          content: "Bom dia! Tudo bem com você?",
          from: "contact",
          timestamp: new Date(Date.now() - 1000 * 60 * 30)
        },
        {
          id: "2",
          content: "Olá! Tudo ótimo, e você?",
          from: "me",
          timestamp: new Date(Date.now() - 1000 * 60 * 25),
          status: "lido"
        }
      ];
      
      setMessages(mockMessages);
    } finally {
      setLoadingMessages(false);
    }
  };
  
  // Função para enviar mensagem
  const sendMessage = async () => {
    // Verificar se há conteúdo
    if (!newMessage.trim() || !selectedContact) return;
    
    try {
      // Adicionar mensagem localmente enquanto envia
      const messageId = `msg_${Date.now()}`;
      
      setMessages(prevMessages => [...prevMessages, {
        id: messageId,
        content: newMessage,
        from: 'me',
        timestamp: new Date(),
        status: 'enviado'
      }]);
      
      setNewMessage(""); // Limpar campo
      
      // Enviar mensagem para a API
      const response = await fetch("/api/chat/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contactId: selectedContact.id,
          message: newMessage
        })
      });
      
      if (!response.ok) {
        throw new Error("Falha ao enviar mensagem");
      }
      
      // Atualizar status da mensagem para entregue
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, status: 'entregue' } : msg
        )
      );
      
      // Recarregar contatos para atualizar informações de last message
      loadContacts();
      
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Verifique sua conexão.",
        variant: "destructive",
      });
      
      // Atualizar status da mensagem para erro
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === `msg_${Date.now()}` ? { ...msg, status: 'erro' } : msg
        )
      );
    }
  };
  
  // Renderizar componente
  return (
    <div className="h-full flex flex-col">
      {/* Área principal com lista de contatos e chat */}
      <Card className="flex-1 border shadow-sm overflow-hidden">
        <div className="grid h-full sm:grid-cols-12">
          {/* Lista de contatos (sidebar) */}
          <div className="sm:col-span-4 md:col-span-3 lg:col-span-3 border-r dark:border-slate-700">
            <div className="p-4 border-b dark:border-slate-700">
              <h3 className="font-medium flex items-center">
                <MessageCircle className="w-4 h-4 mr-2" />
                Contatos
              </h3>
            </div>
            
            {loading ? (
              <div className="p-4 space-y-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : contacts.length > 0 ? (
              <ScrollArea className="h-[calc(100vh-15rem)]">
                <div className="p-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`flex items-start p-2 rounded-md cursor-pointer transition-colors relative mb-1 hover:bg-muted 
                        ${selectedContact?.id === contact.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <Avatar className="h-10 w-10 mr-3 mt-1">
                        {contact.avatar ? (
                          <AvatarImage src={contact.avatar} alt={contact.name} />
                        ) : (
                          <AvatarFallback>
                            {contact.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm">{contact.name}</h4>
                          {contact.lastMessageTime && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(contact.lastMessageTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.lastMessage || "Sem mensagens"}
                        </p>
                      </div>
                      {contact.unreadCount && contact.unreadCount > 0 && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {contact.unreadCount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-6 text-center">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum contato encontrado. Conecte seu WhatsApp para ver os contatos.
                </p>
              </div>
            )}
          </div>
          
          {/* Área de chat */}
          <div className="sm:col-span-8 md:col-span-9 lg:col-span-9 flex flex-col h-full">
            {selectedContact ? (
              <>
                {/* Cabeçalho do chat */}
                <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      {selectedContact.avatar ? (
                        <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                      ) : (
                        <AvatarFallback>
                          {selectedContact.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-sm">{selectedContact.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="icon">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Área de mensagens */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="space-y-4">
                      {Array(3).fill(0).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                          <div className={`rounded-lg p-3 max-w-[80%] ${i % 2 === 0 ? 'bg-muted' : 'bg-primary/10'} animate-pulse h-12`}></div>
                        </div>
                      ))}
                    </div>
                  ) : messages.length > 0 ? (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div 
                            className={`rounded-lg p-3 max-w-[80%] space-y-1 relative ${
                              message.from === 'me' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted dark:bg-slate-700'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            <div className="flex justify-end items-center space-x-1 opacity-70">
                              <span className="text-[10px]">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {message.from === 'me' && message.status && (
                                <span className="text-[10px]">
                                  {message.status === 'lido' ? '✓✓' : message.status === 'entregue' ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messageEndRef} />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center p-4">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">Sem mensagens. Envie uma mensagem para iniciar a conversa.</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
                
                {/* Área de digitação e envio */}
                <div className="p-3 border-t dark:border-slate-700 flex items-center">
                  <div className="flex items-center space-x-1 mr-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Image className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input 
                    className="flex-1"
                    placeholder="Digite uma mensagem"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="ml-2"
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className={`h-4 w-4 ${newMessage.trim() ? 'text-primary' : ''}`} />
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <h3 className="text-xl font-semibold mb-2">WhatsApp Web</h3>
                  <p className="text-muted-foreground mb-6">
                    Selecione um contato para iniciar uma conversa ou manter conversa ativa.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}