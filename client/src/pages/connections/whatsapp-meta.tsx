/**
 * PÁGINA DESCONTINUADA
 * A configuração da Meta API foi movida para Configurações > Integrações
 */
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';

// Página de redirecionamento para configuração da Meta API
const WhatsAppMetaPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Redirecionar automaticamente após alguns segundos
  useEffect(() => {
    // Exibir mensagem de redirecionamento
    toast({
      title: 'Página movida',
      description: 'A configuração do WhatsApp Meta API agora está em Configurações - Integrações',
      duration: 5000,
    });

    // Redirecionar após 3 segundos
    const redirectTimer = setTimeout(() => {
      navigate('/configuracoes');
    }, 3000);

    // Limpar o timer se o componente for desmontado
    return () => clearTimeout(redirectTimer);
  }, [navigate, toast]);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageTitle
        subtitle="Integração com a API oficial da Meta para WhatsApp Business"
        actions={
          <Button
            variant="link"
            onClick={() => navigate('/conexoes')}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← Voltar para conexões
          </Button>
        }
      >
        WhatsApp Meta API
      </PageTitle>

      <Alert className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle>Página movida</AlertTitle>
        <AlertDescription>
          A configuração do WhatsApp Meta API agora está disponível na página de Configurações - 
          Integrações. Você será redirecionado automaticamente em alguns segundos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Aviso de redirecionamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Para melhorar a experiência do usuário, consolidamos todas as configurações de API
            em um único local. A página de configuração do WhatsApp Meta API foi movida para:
          </p>

          <div className="bg-muted p-3 rounded-md font-medium">
            Configurações - Integrações - WhatsApp Meta API
          </div>

          <p className="text-muted-foreground">
            Nessa nova localização, você poderá gerenciar suas configurações da API
            do WhatsApp da Meta, incluindo token de acesso, ID do negócio e telefones.
          </p>

          <Button 
            onClick={() => navigate('/configuracoes')}
            className="w-full mt-2"
          >
            Ir para página de Configurações
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppMetaPage;