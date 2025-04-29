import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ModulePermissions from "./module-permissions";
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

  React.useEffect(() => {
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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 h-[85vh] grid grid-rows-[auto_1fr_auto] overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="bg-background p-6">
          <DialogTitle className="text-xl">Permissões de Acesso</DialogTitle>
          <DialogDescription className="mt-1">
            Configure quais módulos o usuário <strong>{user.name || user.username}</strong> pode acessar no sistema.
          </DialogDescription>
        </div>
        
        {/* Conteúdo rolável */}
        <div className="overflow-auto p-6 pt-0">
          <ModulePermissions
            permissions={permissions}
            onChange={setPermissions}
          />
        </div>
        
        {/* Rodapé fixo */}
        <div className="bg-background p-6 border-t flex items-center justify-end gap-2">
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
      </DialogContent>
    </Dialog>
  );
}