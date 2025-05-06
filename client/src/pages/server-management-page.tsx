import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface Server {
  id: number;
  name: string;
  ipAddress: string;
  provider: string;
  apiUrl: string;
  apiToken: string | null;
  whatsappWebhookUrl: string | null;
  aiAgentWebhookUrl: string | null;
  prospectingWebhookUrl: string | null;
  contactsWebhookUrl: string | null;
  schedulingWebhookUrl: string | null;
  crmWebhookUrl: string | null;
  instanceId: string | null;
  maxUsers: number;
  active: boolean | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
}

export default function ServerManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Busca lista de servidores
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["/api/servers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/servers");
      const data = await res.json();
      return data;
    },
    enabled: !!user?.isAdmin,
  });
  
  // Busca a contagem de usuários para todos os servidores
  const { data: allServerUsers } = useQuery({
    queryKey: ["/api/servers/users-count"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/servers/users-count");
        const data = await res.json();
        console.log("Contagem de usuários por servidor:", data);
        return data;
      } catch (error) {
        console.error("Erro ao buscar contagem de usuários por servidor:", error);
        return [];
      }
    },
    enabled: true,
  });
  
  // Pega a contagem de usuários para um servidor específico
  const getServerUserCount = (serverId: number) => {
    const serverUserCount = allServerUsers?.find((s: any) => s.serverId === serverId);
    return serverUserCount?.userCount || 0;
  };
  
  // Filtra servidores baseado na aba selecionada
  const filteredServers = servers;
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciamento de Servidores</h1>
        {user?.isAdmin && (
          <Button>
            Novo Servidor
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((server: Server) => {
            const userCount = getServerUserCount(server.id);
            const percentageUsed = server.maxUsers > 0 ? (userCount / server.maxUsers) * 100 : 0;
            const badgeColor = percentageUsed >= 90 ? "destructive" : percentageUsed >= 70 ? "warning" : "success";
            
            return (
              <Card key={server.id} className={`overflow-hidden ${!server.active ? 'opacity-70' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                    <div className="flex space-x-1">
                      <Badge variant={badgeColor as any}>
                        {userCount}/{server.maxUsers} usuários
                      </Badge>
                      {!server.active && <Badge variant="outline">Inativo</Badge>}
                    </div>
                  </div>
                  <CardDescription>{server.ipAddress}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div><span className="font-medium">Provedor:</span> {server.provider}</div>
                    <div><span className="font-medium">API URL:</span> {server.apiUrl}</div>
                  </div>
                  
                  <div className="flex justify-between mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                    >
                      Usuários Conectados
                    </Button>
                    
                    {user?.isAdmin && (
                      <div className="space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum servidor encontrado</CardTitle>
            <CardDescription>
              Não há servidores cadastrados. {user?.isAdmin && "Clique em 'Novo Servidor' para adicionar."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}