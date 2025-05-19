import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Esquema de validação para o formulário
const webhookFormSchema = z.object({
  webhookUrl: z.string().url({ message: 'Digite uma URL válida' }).refine((url) => {
    // Não permitir URLs que contenham localhost ou 127.0.0.1
    return !url.includes('localhost') && !url.includes('127.0.0.1');
  }, {
    message: 'A URL não pode ser um endereço local (localhost)'
  })
});

// Tipagem para os valores do formulário
type WebhookFormValues = z.infer<typeof webhookFormSchema>;

export function WebhookConfig() {
  const [isActivating, setIsActivating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const { toast } = useToast();

  // Configuração do formulário com react-hook-form e zod
  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      webhookUrl: ''
    }
  });

  // Função para ativar todas as opções de webhook
  const handleActivateAll = async () => {
    try {
      setIsActivating(true);
      const response = await apiRequest('POST', '/api/evolution-webhook/activate-all');
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Sucesso',
          description: 'Todas as opções de webhook foram ativadas',
          variant: 'default'
        });
        console.log('Resposta da API:', data);
      } else {
        const errorData = await response.json();
        toast({
          title: 'Erro ao ativar webhook',
          description: errorData.message || 'Ocorreu um erro ao ativar as opções de webhook',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao ativar webhook:', error);
      toast({
        title: 'Erro ao ativar webhook',
        description: 'Ocorreu um erro ao ativar as opções de webhook',
        variant: 'destructive'
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Função para enviar o formulário
  const onSubmit = async (values: WebhookFormValues) => {
    try {
      setIsConfiguring(true);
      const response = await apiRequest('POST', '/api/evolution-webhook/set-url', values);
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Sucesso',
          description: 'URL do webhook configurada com sucesso',
          variant: 'default'
        });
        console.log('Resposta da API:', data);
      } else {
        const errorData = await response.json();
        toast({
          title: 'Erro ao configurar webhook',
          description: errorData.message || 'Ocorreu um erro ao configurar a URL do webhook',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
      toast({
        title: 'Erro ao configurar webhook',
        description: 'Ocorreu um erro ao configurar a URL do webhook',
        variant: 'destructive'
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configuração de Webhook da Evolution API</CardTitle>
        <CardDescription>
          Configure o webhook para receber notificações da Evolution API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">1. Ativar todas as opções de webhook</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Ativa todas as opções de webhook da instância, incluindo webhook_base64.
            </p>
            <Button 
              onClick={handleActivateAll} 
              disabled={isActivating}
              className="w-full sm:w-auto"
            >
              {isActivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                'Ativar Todas as Opções'
              )}
            </Button>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium">2. Configurar URL do Webhook</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Defina a URL que receberá as notificações da Evolution API.
              A URL não pode ser um endereço local (localhost).
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL do Webhook</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://sua-url-de-webhook.com/webhook" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Digite a URL completa que receberá as notificações.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isConfiguring}>
                  {isConfiguring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    'Configurar URL'
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          <strong>Importante:</strong> A URL do webhook precisa ser acessível pela internet para que 
          a Evolution API possa enviar notificações.
        </p>
      </CardFooter>
    </Card>
  );
}