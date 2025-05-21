import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw, Send, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type ChatMessage = {
  id: string;
  fromMe: boolean;
  content: string;
  timestamp: number;
  status: "sent" | "delivered" | "read" | "pending" | "error";
  contact: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  profilePicture: string | null;
  lastMessage?: {
    content: string;
    timestamp: number;
    unreadCount?: number;
  };
};

export default function NewChatPage() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scrollar para o final da lista de mensagens quando novas mensagens são adicionadas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Verificar status de conexão ao iniciar
  useEffect(() => {
    checkConnection();
    loadServerInfo();
    
    // Iniciar polling para mensagens a cada 3 segundos
    const intervalId = setInterval(() => {
      if (isConnected) {
        fetchContacts();
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [isConnected]);

  // Buscar mensagens quando um contato é selecionado
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact]);

  // Carregar informações do servidor
  const loadServerInfo = async () => {
    try {
      const response = await fetch("/api/servers/current");
      
      if (response.ok) {
        const data = await response.json();
        setServerInfo(data);
        console.log("Informações do servidor:", data);
      } else {
        console.error("Erro ao carregar informações do servidor:", await response.text());
      }
    } catch (error) {
      console.error("Erro ao conectar ao servidor:", error);
    }
  };

  // Verificar conexão com Evolution API
  const checkConnection = async () => {
    setIsChecking(true);
    setConnectionError("");
    
    try {
      const response = await fetch("/api/connections/status");
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        
        if (data.connected) {
          fetchContacts();
        }
        
        console.log("Status de conexão:", data);
      } else {
        const error = await response.text();
        setConnectionError("Erro ao verificar conexão: " + error);
        setIsConnected(false);
      }
    } catch (error) {
      setConnectionError("Erro ao conectar: " + String(error));
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Conexão via QR Code
  const connectViaQR = async () => {
    setIsChecking(true);
    setConnectionError("");
    
    try {
      const response = await fetch("/api/connections/qrcode");
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.qrCode) {
          // Abrir modal com QR code
          console.log("QR Code obtido:", data.qrCode);
          // Implementar modal com QR code
        } else {
          setConnectionError("QR Code não disponível");
        }
      } else {
        const error = await response.text();
        setConnectionError("Erro ao obter QR Code: " + error);
      }
    } catch (error) {
      setConnectionError("Erro ao conectar: " + String(error));
    } finally {
      setIsChecking(false);
    }
  };

  // Buscar contatos
  const fetchContacts = async () => {
    setIsLoadingContacts(true);
    
    try {
      const response = await fetch("/api/evolution/contacts");
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.contacts) {
          // Transformar contatos no formato esperado
          const formattedContacts: Contact[] = data.contacts.map((contact: any) => ({
            id: contact.id,
            name: contact.pushname || contact.name || contact.id.split('@')[0],
            phone: contact.id.split('@')[0],
            profilePicture: contact.profilePicture,
            lastMessage: contact.lastMessageTime ? {
              content: "Última atualização: " + new Date(contact.lastMessageTime).toLocaleString(),
              timestamp: new Date(contact.lastMessageTime).getTime()
            } : undefined
          }));
          
          setContacts(formattedContacts);
        } else {
          console.error("Formato de resposta inválido:", data);
        }
      } else {
        console.error("Erro ao buscar contatos:", await response.text());
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Buscar mensagens
  const fetchMessages = async (contactId: string) => {
    try {
      const response = await fetch(`/api/evolution/messages?jid=${encodeURIComponent(contactId)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.messages) {
          // Transformar mensagens no formato esperado
          const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
            id: msg.id,
            fromMe: msg.fromMe,
            content: msg.message?.conversation || msg.message?.extendedTextMessage?.text || "Mensagem sem texto",
            timestamp: msg.messageTimestamp * 1000,
            status: msg.status || "sent",
            contact: contactId
          }));
          
          setMessages(formattedMessages);
        } else {
          console.error("Formato de resposta inválido:", data);
          setMessages([]);
        }
      } else {
        console.error("Erro ao buscar mensagens:", await response.text());
        setMessages([]);
      }
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      setMessages([]);
    }
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    
    // Adicionar mensagem localmente primeiro (otimismo UI)
    const tempId = "temp-" + Date.now();
    const tempMessage: ChatMessage = {
      id: tempId,
      fromMe: true,
      content: newMessage,
      timestamp: Date.now(),
      status: "pending",
      contact: selectedContact.id
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage("");
    
    try {
      const response = await fetch("/api/evolution/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jid: selectedContact.id,
          message: newMessage
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Atualizar mensagem com ID real
        if (data.success) {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, id: data.messageId, status: "sent" } 
              : msg
          ));
        } else {
          // Marcar como erro
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: "error" } 
              : msg
          ));
        }
      } else {
        // Marcar como erro
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: "error" } 
            : msg
        ));
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      // Marcar como erro
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...msg, status: "error" } 
          : msg
      ));
    }
  };

  // Filtrar contatos pela busca
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery)
  );

  return (
    <div className="container py-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">WhatsApp Web</h1>
        <p className="text-muted-foreground">
          Interface para comunicação via WhatsApp
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[75vh]">
        {/* Sidebar com contatos */}
        <Card className="p-4 flex flex-col overflow-hidden md:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={checkConnection}
              disabled={isChecking}
            >
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
          
          {connectionError && (
            <div className="bg-red-100 text-red-800 p-2 rounded-md mb-4 text-sm">
              {connectionError}
            </div>
          )}
          
          <div className="relative mb-4">
            <Input
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
          
          {!isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-muted-foreground text-center mb-4">
                Você precisa conectar seu WhatsApp para ver os contatos
              </p>
              <Button onClick={connectViaQR} disabled={isChecking}>
                {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conectar via QR Code
              </Button>
            </div>
          ) : isLoadingContacts ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground text-center">Nenhum contato encontrado</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center ${selectedContact?.id === contact.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <Avatar className="h-10 w-10 mr-3">
                    {contact.profilePicture ? (
                      <AvatarImage src={contact.profilePicture} alt={contact.name} />
                    ) : (
                      <AvatarFallback>{contact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    {contact.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {contact.lastMessage?.unreadCount && (
                    <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {contact.lastMessage.unreadCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        
        {/* Área de chat */}
        <Card className="p-0 flex flex-col overflow-hidden md:col-span-2">
          {selectedContact ? (
            <>
              {/* Cabeçalho do chat */}
              <div className="p-4 border-b flex items-center">
                <Avatar className="h-10 w-10 mr-3">
                  {selectedContact.profilePicture ? (
                    <AvatarImage src={selectedContact.profilePicture} alt={selectedContact.name} />
                  ) : (
                    <AvatarFallback>{selectedContact.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedContact.phone}
                  </p>
                </div>
              </div>
              
              {/* Mensagens */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ 
                  backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADBJREFUOE9jfPbs2X8GPEBTU1M2QAb+D4RP9+/f/wYgLcCMPgjHpQFEAwZgQhAhBAD+fwd5rG4U/QAAAABJRU5ErkJggg==')",
                  backgroundColor: "#e5ddd5"
                }}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Nenhuma mensagem para exibir</p>
                  </div>
                ) : (
                  messages.map(message => (
                    <div 
                      key={message.id}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.fromMe 
                            ? 'bg-[#d9fdd3] rounded-tr-none' 
                            : 'bg-white rounded-tl-none'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div className="flex justify-end items-center mt-1 gap-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {message.fromMe && (
                            <span className="text-xs">
                              {message.status === "pending" ? "⏳" : 
                               message.status === "sent" ? "✓" : 
                               message.status === "delivered" ? "✓✓" : 
                               message.status === "read" ? "✓✓" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Área de input */}
              <div className="p-4 border-t flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">Nenhum chat selecionado</h3>
              <p className="text-muted-foreground text-center">
                Selecione um chat para começar a conversar
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}