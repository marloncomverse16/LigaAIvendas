import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  PhoneCall, 
  AlertCircle, 
  Loader2, 
  RefreshCcw, 
  Search, 
  FileDown, 
  UserPlus,
  Check,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  number: string;
  pushname?: string;
  isUser?: boolean;
  isGroup?: boolean;
  isWAContact?: boolean;
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Buscar contatos da API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/contacts", refreshTrigger],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/contacts");
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || "Erro ao buscar contatos");
        }
        
        return data.contacts.map((contact: any) => ({
          id: contact.id || contact.jid || contact.number || contact.wa_id || Math.random().toString(36).substring(7),
          name: contact.name || contact.displayName || contact.pushname || "Sem nome",
          number: contact.number || contact.jid?.replace(/@.*$/, "") || contact.wa_id || "",
          pushname: contact.pushname || contact.displayName || "",
          isUser: contact.isUser || contact.type === "user" || true,
          isGroup: contact.isGroup || contact.type === "group" || false,
          isWAContact: contact.isWAContact || contact.isMyContact || false
        }));
      } catch (error) {
        console.error("Erro ao buscar contatos:", error);
        throw error;
      }
    }
  });

  // Atualizar contatos filtrados quando o termo de busca ou dados mudarem
  useEffect(() => {
    if (!data) return;
    
    const filtered = data.filter((contact: Contact) => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        contact.name.toLowerCase().includes(searchTermLower) ||
        contact.number.toLowerCase().includes(searchTermLower) ||
        (contact.pushname && contact.pushname.toLowerCase().includes(searchTermLower))
      );
    });
    
    setFilteredContacts(filtered);
  }, [data, searchTerm]);

  // Função para forçar atualização
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Atualizando contatos",
      description: "Os contatos estão sendo atualizados...",
      variant: "default",
    });
    refetch();
  };

  // Função para exportar contatos para CSV
  const exportContacts = () => {
    if (!filteredContacts.length) {
      toast({
        title: "Nenhum contato para exportar",
        description: "Não há contatos disponíveis para exportação.",
        variant: "destructive",
      });
      return;
    }
    
    // Criar cabeçalho CSV
    const csvHeader = ["Nome", "Número", "Nome WhatsApp", "Usuário", "Grupo", "Contato WhatsApp"];
    
    // Converter contatos para linhas CSV
    const csvRows = filteredContacts.map(contact => [
      contact.name.replace(/,/g, " "),
      contact.number,
      (contact.pushname || "").replace(/,/g, " "),
      contact.isUser ? "Sim" : "Não",
      contact.isGroup ? "Sim" : "Não",
      contact.isWAContact ? "Sim" : "Não"
    ]);
    
    // Combinar cabeçalho e linhas
    const csvContent = [
      csvHeader.join(","),
      ...csvRows.map(row => row.join(","))
    ].join("\n");
    
    // Criar blob e link de download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contatos_whatsapp_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Exportação concluída",
      description: `${filteredContacts.length} contatos exportados com sucesso.`,
      variant: "default",
    });
  };

  // Colunas da tabela
  const columns = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.pushname && row.original.pushname !== row.original.name && (
            <span className="text-xs text-muted-foreground">{row.original.pushname}</span>
          )}
        </div>
      )
    },
    {
      accessorKey: "number",
      header: "Número",
      cell: ({ row }: any) => (
        <div className="font-mono">{row.original.number}</div>
      )
    },
    {
      accessorKey: "isUser",
      header: "Tipo",
      cell: ({ row }: any) => (
        <div>
          {row.original.isGroup ? (
            <Badge variant="secondary">Grupo</Badge>
          ) : (
            <Badge>Usuário</Badge>
          )}
        </div>
      )
    },
    {
      accessorKey: "isWAContact",
      header: "Contato",
      cell: ({ row }: any) => (
        <div className="flex items-center">
          {row.original.isWAContact ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <X className="h-5 w-5 text-red-500" />
          )}
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <PhoneCall className="mr-2 h-8 w-8" />
              Contatos
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus contatos do WhatsApp
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={exportContacts}
              disabled={isLoading || !data?.length}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Contatos</CardTitle>
                <CardDescription>
                  {filteredContacts.length} contato(s) encontrado(s)
                </CardDescription>
              </div>
              
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contatos..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Carregando contatos...</span>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : "Erro ao carregar contatos"}
                </AlertDescription>
              </Alert>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum contato encontrado</h3>
                <p className="text-muted-foreground max-w-md mt-2">
                  {data?.length ? "Tente ajustar o termo de busca para encontrar o que procura." : "Nenhum contato disponível. Certifique-se de que seu WhatsApp está conectado."}
                </p>
                {!data?.length && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.location.href = "/conexoes"}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Ir para página de conexões
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <DataTable
                  columns={columns}
                  data={filteredContacts}
                  searchKey="name"
                  pagination={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}