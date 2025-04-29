import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User } from "@shared/schema";

interface UserPermissionsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserPermissionsDialog({
  user,
  open,
  onOpenChange,
}: UserPermissionsDialogProps) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState({
    accessDashboard: user?.accessDashboard ?? true,
    accessLeads: user?.accessLeads ?? true,
    accessProspecting: user?.accessProspecting ?? true,
    accessAiAgent: user?.accessAiAgent ?? true,
    accessWhatsapp: user?.accessWhatsapp ?? true,
    accessContacts: user?.accessContacts ?? true,
    accessScheduling: user?.accessScheduling ?? true,
    accessReports: user?.accessReports ?? true,
    accessSettings: user?.accessSettings ?? true,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) return null;
      
      const res = await apiRequest("PUT", `/api/admin/users/${user.id}`, permissions);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissões atualizadas com sucesso",
        description: "As permissões de acesso do usuário foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
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

  if (!user || !open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full flex flex-col h-[90vh] overflow-hidden">
        {/* Cabeçalho (fixo) */}
        <div className="p-6 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold">Permissões de Acesso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure quais módulos o usuário <strong>{user.name || user.username}</strong> pode acessar no sistema.
          </p>
          <div className="flex gap-2 mt-4">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={enableAll}
              className="flex items-center gap-1"
            >
              <Check className="h-4 w-4" /> Habilitar Todos
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={disableAll}
              className="flex items-center gap-1"
            >
              <X className="h-4 w-4" /> Desabilitar Todos
            </Button>
          </div>
        </div>
        
        {/* Área de conteúdo com rolagem */}
        <div className="overflow-y-auto flex-1 p-6" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {moduleItems.map((item) => (
              <Card 
                key={item.key} 
                className={`${permissions[item.key] ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label 
                      htmlFor={item.key} 
                      className="font-medium cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    <Switch
                      id={item.key}
                      checked={permissions[item.key]}
                      onCheckedChange={() => handleToggle(item.key)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div className="flex items-center mt-2 text-xs">
                    <div className={`h-2 w-2 rounded-full mr-2 ${permissions[item.key] ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span>{permissions[item.key] ? 'Ativado' : 'Desativado'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Rodapé (fixo) */}
        <div className="p-6 border-t flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
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
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-background"></span>
                Salvando...
              </>
            ) : (
              "Salvar Permissões"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}