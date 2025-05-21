import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, Search, UserPlus, Phone, Settings, LogOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tipos 
interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  avatarInitial?: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: "me" | "other";
  status: "sent" | "delivered" | "read";
}

export default function WhatsappWebPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Verificar status da conexão
  const { 
    data: connectionStatus, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/whatsapp/status');
      return await response.json();
    },
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  // Buscar contatos
  const { 
    data: contacts, 
    isLoading: isLoadingContacts,
    refetch: refetchContacts 
  } = useQuery({
    queryKey: ['/api/whatsapp/contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/whatsapp/contacts');
      const data = await response.json();
      
      // Mapear contatos para o formato que precisamos
      return data.map((contact: any) => ({
        id: contact.id || contact.jid || contact.wa_id,
        name: contact.name || contact.pushName || contact.phone || formatPhoneNumber(contact.id),
        phone: contact.id || contact.jid || contact.wa_id,
        lastMessage: contact.lastMessage || "",
        lastMessageTime: contact.lastMessageTime || "",
        unreadCount: contact.unreadCount || 0,
        avatarInitial: (contact.name || contact.pushName || "?")[0]?.toUpperCase()
      }));
    },
    enabled: !!connectionStatus?.connected,
  });

  // Buscar mensagens
  const fetchMessages = async (contactId: string) => {
    setLoadingMessages(true);
    try {
      const response = await apiRequest('GET', `/api/whatsapp/messages/${contactId}`);
      const data = await response.json();
      
      // Mapear mensagens para o formato que precisamos
      const formattedMessages = data.map((msg: any) => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        content: msg.message || msg.body || msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
        sender: msg.fromMe ? "me" : "other",
        status: msg.status || "sent"
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível buscar as mensagens deste contato.",
        variant: "destructive",
      });
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      const response = await apiRequest('POST', '/api/whatsapp/send', data);
      return await response.json();
    },
    onSuccess: () => {
      // Adicionar mensagem à lista local
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        content: message,
        timestamp: new Date().toISOString(),
        sender: "me",
        status: "sent",
      };
      
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage("");
      
      // Atualizar contatos após enviar uma nova mensagem
      setTimeout(() => {
        refetchContacts();
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    },
  });

  // Rolar para a última mensagem quando mensagens mudarem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Buscar mensagens quando selecionar um contato
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.phone);
    }
  }, [selectedContact]);

  // Tratar envio de mensagem
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !selectedContact) return;
    
    sendMessageMutation.mutate({
      to: selectedContact.phone,
      message: message.trim(),
    });
  };

  // Filtrar contatos com base no termo de busca
  const filteredContacts = contacts?.filter((contact: Contact) => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Formatar número de telefone para exibição
  function formatPhoneNumber(phone: string): string {
    // Remover caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Remover o prefixo "whatsapp:" e sufixo "@c.us" ou "@s.whatsapp.net"
    const processedPhone = cleaned
      .replace('whatsapp:', '')
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '');
    
    // Formatar para exibição
    if (processedPhone.length === 11 || processedPhone.length === 13) {
      return processedPhone;
    }
    
    return phone;
  }

  // Formatar timestamp para exibição
  function formatMessageTime(timestamp: string): string {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
    } catch (error) {
      return '00:00';
    }
  }
  
  function getConnectionStatusClass() {
    if (isLoadingStatus) return "status-reconnecting";
    if (!connectionStatus) return "status-error";
    return connectionStatus.connected ? "status-connected" : "status-disconnected";
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-primary text-white py-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center">
          <h1 className="text-xl font-medium">LiguIA Chat</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center ${getConnectionStatusClass()}`}>
            <div className="w-2.5 h-2.5 rounded-full mr-2 status-dot"></div>
            <span className="text-sm">
              {isLoadingStatus
                ? "Verificando conexão..."
                : connectionStatus?.connected
                ? "Conectado"
                : "Desconectado"}
            </span>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Lista de Contatos */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar contato"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-100 border-gray-200"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex px-4 py-2 border-b border-gray-200 space-x-2">
            <Button 
              variant="default" 
              className="flex-1 text-xs h-9"
              onClick={() => refetchContacts()}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Atualizar Contatos
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 text-xs h-9"
              onClick={() => refetchStatus()}
            >
              <Phone className="h-4 w-4 mr-1" />
              Verificar Conexão
            </Button>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingContacts ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Carregando contatos...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Nenhum contato encontrado</p>
              </div>
            ) : (
              filteredContacts.map((contact: Contact) => (
                <div
                  key={contact.id}
                  className={`flex items-center p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                    selectedContact?.id === contact.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                  }`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/50 text-white flex items-center justify-center text-lg font-bold mr-3">
                    {contact.avatarInitial || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{contact.name}</div>
                    <div className="text-gray-500 text-sm truncate">
                      {contact.lastMessage || formatPhoneNumber(contact.phone)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-2">
                    <div className="text-xs text-gray-500 mb-1">{contact.lastMessageTime || ''}</div>
                    {contact.unreadCount && contact.unreadCount > 0 ? (
                      <div className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {contact.unreadCount}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#e5ddd5] overflow-hidden">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center px-6 py-3 bg-white border-b border-gray-200">
                <div className="w-10 h-10 rounded-full bg-primary/50 text-white flex items-center justify-center text-lg font-bold mr-4">
                  {selectedContact.avatarInitial || '?'}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{selectedContact.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatPhoneNumber(selectedContact.phone)}
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div 
                className="flex-1 p-6 overflow-y-auto"
                style={{
                  backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADBJREFUOE9jfPbs2X8GPEBTU1M2QAb+D4RP9+/f/wYgLcCMPgjHpQFEAwZgQhAhBAD+fwd5rG4U/QAAAABJRU5ErkJggg==")`,
                  backgroundColor: '#e5ddd5'
                }}
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600">Carregando mensagens...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600">Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex mb-4 ${
                        msg.sender === "me" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg relative ${
                          msg.sender === "me"
                            ? "bg-[#d9fdd3] rounded-tr-none"
                            : "bg-white rounded-tl-none"
                        }`}
                      >
                        <div className="text-sm">{msg.content}</div>
                        <div className="text-[11px] text-gray-500 text-right mt-1 flex justify-end items-center">
                          {formatMessageTime(msg.timestamp)}
                          {msg.sender === "me" && (
                            <span className={`ml-1 ${
                              msg.status === "read" 
                                ? "text-blue-500" 
                                : "text-gray-400"
                            }`}>
                              {msg.status === "sent" && "✓"}
                              {msg.status === "delivered" && "✓✓"}
                              {msg.status === "read" && "✓✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                  <Textarea
                    placeholder="Digite uma mensagem"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none border-gray-200 focus:border-primary"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="h-10 w-10 rounded-full"
                    disabled={!message.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Card className="max-w-md p-8 shadow-md">
                <h2 className="text-2xl font-medium mb-4">Bem-vindo ao Chat WhatsApp</h2>
                <p className="text-gray-600 mb-6">
                  Selecione um contato na lista à esquerda para iniciar uma conversa.
                </p>
                <div className="text-sm text-gray-500">
                  {connectionStatus?.connected ? (
                    <p className="text-green-600 font-medium">Conectado ao WhatsApp</p>
                  ) : (
                    <p className="text-red-600 font-medium">
                      Não conectado ao WhatsApp. Verifique sua conexão.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}