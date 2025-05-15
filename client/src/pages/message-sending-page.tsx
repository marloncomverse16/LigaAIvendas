import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCcw, Clock, Send, Trash2, Edit, Plus, MessageSquare, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "../lib/queryClient";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";

// Definição do esquema de validação para criação de templates
const createTemplateSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  content: z.string().min(10, "Conteúdo deve ter pelo menos 10 caracteres"),
  tags: z.string().optional(),
});

// Definição do esquema de validação para criação de envios
const createSendingSchema = z.object({
  whatsappConnectionType: z.enum(["qrcode", "meta"]).default("qrcode"),
  searchId: z.number().optional().nullable(),
  templateId: z.number().optional().nullable(),
  customMessage: z.string().optional(),
  quantity: z.number().min(1, "A quantidade mínima é 1").max(1000, "A quantidade máxima é 1000"),
  scheduledAt: z.date().optional().nullable(),
  aiLearningEnabled: z.boolean().default(false),
  aiNotes: z.string().optional(),
});

// Componente auxiliar para formatar data
const FormattedDate = ({ date, showTime = false }) => {
  if (!date) return <span>-</span>;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return <span>Data inválida</span>;
    
    const options = {
      locale: ptBR,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(showTime && { hour: "2-digit", minute: "2-digit" }),
    };
    
    return <span>{format(dateObj, showTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: ptBR })}</span>;
  } catch (error) {
    console.error("Erro ao formatar data:", error);
    return <span>Data inválida</span>;
  }
};

