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
        phoneNumberId: ''
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

  // Função para submeter o formulário
  const onSubmit = (values: MetaConnectionFormValues) => {
    connectMutation.mutate(values);
  };

  // Handler para desconectar
  const handleDisconnect = () => {
    if (confirm('Tem certeza que deseja desconectar do WhatsApp Meta API?')) {
      disconnectMutation.mutate();
    }
  };

  const isConnected = connectionStatus?.connected === true;
  const isConnecting = connectMutation.isPending;
  const isDisconnecting = disconnectMutation.isPending;

  return (
    <div className="container mx-auto px-4 py-6">
      <PageTitle
        subtitle="Conecte diretamente com a API oficial da Meta para WhatsApp Business"
        actions={
          <a href="/conexoes" className="text-sm text-muted-foreground hover:text-primary">
            ← Voltar para conexões
          </a>
        }
      >
        WhatsApp Meta API
      </PageTitle>

      {isLoadingStatus ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span>Verificando status da conexão...</span>
        </div>
      ) : connectionError ? (
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Erro ao verificar conexão</AlertTitle>
          <AlertDescription>
            Não foi possível verificar o status da conexão. Por favor, tente novamente.
          </AlertDescription>
        </Alert>
      ) : null}

      {isConnected && (
        <Card className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-500 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-400">
                    WhatsApp Meta API Conectado
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Conexão direta com a API oficial da Meta para WhatsApp Business está ativa.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900"
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
            </div>

            {connectionStatus?.businessName && (
              <div className="mt-4 px-4 py-3 bg-white dark:bg-green-900/30 rounded-md">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nome do negócio</p>
                    <p className="font-medium">{connectionStatus.businessName}</p>
                  </div>
                  {connectionStatus.businessPhoneNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Número/Identificação</p>
                      <p className="font-medium">{connectionStatus.businessPhoneNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID do número de telefone</p>
                    <p className="font-medium">{connectionStatus.phoneNumberId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Versão da API</p>
                    <p className="font-medium">{connectionStatus.apiVersion || 'v18.0'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuração da API da Meta</CardTitle>
          <CardDescription>
            Configure a conexão direta com a API oficial da Meta para o WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Alert className="mb-4 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuração prévia necessária</AlertTitle>
              <AlertDescription>
                Antes de conectar, seu administrador deve configurar o token de acesso da Meta e o ID do negócio no servidor.
              </AlertDescription>
            </Alert>

            <h3 className="text-lg font-medium mb-2">Pré-requisitos:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-2 mb-4">
              <li>Conta no Meta Business (Meta for Developers)</li>
              <li>Aplicativo WhatsApp configurado no Meta for Developers</li>
              <li>Número de telefone verificado e aprovado pela Meta</li>
              <li>Token de acesso permanente configurado no servidor</li>
            </ul>

            <h3 className="text-lg font-medium mb-2">Como obter o ID do número:</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
              <li>Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium inline-flex items-center">Meta for Developers <ExternalLink className="h-3 w-3 ml-1" /></a></li>
              <li>Vá para seu aplicativo WhatsApp Business</li>
              <li>Na seção de configuração do WhatsApp, encontre seus números de telefone</li>
              <li>Copie o ID do número de telefone (formato numérico, ex: 01234567890123)</li>
            </ol>
          </div>

          <Separator className="my-6" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="phoneNumberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificação do número de telefone:</FormLabel>
                    <FormControl>
                      <Input placeholder="01234567890123" {...field} disabled={isConnected} />
                    </FormControl>
                    <FormDescription>
                      ID do número de telefone na plataforma Meta Business (formato numérico)
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
                    <FormLabel>Identificação da conta do WhatsApp Business:</FormLabel>
                    <FormControl>
                      <Input placeholder="12345678901234567" {...field} disabled={isConnected} />
                    </FormControl>
                    <FormDescription>
                      ID do negócio na plataforma Meta Business (Business Account ID)
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