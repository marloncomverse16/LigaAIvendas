import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface ModulePermissions {
  accessDashboard: boolean;
  accessLeads: boolean;
  accessProspecting: boolean;
  accessAiAgent: boolean;
  accessWhatsapp: boolean;
  accessContacts: boolean;
  accessScheduling: boolean;
  accessReports: boolean;
  accessSettings: boolean;
}

interface ModulePermissionsProps {
  permissions: ModulePermissions;
  onChange: (permissions: ModulePermissions) => void;
}

export default function ModulePermissions({ permissions, onChange }: ModulePermissionsProps) {
  const handleToggle = (module: keyof ModulePermissions) => {
    onChange({
      ...permissions,
      [module]: !permissions[module],
    });
  };

  const enableAll = () => {
    onChange({
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
    onChange({
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

  const moduleItems = [
    { key: "accessDashboard" as const, label: "Dashboard" },
    { key: "accessLeads" as const, label: "Leads" },
    { key: "accessProspecting" as const, label: "Prospecção" },
    { key: "accessAiAgent" as const, label: "Agente IA" },
    { key: "accessWhatsapp" as const, label: "WhatsApp" },
    { key: "accessContacts" as const, label: "Contatos" },
    { key: "accessScheduling" as const, label: "Agendamentos" },
    { key: "accessReports" as const, label: "Relatórios" },
    { key: "accessSettings" as const, label: "Configurações" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Permissões de Acesso</CardTitle>
        <CardDescription>
          Configure quais módulos este usuário pode acessar no sistema.
        </CardDescription>
        <div className="flex gap-2 mt-2">
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
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {moduleItems.map((item) => (
            <div key={item.key} className="flex items-center space-x-2 border rounded-md p-3 shadow-sm">
              <Switch
                id={item.key}
                checked={permissions[item.key]}
                onCheckedChange={() => handleToggle(item.key)}
              />
              <Label 
                htmlFor={item.key} 
                className="flex-1 cursor-pointer"
              >
                {item.label}
              </Label>
              <div className={`h-3 w-3 rounded-full ${permissions[item.key] ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}