// Componente para o gerenciamento de templates de mensagens
const TemplateManager = () => {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  
  const form = useForm({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      title: "",
      content: "",
      tags: "",
    },
  });
  
  // Busca os templates existentes
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/message-templates"],
    queryFn: async () => {
      const res = await fetch("/api/message-templates");
      if (!res.ok) throw new Error("Falha ao carregar templates");
      return res.json();
    },
  });
  
  // Mutação para criar um novo template
  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/message-templates", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Template criado com sucesso",
        variant: "default",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para atualizar um template existente
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/message-templates/${selectedTemplateId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Template atualizado com sucesso",
        variant: "default",
      });
      form.reset();
      setIsEditMode(false);
      setSelectedTemplateId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para excluir um template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/message-templates/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      toast({
        title: "Template excluído com sucesso",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função para carregar os dados de um template para edição
  const handleEditTemplate = (template) => {
    setSelectedTemplateId(template.id);
    setIsEditMode(true);
    form.setValue("title", template.title);
    form.setValue("content", template.content);
    form.setValue("tags", template.tags || "");
  };
  
  // Função para lidar com o envio do formulário
  const onSubmit = (data) => {
    if (isEditMode) {
      updateTemplateMutation.mutate(data);
    } else {
      createTemplateMutation.mutate(data);
    }
  };
  
  // Função para cancelar a edição
  const cancelEdit = () => {
    setIsEditMode(false);
    setSelectedTemplateId(null);
    form.reset();
  };
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? "Editar Template" : "Novo Template"}</CardTitle>
            <CardDescription>
              {isEditMode 
                ? "Edite os detalhes do template selecionado"
                : "Crie um novo template para mensagens"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Primeiro contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteúdo</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite o conteúdo da mensagem..." 
                          className="min-h-[150px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (separadas por vírgula)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: vendas, primeiro contato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-2">
                  <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
                    {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    ) : isEditMode ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {isEditMode ? "Salvar Alterações" : "Criar Template"}
                  </Button>
                  
                  {isEditMode && (
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Templates Disponíveis</CardTitle>
            <CardDescription>
              Templates de mensagens que podem ser usados nos envios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.title}</TableCell>
                        <TableCell>
                          {template.tags ? template.tags.split(',').map((tag, i) => (
                            <Badge key={i} variant="outline" className="mr-1">
                              {tag.trim()}
                            </Badge>
                          )) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm("Tem certeza que deseja excluir este template?")) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum template encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Componente para criação de envio de mensagens
const CreateSendingForm = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [useTemplate, setUseTemplate] = useState(true);
  
  // Buscando as pesquisas de prospecção existentes
  const { data: searches, isLoading: isLoadingSearches } = useQuery({
    queryKey: ["/api/prospecting/searches"],
    queryFn: async () => {
      const res = await fetch("/api/prospecting/searches");
      if (!res.ok) throw new Error("Falha ao carregar pesquisas");
      return res.json();
    },
  });
  
  // Buscando os templates de mensagens
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["/api/message-templates"],
    queryFn: async () => {
      const res = await fetch("/api/message-templates");
      if (!res.ok) throw new Error("Falha ao carregar templates");
      return res.json();
    },
  });
  
  const form = useForm({
    resolver: zodResolver(createSendingSchema),
    defaultValues: {
      whatsappConnectionType: "qrcode",
      searchId: null,
      templateId: null,
      customMessage: "",
      quantity: 10,
      scheduledAt: null,
      aiLearningEnabled: false,
      aiNotes: "",
    },
  });
  
  // Função para obter o webhook de envio de mensagens do servidor
  const getMessageSendingWebhook = async (searchId: number) => {
    try {
      // Primeiro obtemos o servidor associado à pesquisa
      const searchRes = await fetch(`/api/prospecting/searches/${searchId}`);
      if (!searchRes.ok) throw new Error("Falha ao obter informações da pesquisa");
      const searchData = await searchRes.json();
      
      // Obtemos o servidor associado ao usuário
      const userServersRes = await fetch("/api/user-servers/default");
      if (!userServersRes.ok) throw new Error("Falha ao obter servidor padrão");
      const userServerData = await userServersRes.json();
      
      // Obtemos os detalhes do servidor
      const serverRes = await fetch(`/api/servers/${userServerData.serverId}`);
      if (!serverRes.ok) throw new Error("Falha ao obter detalhes do servidor");
      const serverData = await serverRes.json();
      
      return serverData.messageSendingWebhookUrl;
    } catch (error) {
      console.error("Erro ao obter webhook:", error);
      return null;
    }
  };
  
  // Mutação para envio via WhatsApp QR Code (webhook)
  const sendViaWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      // Obter o webhook do servidor
      const webhookUrl = await getMessageSendingWebhook(data.searchId);
      
      if (!webhookUrl) {
        throw new Error("Webhook de envio de mensagens não configurado para este servidor. Verifique a configuração em Gerenciamento de Servidores.");
      }
      
      // Criar o registro de histórico de envio
      const historyRes = await apiRequest("POST", "/api/message-sending-history", {
        userId: data.userId,
        searchId: data.searchId,
        templateId: null,
        templateName: null,
        messageText: data.customMessage || (data.templateId ? `Template ID: ${data.templateId}` : ""),
        connectionType: "whatsapp_qr",
        totalRecipients: data.quantity || 0,
        status: "pendente",
        webhookUrl
      });
      
      // Obtém o ID do registro de envio criado
      const historyData = await historyRes.json();
      console.log("Registro de histórico criado:", historyData);
      
      // Agora enviar para o webhook incluindo o sendingId obrigatório como parâmetro GET
      // Construir URL com parâmetros de query para o método GET
      const params = new URLSearchParams({
        sendingId: historyData.id.toString(), // Campo obrigatório para o webhook
        searchId: data.searchId.toString(),
        message: data.customMessage || "",
        templateId: data.templateId ? data.templateId.toString() : "",
        quantity: data.quantity ? data.quantity.toString() : "10",
        apiUrl: window.location.origin
      });
      
      const webhookUrlWithParams = `${webhookUrl}?${params.toString()}`;
      console.log("Enviando webhook via GET:", webhookUrlWithParams);
      
      const webhookRes = await fetch(webhookUrlWithParams, {
        method: "GET"
      });
      
      if (!webhookRes.ok) {
        throw new Error(`Erro ao enviar para webhook: ${webhookRes.statusText}`);
      }
      
      return historyData;
    },
    onSuccess: () => {
      toast({
        title: "Envio via WhatsApp QR Code iniciado",
        description: "O envio foi iniciado e será processado pelo webhook configurado",
        variant: "default",
      });
      form.reset({
        whatsappConnectionType: "qrcode",
        searchId: null,
        templateId: null,
        customMessage: "",
        quantity: 10,
        scheduledAt: null,
        aiLearningEnabled: false,
        aiNotes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sendings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sending-history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar envio via WhatsApp QR Code",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para envio via WhatsApp Meta API (direto)
  const sendViaMetaApiMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.searchId) {
        throw new Error("Selecione uma pesquisa de prospecção para enviar as mensagens");
      }
      
      if (!data.templateId) {
        throw new Error("Selecione um template da Meta API para enviar as mensagens");
      }
      
      // Primeiro identificar o template selecionado
      const selectedTemplate = metaTemplates.find(t => t.id.toString() === data.templateId.toString());
      
      if (!selectedTemplate) {
        throw new Error("Template selecionado não encontrado");
      }
      
      // Criar o registro de histórico de envio
      const historyRes = await apiRequest("POST", "/api/message-sending-history", {
        userId: data.userId,
        searchId: data.searchId,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        messageText: null,
        connectionType: "whatsapp_meta_api",
        totalRecipients: data.quantity || 0,
        status: "pendente",
        webhookUrl: null
      });
      
      // Agora enviar diretamente via API
      const sendRes = await fetch(`/api/meta-direct-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: data.searchId,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          quantity: data.quantity
        })
      });
      
      if (!sendRes.ok) {
        const errorText = await sendRes.text();
        throw new Error(`Erro ao enviar mensagens: ${errorText}`);
      }
      
      return await historyRes.json();
    },
    onSuccess: () => {
      toast({
        title: "Envio via WhatsApp Meta API iniciado",
        description: "O envio direto via Meta API foi iniciado e será processado em segundo plano",
        variant: "default",
      });
      form.reset({
        whatsappConnectionType: "meta",
        searchId: null,
        templateId: null,
        customMessage: "",
        quantity: 10,
        scheduledAt: null,
        aiLearningEnabled: false,
        aiNotes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sendings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sending-history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar envio via WhatsApp Meta API",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutação para criar um novo envio (usa as mutações específicas acima)
  const createSendingMutation = useMutation({
    mutationFn: async (data: any) => {
      // Verificar se os campos obrigatórios estão preenchidos
      if (!data.searchId) {
        throw new Error("Selecione uma pesquisa de prospecção para enviar as mensagens");
      }
      
      // Se for WhatsApp QR Code
      if (data.whatsappConnectionType === "qrcode") {
        // Verificar se está usando template ou mensagem customizada
        if (useTemplate && !data.templateId) {
          throw new Error("Selecione um template para enviar as mensagens");
        } else if (!useTemplate && !data.customMessage) {
          throw new Error("Digite uma mensagem personalizada para enviar");
        }
        
        // Usar o webhook
        return sendViaWebhookMutation.mutateAsync(data);
      } 
      // Se for WhatsApp Meta API
      else if (data.whatsappConnectionType === "meta") {
        if (!data.templateId) {
          throw new Error("Selecione um template da Meta API para enviar as mensagens");
        }
        
        // Usar a API direta
        return sendViaMetaApiMutation.mutateAsync(data);
      }
      
      throw new Error("Tipo de conexão inválido");
    },
    onSuccess: () => {
      // Sucesso já tratado nas mutações específicas
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar envio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Estados para controlar os templates da Meta API
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [isLoadingMetaTemplates, setIsLoadingMetaTemplates] = useState(false);

  // Monitorar mudanças no interruptor de template/mensagem personalizada
  useEffect(() => {
    if (useTemplate) {
      form.setValue("customMessage", "");
    } else {
      form.setValue("templateId", null);
    }
  }, [useTemplate, form]);
  
  // Monitorar mudanças no tipo de conexão WhatsApp
  useEffect(() => {
    const connectionType = form.watch("whatsappConnectionType");
    
    // Se estiver usando a conexão Meta API
    if (connectionType === "meta") {
      // Desabilitar o aprendizado de IA para conexão Meta API
      form.setValue("aiLearningEnabled", false);
      
      // Forçar o uso de templates e desabilitar mensagem personalizada
      form.setValue("useTemplate", true);
      
      // Carregar templates da Meta API
      setIsLoadingMetaTemplates(true);
      setMetaTemplates([]); // Limpar templates anteriores
      
      console.log("Tentando carregar templates da Meta API");
      
      // Adicionando feedback visual de diagnóstico
      toast({
        title: "Carregando templates Meta API",
        description: "Verificando conexão...",
        variant: "default",
      });
      
      // Verificar primeiro se o usuário está conectado com a Meta API
      fetch("/api/user/meta-connections/status")
        .then(res => res.json())
        .then(statusData => {
          console.log("Status da conexão Meta:", statusData);
          
          if (!statusData.connected || !statusData.phoneNumberId) {
            throw new Error("Conexão com WhatsApp Cloud API (Meta) não configurada. Configure nas Configurações > WhatsApp Cloud API (Meta).");
          }
          
          toast({
            title: "Conexão Meta API OK",
            description: "Buscando templates disponíveis...",
            variant: "default",
          });
          
          // Tentar a rota direta otimizada para templates
          console.log("Tentando buscar templates via rota direta");
          return fetch("/api/meta-direct-templates");
        })
        .then(res => {
          console.log("Resposta da API de templates:", {
            url: res.url,
            status: res.status,
            ok: res.ok,
            statusText: res.statusText
          });
          
          if (!res.ok) {
            // Se a resposta não for OK, tentar a rota alternativa
            if (res.status === 404) {
              console.log("Rota direta não encontrada, tentando rota alternativa");
              return fetch("/api/meta-direct-templates");
            }
            
            return res.text().then(text => {
              console.error("Corpo da resposta de erro:", text);
              try {
                const errorObj = JSON.parse(text);
                return Promise.reject(new Error(errorObj.message || errorObj.error || "Falha ao carregar templates da Meta API"));
              } catch (e) {
                return Promise.reject(new Error("Falha ao carregar templates da Meta API: " + text));
              }
            });
          }
          
          return res.json();
        })
        .then(res => {
          // Verificar se é uma resposta HTTP (de uma segunda tentativa)
          if (res.url && res.status) {
            console.log("Processando resposta da segunda tentativa:", res);
            if (!res.ok) {
              return res.text().then(text => {
                try {
                  const errorObj = JSON.parse(text);
                  return Promise.reject(new Error(errorObj.message || errorObj.error || "Falha ao carregar templates da Meta API"));
                } catch (e) {
                  return Promise.reject(new Error("Falha ao carregar templates da Meta API: " + text));
                }
              });
            }
            return res.json();
          }
          return res; // Se já for os dados JSON, retorna diretamente
        })
        .then(data => {
          console.log("Templates da Meta API carregados com sucesso:", data);
          
          // Verificar se a resposta é um array ou tem uma propriedade 'templates'
          let templates = [];
          if (Array.isArray(data)) {
            templates = data;
          } else if (data && data.templates && Array.isArray(data.templates)) {
            templates = data.templates;
          } else if (data && typeof data === 'object') {
            // Em último caso, tentar extrair um array de alguma propriedade
            const possibleTemplatesArray = Object.values(data).find(val => Array.isArray(val));
            if (possibleTemplatesArray) {
              templates = possibleTemplatesArray;
            }
          }
          
          console.log("Templates processados:", templates);
          
          if (templates.length > 0) {
            setMetaTemplates(templates);
            toast({
              title: "Templates carregados",
              description: `${templates.length} templates encontrados.`,
              variant: "default",
            });
          } else {
            console.log("Nenhum template encontrado na resposta da Meta API");
            setMetaTemplates([]);
            toast({
              title: "Nenhum template encontrado",
              description: "Não foi encontrado nenhum template aprovado na sua conta WhatsApp Cloud API (Meta). Crie templates no Facebook Business Manager.",
              variant: "default",
            });
          }
        })
        .catch(error => {
          console.error("Erro ao carregar templates da Meta API:", error);
          
          // Como último recurso, tentar via endpoint de diagnóstico
          toast({
            title: "Tentando método alternativo",
            description: "Utilizando diagnóstico de templates...",
            variant: "default",
          });
          
          fetch("/api/diagnose/meta-templates")
            .then(res => res.ok ? res.json() : Promise.reject("Falha no diagnóstico"))
            .then(data => {
              console.log("Diagnóstico de templates:", data);
              if (data.steps && data.steps.length > 0) {
                const lastStep = data.steps.find(s => s.templates && s.templates.length > 0);
                if (lastStep) {
                  const simpleTemplates = lastStep.templates.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    category: t.category,
                    language: t.language
                  }));
                  setMetaTemplates(simpleTemplates);
                  toast({
                    title: "Templates recuperados via diagnóstico",
                    description: `${simpleTemplates.length} templates encontrados.`,
                    variant: "default",
                  });
                  return;
                }
              }
              
              // Se chegou aqui, não foi possível recuperar via diagnóstico também
              toast({
                title: "Erro ao carregar templates da Meta API",
                description: error.message,
                variant: "destructive",
              });
            })
            .catch(diagError => {
              console.error("Falha no diagnóstico:", diagError);
              toast({
                title: "Erro ao carregar templates da Meta API",
                description: error.message,
                variant: "destructive",
              });
            });
        })
        .finally(() => {
          console.log("Finalizando carregamento de templates da Meta API");
          setIsLoadingMetaTemplates(false);
        });
    }
  }, [form, toast]);
  
  // Função para lidar com o envio do formulário
  const onSubmit = (data) => {
    // Verificar se pelo menos um método de mensagem foi selecionado
    if (!data.templateId && !data.customMessage) {
      toast({
        title: "Erro ao criar envio",
        description: "Você deve selecionar um template ou escrever uma mensagem personalizada",
        variant: "destructive",
      });
      return;
    }
    
    // Adicionar o userId ao payload
    const payload = {
      ...data,
      userId: user?.id
    };
    
    // Determinar qual tipo de envio será feito com base na conexão selecionada
    if (data.whatsappConnectionType === "qrcode") {
      // Para QR Code, usar o webhook configurado no servidor
      sendViaWebhookMutation.mutate(payload);
    } else if (data.whatsappConnectionType === "meta") {
      // Para Meta API, enviar diretamente via API
      sendViaMetaApiMutation.mutate(payload);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo Envio de Mensagens</CardTitle>
        <CardDescription>
          Configure os parâmetros para um novo envio de mensagens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="whatsappConnectionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conexão de WhatsApp</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de conexão" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="qrcode">WhatsApp QR Code</SelectItem>
                      <SelectItem value="meta">WhatsApp Meta API</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Escolha o método de conexão para envio das mensagens
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="searchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pesquisa de Prospecção</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={field.value?.toString() || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma pesquisa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingSearches ? (
                        <SelectItem value="loading" disabled>
                          Carregando...
                        </SelectItem>
                      ) : searches && searches.length > 0 ? (
                        searches.map((search) => (
                          <SelectItem key={search.id} value={search.id.toString()}>
                            {search.segment} - {search.city || "Todas cidades"}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhuma pesquisa encontrada
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Exibir o switch apenas se não estiver usando Meta API */}
            {form.watch("whatsappConnectionType") !== "meta" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-template"
                    checked={useTemplate}
                    onCheckedChange={setUseTemplate}
                  />
                  <label
                    htmlFor="use-template"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Usar template
                  </label>
                </div>
              </div>
            )}
            
            {useTemplate ? (
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template de Mensagem</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {form.watch("whatsappConnectionType") === "meta" ? (
                          // Templates da Meta API
                          isLoadingMetaTemplates ? (
                            <SelectItem value="loading" disabled>
                              Carregando templates da Meta API...
                            </SelectItem>
                          ) : metaTemplates && metaTemplates.length > 0 ? (
                            <>
                              {metaTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name} {template.status ? `(${template.status})` : ''}
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1 border-t border-border mt-1">
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center w-full px-2 py-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    setIsLoadingMetaTemplates(true);
                                    fetch("/api/meta-direct-templates")
                                      .then(res => res.json())
                                      .then(data => {
                                        // Processar a resposta corretamente
                                        let templates = [];
                                        if (Array.isArray(data)) {
                                          templates = data;
                                        } else if (data && data.templates && Array.isArray(data.templates)) {
                                          templates = data.templates;
                                        } else if (data && typeof data === 'object') {
                                          const possibleTemplatesArray = Object.values(data).find(val => Array.isArray(val));
                                          if (possibleTemplatesArray) {
                                            templates = possibleTemplatesArray;
                                          }
                                        }
                                        
                                        setMetaTemplates(templates);
                                        setIsLoadingMetaTemplates(false);
                                        
                                        toast({
                                          title: "Templates atualizados",
                                          description: `${templates.length} templates encontrados`,
                                          variant: "default"
                                        });
                                      })
                                      .catch(err => {
                                        setIsLoadingMetaTemplates(false);
                                        toast({
                                          title: "Erro ao atualizar templates",
                                          description: err.message,
                                          variant: "destructive"
                                        });
                                      });
                                  }}
                                >
                                  <RefreshCcw className="h-3 w-3 mr-1" /> Recarregar templates
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <SelectItem value="none" disabled>
                                Nenhum template Meta API encontrado
                              </SelectItem>
                              <div className="px-2 py-1 border-t border-border mt-1">
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center w-full px-2 py-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    setIsLoadingMetaTemplates(true);
                                    fetch("/api/meta-direct-templates")
                                      .then(res => res.json())
                                      .then(data => {
                                        // Processar a resposta corretamente
                                        let templates = [];
                                        if (Array.isArray(data)) {
                                          templates = data;
                                        } else if (data && data.templates && Array.isArray(data.templates)) {
                                          templates = data.templates;
                                        } else if (data && typeof data === 'object') {
                                          const possibleTemplatesArray = Object.values(data).find(val => Array.isArray(val));
                                          if (possibleTemplatesArray) {
                                            templates = possibleTemplatesArray;
                                          }
                                        }
                                        
                                        setMetaTemplates(templates);
                                        setIsLoadingMetaTemplates(false);
                                        
                                        toast({
                                          title: "Templates atualizados",
                                          description: `${templates.length} templates encontrados`,
                                          variant: "default"
                                        });
                                      })
                                      .catch(err => {
                                        setIsLoadingMetaTemplates(false);
                                        toast({
                                          title: "Erro ao atualizar templates",
                                          description: err.message,
                                          variant: "destructive"
                                        });
                                      });
                                  }}
                                >
                                  <RefreshCcw className="h-3 w-3 mr-1" /> Tentar carregar templates
                                </button>
                              </div>
                            </>
                          )
                        ) : (
                          // Templates normais (QR Code)
                          isLoadingTemplates ? (
                            <SelectItem value="loading" disabled>
                              Carregando...
                            </SelectItem>
                          ) : templates && templates.length > 0 ? (
                            templates.map((template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.title}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              Nenhum template encontrado
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="customMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem Personalizada</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Digite a mensagem personalizada..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Mensagens</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data e Hora do Envio</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={`w-full pl-3 text-left font-normal ${
                            !field.value ? "text-muted-foreground" : ""
                          }`}
                        >
                          {field.value ? (
                            format(field.value, "PPP HH:mm", { locale: ptBR })
                          ) : (
                            <span>Selecione a data e hora</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => {
                          if (date) {
                            const now = new Date();
                            date.setHours(now.getHours(), now.getMinutes());
                          }
                          field.onChange(date);
                        }}
                        locale={ptBR}
                        disabled={(date) => date < new Date()}
                      />
                      {field.value && (
                        <div className="flex items-center justify-center p-2 border-t">
                          <input
                            type="time"
                            className="px-2 py-1 border rounded"
                            value={format(field.value, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              const newDate = new Date(field.value);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              field.onChange(newDate);
                            }}
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Mostrar campo de aprendizado de IA apenas para conexão QR Code */}
            {form.watch("whatsappConnectionType") === "qrcode" && (
              <>
                <FormField
                  control={form.control}
                  name="aiLearningEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Aprendizado de IA</FormLabel>
                        <FormDescription>
                          Permite que a IA aprenda com o feedback dos envios para melhorar futuras mensagens
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {form.watch("aiLearningEnabled") && (
                  <FormField
                    control={form.control}
                    name="aiNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas para IA</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Instrua a IA sobre como melhorar as mensagens..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={sendViaWebhookMutation.isPending || sendViaMetaApiMutation.isPending}
            >
              {sendViaWebhookMutation.isPending || sendViaMetaApiMutation.isPending ? (
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Criar Envio
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

// Componente para listar os envios
const SendingList = () => {
  const { toast } = useToast();
  const [selectedSending, setSelectedSending] = useState(null);
  
  // Buscar os envios de mensagens
  const { data: sendings, isLoading } = useQuery({
    queryKey: ["/api/message-sendings"],
    queryFn: async () => {
      const res = await fetch("/api/message-sendings");
      if (!res.ok) throw new Error("Falha ao carregar envios");
      return res.json();
    },
  });
  
  // Buscar as pesquisas para exibir os nomes
  const { data: searches } = useQuery({
    queryKey: ["/api/prospecting/searches"],
    queryFn: async () => {
      const res = await fetch("/api/prospecting/searches");
      if (!res.ok) throw new Error("Falha ao carregar pesquisas");
      return res.json();
    },
  });
  
  // Buscar os templates para exibir os nomes
  const { data: templates } = useQuery({
    queryKey: ["/api/message-templates"],
    queryFn: async () => {
      const res = await fetch("/api/message-templates");
      if (!res.ok) throw new Error("Falha ao carregar templates");
      return res.json();
    },
  });
  
  // Mutação para cancelar um envio
  const cancelSendingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/message-sendings/${id}`, { status: "cancelado" });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Envio cancelado com sucesso",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sendings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar envio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para excluir um envio
  const deleteSendingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/message-sendings/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      toast({
        title: "Envio excluído com sucesso",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-sendings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir envio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Buscar histórico de envio para um envio específico
  const { data: sendingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["/api/message-sending-history", selectedSending],
    queryFn: async () => {
      if (!selectedSending) return [];
      const res = await fetch(`/api/message-sendings/${selectedSending}/history`);
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      return res.json();
    },
    enabled: !!selectedSending,
  });
  
  // Função para obter o nome da pesquisa
  const getSearchName = (searchId) => {
    if (!searches || !searchId) return "N/A";
    const search = searches.find(s => s.id === searchId);
    return search ? `${search.segment} - ${search.city || "Todas cidades"}` : "N/A";
  };
  
  // Função para obter o nome do template
  const getTemplateName = (templateId) => {
    if (!templates || !templateId) return "N/A";
    const template = templates.find(t => t.id === templateId);
    return template ? template.title : "N/A";
  };
  
  // Função para obter a classe de cor com base no status
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "agendado":
        return "outline";
      case "em_andamento":
        return "secondary";
      case "concluido":
        return "default";
      case "cancelado":
        return "destructive";
      default:
        return "outline";
    }
  };
  
  // Renderizar o texto do status em português
  const getStatusText = (status) => {
    switch (status) {
      case "agendado":
        return "Agendado";
      case "em_andamento":
        return "Em andamento";
      case "concluido":
        return "Concluído";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Envios de Mensagens</CardTitle>
          <CardDescription>
            Lista de todos os envios de mensagens agendados e executados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sendings && sendings.length > 0 ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pesquisa</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Agendado para</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sendings.map((sending) => (
                    <TableRow key={sending.id}>
                      <TableCell>{getSearchName(sending.searchId)}</TableCell>
                      <TableCell>
                        {sending.templateId ? (
                          <span className="flex items-center">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            {getTemplateName(sending.templateId)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Mensagem personalizada</span>
                        )}
                      </TableCell>
                      <TableCell>{sending.quantity}</TableCell>
                      <TableCell>
                        <FormattedDate date={sending.scheduledAt} showTime={true} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(sending.status)}>
                          {getStatusText(sending.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSending(sending.id)}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Histórico de Envio</DialogTitle>
                            </DialogHeader>
                            {isLoadingHistory ? (
                              <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                            ) : sendingHistory && sendingHistory.length > 0 ? (
                              <div className="overflow-auto max-h-[400px]">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Data/Hora</TableHead>
                                      <TableHead>Resultado</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sendingHistory.map((history) => (
                                      <TableRow key={history.id}>
                                        <TableCell>
                                          <FormattedDate date={history.sentAt} showTime={true} />
                                        </TableCell>
                                        <TableCell>
                                          {history.resultId ? `ID: ${history.resultId}` : "N/A"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={history.status === "sucesso" ? "default" : "destructive"}
                                          >
                                            {history.status === "sucesso" ? "Sucesso" : "Erro"}
                                          </Badge>
                                          {history.errorMessage && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {history.errorMessage}
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                Nenhum histórico encontrado para este envio
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        {sending.status === "agendado" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm("Tem certeza que deseja cancelar este envio?")) {
                                cancelSendingMutation.mutate(sending.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum envio encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Componente principal da página
export default function MessageSendingPage() {
  return (
    <DashboardLayout>
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Envio de Mensagens</h1>
          <p className="text-muted-foreground">
            Gerencie templates e configure envios automáticos de mensagens para seus prospectos
          </p>
        </div>
        
        <Tabs defaultValue="sending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sending">Criar Envio</TabsTrigger>
            <TabsTrigger value="history">Histórico de Envios</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sending" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <CreateSendingForm />
              <Card>
                <CardHeader>
                  <CardTitle>Dicas para Envios</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Escolha uma pesquisa de prospecção para selecionar os destinatários</li>
                    <li>Utilize templates predefinidos ou crie mensagens personalizadas</li>
                    <li>Defina a quantidade de mensagens para controlar o volume de envios</li>
                    <li>Agende envios para horários comerciais para melhores resultados</li>
                    <li>Ative o aprendizado de IA para aprimorar campanhas futuras</li>
                    <li>Monitore os resultados no histórico de envios</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="history">
            <SendingList />
          </TabsContent>
          
          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}