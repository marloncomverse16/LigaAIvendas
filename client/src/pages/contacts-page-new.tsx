import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Download, Search, User, Phone, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contact {
  id: number;
  phoneNumber: string;
  name: string | null;
  profilePicture: string | null;
  lastMessageTime: string | null;
  lastMessage: string | null;
  source: 'qr_code' | 'cloud_api';
  serverId: number | null;
  isActive: boolean;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ContactFormData {
  phoneNumber: string;
  name: string;
  notes: string;
  tags: string;
  source: 'qr_code' | 'cloud_api';
  isActive: boolean;
}

export default function ContactsPageNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<ContactFormData>({
    phoneNumber: "",
    name: "",
    notes: "",
    tags: "",
    source: "qr_code",
    isActive: true
  });

  // Buscar contatos
  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      console.log("📋 Buscando contatos da API...");
      const response = await apiRequest('GET', '/api/contacts');
      const data = await response.json();
      console.log("📊 Resposta da API contatos:", data);
      return data;
    }
  });

  // Sincronização automática ao carregar a página
  useEffect(() => {
    if (user) {
      console.log("🔄 Iniciando sincronização automática ao carregar página...");
      syncContactsMutation.mutate();
    }
  }, [user]); // Executa apenas quando o usuário está disponível

  const contacts: Contact[] = contactsResponse?.contacts || [];
  console.log("📋 Contatos processados no frontend:", contacts);

  // Filtrar contatos
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = !searchTerm || 
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phoneNumber.includes(searchTerm);
    
    const matchesSource = sourceFilter === "all" || contact.source === sourceFilter;
    
    return matchesSearch && matchesSource;
  });

  // Criar/Atualizar contato
  const saveContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const payload = {
        ...data,
        tags: data.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      if (editingContact) {
        const response = await apiRequest('PUT', `/api/contacts/${editingContact.id}`, payload);
        return await response.json();
      } else {
        const response = await apiRequest('POST', '/api/contacts', payload);
        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsDialogOpen(false);
      setEditingContact(null);
      resetForm();
      toast({
        title: editingContact ? "Contato atualizado" : "Contato criado",
        description: editingContact ? "Contato atualizado com sucesso!" : "Novo contato criado com sucesso!"
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao salvar contato",
        variant: "destructive"
      });
    }
  });

  // Deletar contato
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await apiRequest('DELETE', `/api/contacts/${contactId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Contato deletado",
        description: "Contato removido com sucesso!"
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao deletar contato",
        variant: "destructive"
      });
    }
  });

  // Sincronizar contatos
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/contacts/sync-all');
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Sincronização concluída",
        description: `${data.totalSynced} contatos sincronizados com sucesso!`
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao sincronizar contatos",
        variant: "destructive"
      });
    }
  });

  // Exportar contatos
  const exportContacts = async () => {
    try {
      const response = await fetch('/api/contacts/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contatos.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Exportação concluída",
          description: "Contatos exportados com sucesso!"
        });
      } else {
        throw new Error('Erro na exportação');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar contatos",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      phoneNumber: "",
      name: "",
      notes: "",
      tags: "",
      source: "qr_code",
      isActive: true
    });
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      phoneNumber: contact.phoneNumber,
      name: contact.name || "",
      notes: contact.notes || "",
      tags: contact.tags.join(', '),
      source: contact.source,
      isActive: contact.isActive
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (contactId: number) => {
    if (confirm('Tem certeza que deseja deletar este contato?')) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveContactMutation.mutate(formData);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const getSourceBadge = (source: string) => {
    return source === 'qr_code' ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700">QR Code</Badge>
    ) : (
      <Badge variant="outline" className="bg-green-50 text-green-700">Cloud API</Badge>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
              <p className="text-muted-foreground">Gerencie seus contatos do WhatsApp</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => syncContactsMutation.mutate()} 
                disabled={syncContactsMutation.isPending}
                variant="outline"
              >
                {syncContactsMutation.isPending ? 'Sincronizando...' : 'Sincronizar Contatos'}
              </Button>
              
              <Button onClick={exportContacts} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setEditingContact(null); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Contato
                  </Button>
                </DialogTrigger>
                
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingContact ? 'Editar Contato' : 'Novo Contato'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="phoneNumber">Telefone *</Label>
                      <Input
                        id="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder="5511999998888"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="source">Fonte *</Label>
                      <Select 
                        value={formData.source} 
                        onValueChange={(value: 'qr_code' | 'cloud_api') => 
                          setFormData({ ...formData, source: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="qr_code">QR Code</SelectItem>
                          <SelectItem value="cloud_api">Cloud API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="cliente, vip, importante"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="notes">Notas</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Informações adicionais sobre o contato"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      <Label htmlFor="isActive">Contato ativo</Label>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saveContactMutation.isPending}>
                        {saveContactMutation.isPending ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as fontes</SelectItem>
                    <SelectItem value="qr_code">QR Code</SelectItem>
                    <SelectItem value="cloud_api">Cloud API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Contatos</p>
                    <p className="text-2xl font-bold">{contacts.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">QR Code</p>
                    <p className="text-2xl font-bold">
                      {contacts.filter(c => c.source === 'qr_code').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cloud API</p>
                    <p className="text-2xl font-bold">
                      {contacts.filter(c => c.source === 'cloud_api').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                    <p className="text-2xl font-bold">
                      {contacts.filter(c => c.isActive).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Contatos */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Contatos ({filteredContacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <p>Carregando contatos...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum contato encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Última Mensagem</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.name || 'Sem nome'}
                          </TableCell>
                          <TableCell>{contact.phoneNumber}</TableCell>
                          <TableCell>{getSourceBadge(contact.source)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {contact.lastMessage || '-'}
                          </TableCell>
                          <TableCell>{formatDate(contact.lastMessageTime)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={contact.isActive ? "default" : "secondary"}>
                              {contact.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(contact)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(contact.id)}
                                disabled={deleteContactMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}