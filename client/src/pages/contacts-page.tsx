import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Search, Download, User, Users, Phone } from "lucide-react";

// Tipo para contatos do WhatsApp
interface WhatsAppContact {
  id: number;
  contactId: string;
  name: string | null;
  number: string;
  profilePicture: string | null;
  isGroup: boolean;
  lastActivity: string | null;
  lastMessageContent: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Consulta para obter contatos
  const {
    data: contactsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/contacts"],
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      console.log("📋 Buscando contatos da API...");
      console.log("📊 Resposta da API contatos:", data);
      if (data?.contacts) {
        console.log("📋 Contatos processados no frontend:", data.contacts);
        // Verificar se há contatos de outros usuários
        const invalidContacts = data.contacts.filter(contact => contact.user_id && contact.user_id !== 2);
        if (invalidContacts.length > 0) {
          console.error("❌ VAZAMENTO NO FRONTEND: Contatos de outros usuários detectados!", invalidContacts);
        }
      }
    },
  });
  
  // Sincronizar contatos automaticamente ao carregar a página
  useEffect(() => {
    // Verificamos se não temos contatos já carregados, se não temos, sincronizamos
    if (!isLoading && contactsData && (!contactsData.contacts || contactsData.contacts.length === 0)) {
      console.log('Sem contatos encontrados. Iniciando sincronização automática...');
      syncMutation.mutate();
    }
  }, [contactsData, isLoading]);

  // Mutação para sincronizar contatos usando o novo endpoint
  const syncMutation = useMutation({
    mutationFn: async () => {
      // Usar o endpoint correto para sincronização
      return await apiRequest("POST", "/api/chat/sync-contacts");
    },
    onSuccess: (data) => {
      // Atualizar a consulta de contatos após sincronização
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      // Exibir informações sobre os contatos sincronizados
      const contactsCount = data?.contacts?.length || 0;
      toast({
        title: "Contatos sincronizados",
        description: `${contactsCount} contatos encontrados`,
      });
      setShowSyncDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao sincronizar contatos",
        description: error.message,
        variant: "destructive",
      });
      setShowSyncDialog(false);
    },
  });

  // Função para exportar contatos
  const handleExport = () => {
    window.open("/api/contacts/export", "_blank");
  };

  // Filtrar contatos com base no termo de busca
  const contacts = contactsData?.contacts || [];
  const filteredContacts = contacts.filter((contact: WhatsAppContact) => {
    if (!contact) return false;
    
    // Se não tem termo de busca, incluir o contato
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    // Verificar se as propriedades existem antes de chamar toLowerCase
    const nameMatch = contact.name ? contact.name.toLowerCase().includes(searchLower) : false;
    const numberMatch = contact.number ? contact.number.toLowerCase().includes(searchLower) : false;
    
    return nameMatch || numberMatch;
  });

  // Função para formatar número de telefone
  const formatPhone = (phone: string) => {
    return phone ? phone.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4") : "";
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || !contactsData?.contacts?.length}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={() => setShowSyncDialog(true)}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Lista de Contatos
              {contactsData?.contacts?.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {contactsData.contacts.length}
                </Badge>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Erro ao carregar contatos. Tente novamente.
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm
                ? "Nenhum contato encontrado para esta busca."
                : "Nenhum contato disponível. Clique em Sincronizar para importar seus contatos."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Última Atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact: WhatsAppContact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium flex items-center">
                      {contact.profilePicture ? (
                        <img
                          src={contact.profilePicture}
                          alt={contact.name || ""}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : contact.isGroup ? (
                        <Users className="h-6 w-6 mr-2 text-muted-foreground" />
                      ) : (
                        <User className="h-6 w-6 mr-2 text-muted-foreground" />
                      )}
                      {contact.name || "Sem nome"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatPhone(contact.number)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={contact.isGroup ? "secondary" : "default"}>
                        {contact.isGroup ? "Grupo" : "Contato"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {contact.lastActivity
                        ? new Date(contact.lastActivity).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmação para sincronização */}
      <AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar Contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Isso buscará todos os seus contatos do WhatsApp. A operação pode levar alguns instantes.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                syncMutation.mutate();
              }}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                "Continuar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}