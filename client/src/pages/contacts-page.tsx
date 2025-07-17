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
import { Loader2, RefreshCw, Search, Download, User, Users, Phone, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [contactsPerPage] = useState(10);

  // Consulta para obter contatos
  const {
    data: contactsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/contacts"],
    refetchOnWindowFocus: false,
  });
  
  // Sincronizar contatos automaticamente para novos usuários
  useEffect(() => {
    if (!isLoading && contactsData) {
      // Para usuários novos que precisam sincronizar
      if (contactsData.isNewUser && contactsData.needsSync && 
          (!contactsData.contacts || contactsData.contacts.length === 0)) {
        console.log('Novo usuário detectado. Iniciando sincronização automática...');
        syncMutation.mutate();
      }
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

  // Reset da página quando alterar busca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Cálculos de paginação
  const totalContacts = filteredContacts.length;
  const totalPages = Math.ceil(totalContacts / contactsPerPage);
  const startIndex = (currentPage - 1) * contactsPerPage;
  const endIndex = startIndex + contactsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Funções de navegação de página
  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

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
              {totalContacts > 0 && (
                <Badge variant="outline" className="ml-2">
                  {totalContacts}
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
          ) : totalContacts === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? (
                "Nenhum contato encontrado para esta busca."
              ) : contactsData?.isNewUser ? (
                contactsData?.needsServerSetup ? (
                  <div className="space-y-2">
                    <p>Bem-vindo! Para começar, você precisa configurar um servidor.</p>
                    <p className="text-sm">Acesse o painel administrativo para configurar sua conexão.</p>
                  </div>
                ) : contactsData?.needsSync ? (
                  <div className="space-y-2">
                    <p>Conta configurada! Sincronizando seus contatos automaticamente...</p>
                    <p className="text-sm">Este processo pode levar alguns segundos.</p>
                  </div>
                ) : (
                  "Nenhum contato disponível. Clique em Sincronizar para importar seus contatos."
                )
              ) : (
                "Nenhum contato disponível. Clique em Sincronizar para importar seus contatos."
              )}
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
                {paginatedContacts.map((contact: WhatsAppContact) => (
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
            
            {/* Controles de paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, totalContacts)} de {totalContacts} contatos
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {/* Mostrar até 5 números de página */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNumber)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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