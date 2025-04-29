import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ModulePermissionsProps {
  permissions: {
    accessDashboard: boolean;
    accessLeads: boolean;
    accessProspecting: boolean;
    accessAiAgent: boolean;
    accessWhatsapp: boolean;
    accessContacts: boolean;
    accessScheduling: boolean;
    accessReports: boolean;
    accessSettings: boolean;
  };
  onChange: (permissions: any) => void;
}

export default function ModulePermissions({ permissions, onChange }: ModulePermissionsProps) {
  const [values, setValues] = useState(permissions);

  const handleChange = (name: string, checked: boolean) => {
    const newValues = { ...values, [name]: checked };
    setValues(newValues);
    onChange(newValues);
  };

  const setAllPermissions = (enabled: boolean) => {
    const newValues = {
      accessDashboard: enabled,
      accessLeads: enabled,
      accessProspecting: enabled,
      accessAiAgent: enabled,
      accessWhatsapp: enabled,
      accessContacts: enabled,
      accessScheduling: enabled,
      accessReports: enabled,
      accessSettings: enabled,
    };
    setValues(newValues);
    onChange(newValues);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Controle de Acesso</h3>
        <p className="text-blue-700 mb-4">
          Configure quais módulos este usuário pode acessar no sistema. 
          Você pode ativar ou desativar módulos individualmente.
        </p>
        
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm"
            className="mr-2"
            onClick={() => setAllPermissions(true)}
          >
            Ativar Todos
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setAllPermissions(false)}
          >
            Desativar Todos
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-blue-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>
                  <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Dashboard</h4>
                <p className="text-sm text-muted-foreground">Acesso à página inicial e dashboard</p>
              </div>
            </div>
            <Switch
              checked={values.accessDashboard}
              onCheckedChange={(checked) => handleChange("accessDashboard", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center text-green-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Leads</h4>
                <p className="text-sm text-muted-foreground">Gerenciamento de leads e contatos</p>
              </div>
            </div>
            <Switch
              checked={values.accessLeads}
              onCheckedChange={(checked) => handleChange("accessLeads", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center text-amber-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Prospecção</h4>
                <p className="text-sm text-muted-foreground">Ferramentas de busca e prospecção</p>
              </div>
            </div>
            <Switch
              checked={values.accessProspecting}
              onCheckedChange={(checked) => handleChange("accessProspecting", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center text-purple-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135Z"/>
                  <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v.5A4.5 4.5 0 0 0 5.5 17h5a4.5 4.5 0 0 0 4.5-4.5V12a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866ZM14 7.5V13a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 2 13V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5Z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Agente IA</h4>
                <p className="text-sm text-muted-foreground">Configurações do assistente virtual</p>
              </div>
            </div>
            <Switch
              checked={values.accessAiAgent}
              onCheckedChange={(checked) => handleChange("accessAiAgent", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center text-green-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">WhatsApp</h4>
                <p className="text-sm text-muted-foreground">Conexão e comunicação via WhatsApp</p>
              </div>
            </div>
            <Switch
              checked={values.accessWhatsapp}
              onCheckedChange={(checked) => handleChange("accessWhatsapp", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-blue-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6 1v3H1V1h5zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1H1zm14 12v3h-5v-3h5zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-5zM6 8v7H1V8h5zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H1zm14-6v7h-5V1h5zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1h-5z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Contatos</h4>
                <p className="text-sm text-muted-foreground">Gerenciamento da lista de contatos</p>
              </div>
            </div>
            <Switch
              checked={values.accessContacts}
              onCheckedChange={(checked) => handleChange("accessContacts", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center text-red-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Agendamentos</h4>
                <p className="text-sm text-muted-foreground">Calendário e agendamento de eventos</p>
              </div>
            </div>
            <Switch
              checked={values.accessScheduling}
              onCheckedChange={(checked) => handleChange("accessScheduling", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 0h1v15h15v1H0V0Zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5Z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Relatórios</h4>
                <p className="text-sm text-muted-foreground">Estatísticas e análises de desempenho</p>
              </div>
            </div>
            <Switch
              checked={values.accessReports}
              onCheckedChange={(checked) => handleChange("accessReports", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm">
            <div className="flex items-center">
              <span className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-800 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                </svg>
              </span>
              <div>
                <h4 className="font-medium">Configurações</h4>
                <p className="text-sm text-muted-foreground">Ajustes gerais do sistema</p>
              </div>
            </div>
            <Switch
              checked={values.accessSettings}
              onCheckedChange={(checked) => handleChange("accessSettings", checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}