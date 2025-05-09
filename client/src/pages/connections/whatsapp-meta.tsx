import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, ExternalLink, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import PageTitle from '@/components/ui/page-title';
import { ToastAction } from '@/components/ui/toast';

// Schema de validação para o formulário de conexão Meta API
const metaConnectionSchema = z.object({
  phoneNumberId: z.string()
    .min(10, { message: 'ID do número de telefone deve ter pelo menos 10 caracteres' })
    .max(50, { message: 'ID do número de telefone não pode exceder 50 caracteres' }),
  businessId: z.string()
    .min(5, { message: 'ID do negócio deve ter pelo menos 5 caracteres' })
    .max(50, { message: 'ID do negócio não pode exceder 50 caracteres' })
});

// Tipo para valores do formulário
type MetaConnectionFormValues = z.infer<typeof metaConnectionSchema>;

// Página de conexão com WhatsApp Cloud API (Meta)
const WhatsAppMetaPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  // Verifica o status da conexão
  const {
    data: connectionStatus,
    isLoading: isLoadingStatus,
    error: connectionError,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['/api/meta-connections/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/meta-connections/status');
      const data = await response.json();
      return data;
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos quando a página está aberta
  });

  // Mutation para conectar com a API da Meta
  const connectMutation = useMutation({
    mutationFn: async (values: MetaConnectionFormValues) => {
      const response = await apiRequest('POST', '/api/meta-connections/connect', values);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Conexão estabelecida',
        description: 'Conexão direta com WhatsApp Meta API configurada com sucesso!',
        variant: 'default',
      });
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/meta-connections/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Não foi possível conectar ao WhatsApp Meta API.',
        variant: 'destructive',
        action: (
          <ToastAction altText="Configurar" onClick={() => navigate('/configuracoes')}>
            Configurar Token
          </ToastAction>
        ),
      });
    }
  });

  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/meta-connections/disconnect');
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Desconectado',
        description: 'Conexão com WhatsApp Meta API removida com sucesso.',
        variant: 'default',
      });
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/meta-connections/status'] });
      form.reset({
        phoneNumberId: '',
        businessId: ''
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao desconectar',
        description: error.message || 'Não foi possível desconectar do WhatsApp Meta API.',
        variant: 'destructive',
      });
    }
  });

  // Formulário para conexão
  const form = useForm<MetaConnectionFormValues>({
    resolver: zodResolver(metaConnectionSchema),
    defaultValues: {
      phoneNumberId: '',
      businessId: ''
    },
  });

  // Efeito para preencher formulário com dados existentes
  useEffect(() => {
    if (connectionStatus?.connected && connectionStatus?.phoneNumberId) {
      form.setValue('phoneNumberId', connectionStatus.phoneNumberId);
    }
    if (connectionStatus?.businessId) {
      form.setValue('businessId', connectionStatus.businessId);
    }
    setIsLoading(false);
  }, [connectionStatus, form]);

  // Funções de submit do formulário
  const onSubmit = (data: MetaConnectionFormValues) => {
    connectMutation.mutate(data);
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  // Estados para exibição condicional
  const isConnected = connectionStatus?.connected || false;
  const isConnecting = connectMutation.isPending;
  const isDisconnecting = disconnectMutation.isPending;
  const hasError = !!connectionError;

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
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          As credenciais para uso da API do WhatsApp agora estão configuradas na página de Configurações - 
          Integrações. Acesse essa área para configurar seu token de acesso e ID do negócio.
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader className="space-y-1">
          <CardTitle>WhatsApp Business Cloud API</CardTitle>
          <CardDescription>
            Conexão direta com a API de WhatsApp Business da Meta (Facebook)
          </CardDescription>
          <CardDescription>
            <Button variant="link" className="p-0" onClick={() => navigate('/configuracoes')}>
              Configurar credenciais em Configurações - Integrações
              <ExternalLink className="ml-1 h-4 w-4" />
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {hasError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>
                Não foi possível verificar o status da conexão. Verifique se seu token de acesso está configurado
                corretamente na página de Configurações - Integrações.
              </AlertDescription>
            </Alert>
          ) : isLoading || isLoadingStatus ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isConnected ? (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 mb-4">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Conectado</AlertTitle>
              <AlertDescription>
                Sua conta está conectada ao WhatsApp Business Cloud API. 
                Número de telefone: {connectionStatus?.phoneNumberId}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 mb-4">
              <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle>Não conectado</AlertTitle>
              <AlertDescription>
                Preencha o ID do número de telefone para conectar seu WhatsApp Business Cloud API.
                Você pode encontrar essas informações no seu painel do WhatsApp Business.
              </AlertDescription>
            </Alert>
          )}

          {/* Status da conexão */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Status da Conexão</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? (
                  <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" /> Conectado
                  </span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> Não conectado
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Método de Conexão</h4>
              <p className="text-sm text-muted-foreground">WhatsApp Business Cloud API (Meta)</p>
            </div>
          </div>

          <div className="mt-6">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate('/configuracoes')}
            >
              Ir para Configurações - Integrações
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <Separator className="my-6" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="phoneNumberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do Número de Telefone (Phone Number ID)</FormLabel>
                    <FormControl>
                      <Input placeholder="Exemplo: 123456789012345" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID do número de telefone do WhatsApp Business. Você pode encontrar este ID no 
                      painel da API Business do WhatsApp.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do Negócio (Business ID)</FormLabel>
                    <FormControl>
                      <Input placeholder="Exemplo: 123456789" {...field} />
                    </FormControl>
                    <FormDescription>
                      ID da sua conta de negócios no WhatsApp Business. Este ID é necessário para
                      consultar templates de mensagem e outros recursos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          {!isConnected ? (
            <Button 
              onClick={form.handleSubmit(onSubmit)} 
              className="w-full md:w-auto" 
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar ao WhatsApp Meta API'
              )}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="w-full md:w-auto" 
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Desconectar
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default WhatsAppMetaPage;