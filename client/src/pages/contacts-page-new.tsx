import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Phone, MessageCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  phone: string;
  name?: string;
  lastMessage?: string;
  lastActivity: string;
  source: 'cloud' | 'qrcode';
  unreadCount?: number;
}

export default function ContactsPageNew() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Buscar contatos salvos no banco de dados
  const { data: contactsData = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/contacts/database"],
    refetchInterval: 30000,
  });

  // Processar contatos do banco de dados
  const contacts = Array.isArray(contactsData) ? contactsData.map((contact: any) => ({
    id: contact.id,
    phone: contact.phone || contact.number,
    name: contact.name || contact.phone || contact.number,
    lastMessage: contact.lastMessage || "Nenhuma mensagem",
    lastActivity: contact.lastActivity || contact.updatedAt || new Date().toISOString(),
    source: contact.source || "qrcode" as const,
    unreadCount: contact.unreadCount || 0,
    profilePicUrl: contact.profilePicUrl
  })) : [];

  // Filtrar contatos baseado na busca e aba ativa
  const filteredContacts = contacts.filter((contact: Contact) => {
    const matchesSearch = 
      contact.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.name && contact.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTab = 
      activeTab === "all" || 
      (activeTab === "cloud" && contact.source === "cloud") ||
      (activeTab === "qrcode" && contact.source === "qrcode");
    
    return matchesSearch && matchesTab;
  });

  // Contar contatos por fonte
  const cloudCount = contacts.filter((c: Contact) => c.source === "cloud").length;
  const qrcodeCount = contacts.filter((c: Contact) => c.source === "qrcode").length;

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Contatos atualizados",
      description: "Lista de contatos foi atualizada com sucesso!",
    });
  };

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Agora mesmo";
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInHours < 48) return "Ontem";
    return date.toLocaleDateString("pt-BR");
  };

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Formatar para padrão brasileiro
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const number = cleaned.substring(2);
      return `+55 (${number.substring(0, 2)}) ${number.substring(2, 7)}-${number.substring(7)}`;
    }
    
    return phone;
  };

  if (error && !isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-red-900 mb-2">
                Erro ao carregar contatos
              </h3>
              <p className="text-red-700 mb-4">
                Não foi possível carregar a lista de contatos. Verifique sua conexão.
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Contatos
          </h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus contatos do WhatsApp em um só lugar
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Contatos</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cloud API</p>
                <p className="text-2xl font-bold">{cloudCount}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">QR Code</p>
                <p className="text-2xl font-bold">{qrcodeCount}</p>
              </div>
              <Phone className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca e Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por telefone ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contatos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                Todos ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="cloud">
                Cloud API ({cloudCount})
              </TabsTrigger>
              <TabsTrigger value="qrcode">
                QR Code ({qrcodeCount})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Carregando contatos...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum contato encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? "Tente ajustar sua busca ou verificar a ortografia."
                      : "Seus contatos aparecerão aqui quando você começar a usar o WhatsApp."
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact: Contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Phone className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {formatPhone(contact.phone)}
                          </p>
                          {contact.name && (
                            <p className="text-sm text-muted-foreground">
                              {contact.name}
                            </p>
                          )}
                          {contact.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {contact.lastMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={contact.source === 'cloud' ? 'default' : 'secondary'}
                          className={contact.source === 'cloud' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}
                        >
                          {contact.source === 'cloud' ? 'Cloud API' : 'QR Code'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatLastActivity(contact.lastActivity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}