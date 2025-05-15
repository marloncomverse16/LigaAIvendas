import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X, ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useLocation, useRoute, Link } from "wouter";

export default function UserPermissionsPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/admin-users/permissions/:userId");
  const [, navigate] = useLocation();
  const userId = params?.userId;
  
  const [permissions, setPermissions] = useState({
    accessDashboard: true,
    accessLeads: true,
    accessProspecting: true,
    accessAiAgent: true,
    accessWhatsapp: true,
    accessContacts: true,
    accessScheduling: true,
    accessReports: true,
    accessSettings: true,
  });

  // Buscar dados do usuário
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: [`/api/admin/users/${userId}`],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest("GET", `/api/admin/users/${userId}`);
      const data = await res.json();
      return data;
    },
    enabled: !!userId
  });

  // Atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return null;
      
      const res = await apiRequest("PUT", `/api/admin/users/${userId}`, permissions);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissões atualizadas com sucesso",
        description: "As permissões de acesso do usuário foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      navigate("/admin-users");
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updatePermissionsMutation.mutate();
  };

  const handleToggle = (module: keyof typeof permissions) => {
    setPermissions({
      ...permissions,
      [module]: !permissions[module],
    });
  };

  const enableAll = () => {
    setPermissions({
      accessDashboard: true,
      accessLeads: true,
      accessProspecting: true,
      accessAiAgent: true,
      accessWhatsapp: true,
      accessContacts: true,
      accessScheduling: true,
      accessReports: true,
      accessSettings: true,
    });
  };

  const disableAll = () => {
    setPermissions({
      accessDashboard: false,
      accessLeads: false,
      accessProspecting: false,
      accessAiAgent: false,
      accessWhatsapp: false,
      accessContacts: false,
      accessScheduling: false,
      accessReports: false,
      accessSettings: false,
    });
  };

  useEffect(() => {
    if (user) {
      setPermissions({
        accessDashboard: user.accessDashboard ?? true,
        accessLeads: user.accessLeads ?? true,
        accessProspecting: user.accessProspecting ?? true,
        accessAiAgent: user.accessAiAgent ?? true,
        accessWhatsapp: user.accessWhatsapp ?? true,
        accessContacts: user.accessContacts ?? true,
        accessScheduling: user.accessScheduling ?? true,
        accessReports: user.accessReports ?? true,
        accessSettings: user.accessSettings ?? true,
      });
    }
  }, [user]);

  const moduleItems = [
    { key: "accessDashboard" as const, label: "Dashboard", description: "Acesso à página principal" },
    { key: "accessLeads" as const, label: "Leads", description: "Visualização e gestão de leads" },
    { key: "accessProspecting" as const, label: "Prospecção", description: "Ferramentas de prospecção" },
    { key: "accessAiAgent" as const, label: "Agente IA", description: "Funcionalidades do assistente de IA" },
    { key: "accessWhatsapp" as const, label: "Conexão WhatsApp", description: "Conexão com WhatsApp" },
    { key: "accessContacts" as const, label: "Contatos", description: "Gerenciamento de contatos" },
    { key: "accessScheduling" as const, label: "Agendamentos", description: "Sistema de calendário" },
    { key: "accessReports" as const, label: "Relatórios", description: "Estatísticas e relatórios" },
    { key: "accessSettings" as const, label: "Configurações", description: "Configurações do sistema" },
  ];

  if (isLoadingUser) {
    return (
      <div className="container mx-auto py-10 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Usuário não encontrado</h2>
          <p className="text-muted-foreground mt-2">O usuário solicitado não foi encontrado ou você não tem permissão para acessá-lo.</p>
          <Button className="mt-4" asChild>
            <Link href="/admin-users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para lista de usuários
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin-users">
            <Button variant="outline" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-4">Permissões de Acesso</h1>
          <p className="text-muted-foreground mt-1">
            Configure quais módulos o usuário <strong>{user.name || user.username}</strong> pode acessar no sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={enableAll}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4" /> Habilitar Todos
          </Button>
          <Button 
            variant="outline" 
            onClick={disableAll}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" /> Desabilitar Todos
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updatePermissionsMutation.isPending}
          >
            {updatePermissionsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Permissões"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {moduleItems.map((item) => (
          <Card 
            key={item.key} 
            className={permissions[item.key] ? 'border-primary/40 bg-primary/5' : ''}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                {item.label}
                <Switch
                  id={item.key}
                  checked={permissions[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                />
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm font-medium">
                <div className={`h-3 w-3 rounded-full mr-2 ${permissions[item.key] ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>{permissions[item.key] ? 'Ativado' : 'Desativado'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-6 flex justify-end">
        <Button 
          variant="outline" 
          onClick={() => navigate("/admin-users")}
          className="mr-2"
          disabled={updatePermissionsMutation.isPending}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          disabled={updatePermissionsMutation.isPending}
        >
          {updatePermissionsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Permissões"
          )}
        </Button>
      </div>
    </div>
  );
}