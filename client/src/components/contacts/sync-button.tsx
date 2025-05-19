import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function SyncContactsButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Função para sincronizar contatos
  const handleSync = async () => {
    if (isSyncing) return; // Evitar múltiplas requisições

    setIsSyncing(true);
    
    try {
      // Tentar primeiro o endpoint com POST otimizado para Evolution API v3.7
      try {
        const response = await apiRequest("POST", "/api/evolution-contacts/sync");
        const data = await response.json();
        
        if (data.success) {
          // Atualizar a lista de contatos no cliente
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
          
          toast({
            title: "Sincronização concluída!",
            description: `${data.importResults.created} contatos importados do WhatsApp.`,
          });
          return;
        } else {
          throw new Error(data.message || "Falha na sincronização");
        }
      } catch (error) {
        console.error("Erro ao usar endpoint evolution-contacts:", error);
        
        // Fallback para o endpoint padrão
        const response = await apiRequest("POST", "/api/contacts/sync");
        const data = await response.json();
        
        if (data.success) {
          // Atualizar a lista de contatos no cliente
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
          
          toast({
            title: "Sincronização concluída!",
            description: `${data.importResults.created} contatos importados do WhatsApp.`,
          });
        } else {
          throw new Error(data.message || "Falha na sincronização");
        }
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar contatos:", error);
      
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível sincronizar os contatos do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button 
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sincronizando...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sincronizar com WhatsApp
        </>
      )}
    </Button>
  );
}