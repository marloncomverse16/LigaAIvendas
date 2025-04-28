import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadRecommendation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Lightbulb, ArrowUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function LeadRecommendations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Buscar recomendações de leads
  const { 
    data: recommendations, 
    isLoading,
    isError,
    refetch
  } = useQuery<LeadRecommendation[]>({
    queryKey: ["/api/lead-recommendations"],
  });

  // Mutar o status da recomendação
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/lead-recommendations/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-recommendations'] });
      toast({
        title: "Status atualizado",
        description: "O status da recomendação foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da recomendação.",
        variant: "destructive",
      });
    },
  });

  // Gerar novas recomendações
  const generateRecommendationsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/lead-recommendations/generate");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-recommendations'] });
      toast({
        title: "Recomendações geradas",
        description: "Novas recomendações de leads foram geradas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar novas recomendações.",
        variant: "destructive",
      });
    },
  });

  // Função para retornar a cor baseada na pontuação
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  // Função para obter o texto do badge de status
  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'concluido':
        return {
          variant: "success",
          text: "Concluído"
        };
      case 'em_andamento':
        return {
          variant: "warning",
          text: "Em andamento"
        };
      default:
        return {
          variant: "default",
          text: "Pendente"
        };
    }
  };

  if (isError) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-card-foreground">Recomendações de Leads</h2>
          <Button size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Não foi possível carregar as recomendações.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-card-foreground">Recomendações de Leads</h2>
          <Badge variant="outline" className="ml-2">
            {recommendations?.length || 0}
          </Badge>
        </div>
        
        <Button 
          size="sm" 
          onClick={() => generateRecommendationsMutation.mutate()}
          disabled={generateRecommendationsMutation.isPending}
        >
          {generateRecommendationsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Lightbulb className="mr-2 h-4 w-4" />
              Gerar recomendações
            </>
          )}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-muted-foreground">Carregando recomendações...</p>
        </div>
      ) : recommendations?.length ? (
        <div className="space-y-4">
          {recommendations.map((recommendation) => (
            <div key={recommendation.id} className="flex items-start justify-between space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="flex items-start space-x-3 flex-1">
                <div className={cn("p-2 rounded-full bg-blue-100 dark:bg-blue-900", getScoreColor(recommendation.score))}>
                  <ArrowUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <p className="font-medium text-card-foreground">Lead #{recommendation.leadId}</p>
                    <Badge className="ml-2" variant={getStatusBadgeProps(recommendation.status || 'pendente').variant}>
                      {getStatusBadgeProps(recommendation.status || 'pendente').text}
                    </Badge>
                    <span className={cn("ml-2 text-sm font-medium", getScoreColor(recommendation.score))}>
                      {recommendation.score} pontos
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{recommendation.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(recommendation.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 items-center">
                {recommendation.status === 'pendente' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: recommendation.id, status: 'em_andamento' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Iniciar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => updateStatusMutation.mutate({ id: recommendation.id, status: 'concluido' })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Concluir
                    </Button>
                  </>
                )}
                
                {recommendation.status === 'em_andamento' && (
                  <Button 
                    size="sm"
                    variant="default"
                    onClick={() => updateStatusMutation.mutate({ id: recommendation.id, status: 'concluido' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    Concluir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Nenhuma recomendação de lead encontrada.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => generateRecommendationsMutation.mutate()}
            disabled={generateRecommendationsMutation.isPending}
          >
            {generateRecommendationsMutation.isPending ? "Gerando..." : "Gerar recomendações"}
          </Button>
        </div>
      )}
    </div>
  );
}