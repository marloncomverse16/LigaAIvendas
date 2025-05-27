import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Search, RefreshCw, User, Phone } from "lucide-react";
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

export default function ContactsSimple() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Buscar contatos salvos no banco de dados
  const { data: contactsData = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/contacts/database"],
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // Processar contatos do banco de dados
  const contacts = Array.isArray(contactsData) ? contactsData.map((contact: any) => ({
    id: contact.id,
    phone: contact.phone || contact.number,
    name: contact.name || contact.phone || contact.number,
    lastMessage: contact.lastMessage || "Nenhuma mensagem",
    lastActivity: contact.lastActivity || new Date().toISOString(),
    source: contact.source || "qrcode" as const,
    unreadCount: contact.unreadCount || 0,
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
  const cloudCount = contacts.filter(c => c.source === "cloud").length;
  const qrcodeCount = contacts.filter(c => c.source === "qrcode").length;

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
    
    if (diffInHours < 1) {
      return "Agora mesmo";
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d atrás`;
    }
  };

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Formato brasileiro
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const number = cleaned.substring(2);
      return `+55 (${number.substring(0, 2)}) ${number.substring(2, 7)}-${number.substring(7)}`;
    }
    
    return phone;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando contatos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contatos</h1>
          <p className="text-muted-foreground">
            Gerencie seus contatos do WhatsApp
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Lista de Contatos
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
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

            <TabsContent value="all" className="space-y-4">
              <ContactList contacts={filteredContacts} formatPhone={formatPhone} formatLastActivity={formatLastActivity} />
            </TabsContent>

            <TabsContent value="cloud" className="space-y-4">
              <ContactList contacts={filteredContacts} formatPhone={formatPhone} formatLastActivity={formatLastActivity} />
            </TabsContent>

            <TabsContent value="qrcode" className="space-y-4">
              <ContactList contacts={filteredContacts} formatPhone={formatPhone} formatLastActivity={formatLastActivity} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactList({ 
  contacts, 
  formatPhone, 
  formatLastActivity 
}: { 
  contacts: Contact[], 
  formatPhone: (phone: string) => string,
  formatLastActivity: (date: string) => string
}) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          Nenhum contato encontrado
        </h3>
        <p className="text-sm text-muted-foreground">
          Tente ajustar os filtros ou fazer uma nova busca.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{formatPhone(contact.phone)}</p>
                {contact.name && contact.name !== contact.phone && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <p className="text-sm text-muted-foreground">{contact.name}</p>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {contact.lastMessage}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {formatLastActivity(contact.lastActivity)}
              </p>
              {contact.unreadCount && contact.unreadCount > 0 && (
                <Badge variant="secondary" className="mt-1">
                  {contact.unreadCount}
                </Badge>
              )}
            </div>
            <Badge 
              variant={contact.source === "cloud" ? "default" : "secondary"}
              className="ml-2"
            >
              {contact.source === "cloud" ? "Cloud API" : "QR Code"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}