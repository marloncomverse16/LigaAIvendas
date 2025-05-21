import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { Loader2, Settings, Send, Search } from "lucide-react";

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

export default function NewChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting" | "error">("disconnected");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Função para carregar os contatos do WhatsApp
  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/whatsapp/contacts");
      
      if (response.data && Array.isArray(response.data)) {
        const formattedContacts = response.data.map((contact: any) => ({
          id: contact.id || contact.jid,
          name: contact.name || contact.pushname || contact.id.split('@')[0],
          phone: contact.id || contact.jid,
          lastMessage: contact.lastMessage || "Nenhuma mensagem recente",
          lastMessageTime: contact.lastMessageTime || "",
          unreadCount: contact.unreadCount || 0,
          avatarInitial: (contact.name || contact.pushname || contact.id.split('@')[0])[0].toUpperCase()
        }));
        setContacts(formattedContacts);
      } else {
        toast({
          title: "Erro ao carregar contatos",
          description: "Formato de dados inesperado",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Não foi possível obter os contatos do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar as mensagens de um contato específico
  const loadMessages = async (contactId: string) => {
    try {
      const response = await axios.get(`/api/whatsapp/messages/${contactId}`);
      
      if (response.data && Array.isArray(response.data)) {
        const formattedMessages = response.data.map((msg: any) => ({
          id: msg.id,
          content: msg.body || msg.content || msg.message || "",
          timestamp: msg.timestamp || new Date().toISOString(),
          sender: msg.fromMe ? "me" as const : "other" as const,
          status: msg.status || "sent"
        }));
        setMessages(formattedMessages);
        
        // Scroll para a última mensagem
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível obter as mensagens para este contato",
        variant: "destructive",
      });
    }
  };

  // Função para enviar uma nova mensagem
  const sendMessage = async () => {
    if (!selectedContact || !newMessage.trim()) return;

    try {
      // Adiciona a mensagem localmente primeiro para UI instantânea
      const tempMessage: Message = {
        id: Date.now().toString(),
        content: newMessage,
        timestamp: new Date().toISOString(),
        sender: "me",
        status: "sent"
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage("");
      
      // Scroll para a última mensagem
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);

      // Envia para a API
      await axios.post("/api/whatsapp/send", {
        to: selectedContact.phone,
        message: newMessage
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    }
  };

  // Verifica o status da conexão quando a página carrega
  const checkConnectionStatus = async () => {
    try {
      const response = await axios.get("/api/whatsapp/status");
      setConnectionStatus(response.data.connected ? "connected" : "disconnected");
    } catch (error) {
      console.error("Erro ao verificar status de conexão:", error);
      setConnectionStatus("error");
    }
  };

  // Efeito para carregar os contatos e verificar o status da conexão
  useEffect(() => {
    loadContacts();
    checkConnectionStatus();
  }, []);

  // Efeito para carregar mensagens quando um contato é selecionado
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact.id);
    }
  }, [selectedContact]);

  // Função para formatar a hora da mensagem
  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return "";
    }
  };

  // Função para filtrar contatos com base na pesquisa
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler para a tecla Enter no campo de mensagem
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen">
        {/* Cabeçalho */}
        <div className="bg-primary text-white p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center">
            <h1 className="text-xl font-medium">WhatsApp Web</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center text-sm ${
              connectionStatus === "connected" ? "text-green-300" :
              connectionStatus === "reconnecting" ? "text-amber-300" : "text-red-300"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full mr-2 ${
                connectionStatus === "connected" ? "bg-green-400" :
                connectionStatus === "reconnecting" ? "bg-amber-400" : "bg-red-400"
              }`}></div>
              {connectionStatus === "connected" ? "Conectado" :
               connectionStatus === "reconnecting" ? "Reconectando..." : "Desconectado"}
            </div>
            <button className="p-2 hover:bg-white/10 rounded-full">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Container principal */}
        <div className="flex flex-1 overflow-hidden bg-gray-100">
          {/* Sidebar (lista de contatos) */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
            {/* Área de pesquisa */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Pesquisar contatos" 
                  className="w-full py-2 pl-10 pr-4 border border-gray-200 rounded-lg bg-gray-100 focus:outline-none focus:border-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
            </div>

            {/* Lista de contatos */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <div 
                    key={contact.id}
                    className={`flex items-center p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      selectedContact?.id === contact.id ? "bg-primary/5 border-l-4 border-l-primary" : ""
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="w-12 h-12 bg-primary/80 text-white rounded-full flex items-center justify-center text-lg font-semibold mr-3 flex-shrink-0">
                      {contact.avatarInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <h3 className="font-medium truncate">{contact.name}</h3>
                        <span className="text-xs text-gray-500">{contact.lastMessageTime}</span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{contact.lastMessage}</p>
                    </div>
                    {contact.unreadCount > 0 && (
                      <div className="ml-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {contact.unreadCount}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <p>Nenhum contato encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Área de chat */}
          <div className="flex-1 flex flex-col h-full">
            {selectedContact ? (
              <>
                {/* Cabeçalho do chat */}
                <div className="p-3 border-b border-gray-200 bg-white flex items-center">
                  <div className="w-10 h-10 bg-primary/80 text-white rounded-full flex items-center justify-center text-lg font-semibold mr-3">
                    {selectedContact.avatarInitial}
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedContact.name}</h3>
                    <p className="text-xs text-gray-500">
                      {connectionStatus === "connected" ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                {/* Container de mensagens */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 bg-[#e4ddd1] bg-opacity-80 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAAH0lEQVQ4y2NgGAVEg/9EAMo0jVqAz4BR64YCGAUjCwAAlUJJXmGwY7QAAAAASUVORK5CYII=')]"
                >
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex mb-3 ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] p-2 rounded-lg relative ${
                          message.sender === 'me' ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="text-right mt-1">
                          <span className="text-xs text-gray-500">
                            {formatMessageTime(message.timestamp)}
                            {message.sender === 'me' && (
                              <span className="ml-1 text-xs">
                                {message.status === 'read' ? '✓✓' : 
                                 message.status === 'delivered' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Área de entrada de mensagem */}
                <div className="p-3 border-t border-gray-200 bg-white flex items-end gap-2">
                  <textarea 
                    className="flex-1 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-primary min-h-[40px] max-h-[120px]"
                    placeholder="Digite uma mensagem"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    rows={1}
                  />
                  <button 
                    className={`p-3 rounded-full text-white ${newMessage.trim() ? 'bg-primary hover:bg-primary/90' : 'bg-gray-300 cursor-not-allowed'}`}
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500 bg-gray-50">
                <h3 className="text-xl font-medium mb-4">Selecione um contato para iniciar a conversa</h3>
                <p className="text-center max-w-md">
                  Escolha um contato da lista à esquerda para visualizar o histórico de mensagens e enviar novas mensagens.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}