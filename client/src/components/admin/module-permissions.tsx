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
    { key: "accessDashboard" as const, label: "Dashboard", description: "Acesso à página principal" },
    { key: "accessLeads" as const, label: "CRM de Leads", description: "Visualização e gestão de leads" },
    { key: "accessProspecting" as const, label: "Prospecção", description: "Ferramentas de prospecção" },
    { key: "accessAiAgent" as const, label: "Agente de IA", description: "Funcionalidades do assistente de IA" },
    { key: "accessWhatsapp" as const, label: "Conexões", description: "Conexões WhatsApp e envio de mensagens" },
    { key: "accessContacts" as const, label: "Contatos", description: "Gerenciamento de contatos" },
    { key: "accessScheduling" as const, label: "Agendamentos", description: "Sistema de calendário" },
    { key: "accessReports" as const, label: "Relatórios", description: "Estatísticas e relatórios" },
    { key: "accessSettings" as const, label: "Configurações", description: "Configurações do sistema" },
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
            <div 
              key={item.key} 
              className={`flex flex-col border rounded-md p-4 shadow-sm transition-all ${
                permissions[item.key] ? 'border-green-500/50 bg-green-50/20' : 'border-gray-200'
              }`}
            >
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}