import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  MessageSquare, 
  PlusCircle, 
  Save, 
  Trash, 
  Upload, 
  ArrowRightLeft, 
  MoveRight,
  X
} from "lucide-react";
import { 
  Table, TableHeader, TableRow, TableHead, 
  TableBody, TableCell
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Tipos para a página do agente de IA
interface AiAgent {
  id: number;
  userId: number;
  enabled: boolean;
  triggerText: string | null;
  personality: string | null;
  expertise: string | null;
  voiceTone: string | null;
  rules: string | null;
  mediaDownloadUrl: string | null;
  mediaFilename: string | null;
  mediaFormat: string | null;
  followUpEnabled: boolean;
  followUpCount: number | null;
  messageInterval: string | null;
  followUpPrompt: string | null;
  schedulingEnabled: boolean;
  agendaId: string | null;
  schedulingPromptConsult: string | null;
  schedulingPromptTime: string | null;
  schedulingDuration: string | null;
  autoMoveCrm: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface AiAgentStep {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  order: number;
  mediaData: string | null;
  mediaFilename: string | null;
  mediaType: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface AiAgentFaq {
  id: number;
  userId: number;
  question: string;
  answer: string;
  mediaData: string | null;
  mediaFilename: string | null;
  mediaType: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export default function AiAgentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  
  // Fetch agent data
  const { 
    data: agent, 
    isLoading, 
    isError 
  } = useQuery<AiAgent>({ 
    queryKey: ["/api/ai-agent"],
    retry: 1
  });
  
  // Fetch agent steps
  const { 
    data: steps = [] as AiAgentStep[], 
    isLoading: isLoadingSteps 
  } = useQuery<AiAgentStep[]>({ 
    queryKey: ["/api/ai-agent/steps"],
    retry: 1
  });
  
  // Fetch agent FAQs
  const { 
    data: faqs = [] as AiAgentFaq[], 
    isLoading: isLoadingFaqs 
  } = useQuery<AiAgentFaq[]>({ 
    queryKey: ["/api/ai-agent/faqs"],
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    refetchOnWindowFocus: false,
    select: (data) => {
      // Remove duplicatas baseadas no ID para garantir unicidade
      const uniqueFaqs = data.filter((faq, index, self) => 
        index === self.findIndex(f => f.id === faq.id)
      );
      return uniqueFaqs.sort((a, b) => a.id - b.id);
    }
  });
  
  // State for the agent form
  const [agentData, setAgentData] = useState<Partial<AiAgent>>({
    enabled: false,
    triggerText: "",
    personality: "",
    expertise: "",
    voiceTone: "",
    rules: "",
    mediaDownloadUrl: null,
    mediaFilename: null,
    mediaFormat: null,
    autoMoveCrm: false,
    followUpEnabled: false,
    followUpCount: 0,
    messageInterval: "30 minutos",
    followUpPrompt: "",
    schedulingEnabled: false,
    agendaId: "",
    schedulingPromptConsult: "",
    schedulingPromptTime: "",
    schedulingDuration: "30 minutos"
  });
  
  // State for step form
  const [stepFormOpen, setStepFormOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<AiAgentStep | null>(null);
  const [stepData, setStepData] = useState<Partial<AiAgentStep>>({
    name: "",
    description: "",
    order: 1,
    mediaData: null,
    mediaFilename: null,
    mediaType: null
  });
  
  // State for FAQ form
  const [faqFormOpen, setFaqFormOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<AiAgentFaq | null>(null);
  const [faqData, setFaqData] = useState<Partial<AiAgentFaq>>({
    question: "",
    answer: "",
    mediaData: null,
    mediaFilename: null,
    mediaType: null
  });
  
  // State for media upload
  const [uploadType, setUploadType] = useState<"rules" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Update local state when agent data is loaded
  useEffect(() => {
    if (agent && !isLoading) {
      setAgentData(agent);
    }
  }, [agent, isLoading]);
  
  // Handle input changes
  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAgentData(prev => ({ ...prev, [name as keyof AiAgent]: value }));
  };
  
  // Handle switch changes
  const handleSwitchChange = (name: keyof AiAgent, checked: boolean) => {
    setAgentData(prev => ({ ...prev, [name]: checked }));
  };
  
  // Função para limpar mídia
  const handleClearMedia = () => {
    setAgentData(prev => ({
      ...prev,
      mediaDownloadUrl: null,
      mediaFilename: null,
      mediaFormat: null
    }));
    
    toast({
      title: "Mídia removida",
      description: "A mídia foi removida da configuração.",
    });
  };

  // Save agent settings
  const handleSaveAgent = async () => {
    try {
      // Preparar dados para envio, garantindo que campos vazios sejam null
      const dataToSave = {
        ...agentData,
        // Limpar campos de mídia vazios
        mediaData: agentData.mediaData && agentData.mediaData.trim() !== "" ? agentData.mediaData : null,
        mediaFilename: agentData.mediaFilename && agentData.mediaFilename.trim() !== "" ? agentData.mediaFilename : null,
        mediaType: agentData.mediaType && agentData.mediaType.trim() !== "" ? agentData.mediaType : null,
      };
      
      await apiRequest("PUT", "/api/ai-agent", dataToSave);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações do agente foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive",
      });
    }
  };
  
  // Open step form for edit
  const openStepForm = (step: AiAgentStep | null = null) => {
    if (step) {
      setCurrentStep(step);
      setStepData({
        name: step.name,
        description: step.description || "",
        order: step.order,
        mediaData: step.mediaData || null,
        mediaFilename: step.mediaFilename || null,
        mediaType: step.mediaType || null
      });
    } else {
      setCurrentStep(null);
      setStepData({
        name: "",
        description: "",
        order: steps.length + 1,
        mediaData: null,
        mediaFilename: null,
        mediaType: null
      });
    }
    setStepFormOpen(true);
  };
  
  // Função para comprimir imagem
  const compressImage = async (file: File, maxSizeKB: number = 500): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calcular novo tamanho mantendo proporção
        let { width, height } = img;
        const maxDimension = 1200; // Máximo 1200px na maior dimensão
        
        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Desenhar imagem redimensionada
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Converter para blob com qualidade reduzida
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.7); // 70% de qualidade
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle media upload for agent configuration
  const handleUploadMedia = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadType("rules");
      
      // Validar tipo de arquivo
      const allowedTypes = [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: "Apenas arquivos PDF, CSV e Excel (.xlsx, .xls) são aceitos.",
          variant: "destructive",
        });
        return;
      }
      
      // Criar FormData para envio do arquivo
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Enviando arquivo:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Fazer upload do arquivo
      const response = await fetch('/api/ai-agent/upload-file', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro no upload do arquivo');
      }
      
      const result = await response.json();
      
      // Update media in agent behavior rules
      setAgentData(prev => ({
        ...prev,
        mediaDownloadUrl: result.downloadUrl,
        mediaFilename: result.fileName,
        mediaFormat: result.format
      }));
      
      const fileExtension = result.fileName.split('.').pop()?.toUpperCase() || 'ARQUIVO';
      toast({
        title: "Arquivo carregado",
        description: `${result.fileName} (${fileExtension}) carregado com sucesso. Clique em 'Salvar Configurações' para salvar permanentemente.`,
      });
      
    } catch (error) {
      console.error("Erro no upload de arquivo:", error);
      toast({
        title: "Erro ao carregar arquivo",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao carregar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadType(null);
    }
  };
  
  // Handle step form input changes
  const handleStepInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStepData(prev => ({ ...prev, [name as keyof AiAgentStep]: value }));
  };
  
  // Save step
  const handleSaveStep = async () => {
    try {
      if (currentStep) {
        await apiRequest("PUT", `/api/ai-agent/steps/${currentStep.id}`, stepData);
      } else {
        await apiRequest("POST", "/api/ai-agent/steps", stepData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent/steps"] });
      setStepFormOpen(false);
      toast({
        title: currentStep ? "Etapa atualizada" : "Etapa criada",
        description: currentStep 
          ? "A etapa foi atualizada com sucesso." 
          : "A etapa foi criada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a etapa.",
        variant: "destructive",
      });
    }
  };
  
  // Delete step
  const handleDeleteStep = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/ai-agent/steps/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent/steps"] });
      toast({
        title: "Etapa excluída",
        description: "A etapa foi excluída com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a etapa.",
        variant: "destructive",
      });
    }
  };
  
  // Open FAQ form for edit
  const openFaqForm = (faq: AiAgentFaq | null = null) => {
    if (faq) {
      setCurrentFaq(faq);
      setFaqData({
        question: faq.question,
        answer: faq.answer,
        mediaData: faq.mediaData || null,
        mediaFilename: faq.mediaFilename || null,
        mediaType: faq.mediaType || null
      });
    } else {
      setCurrentFaq(null);
      setFaqData({
        question: "",
        answer: "",
        mediaData: null,
        mediaFilename: null,
        mediaType: null
      });
    }
    setFaqFormOpen(true);
  };
  
  // Handle FAQ form input changes
  const handleFaqInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFaqData(prev => ({ ...prev, [name as keyof AiAgentFaq]: value }));
  };
  
  // Save FAQ
  const handleSaveFaq = async () => {
    try {
      if (currentFaq) {
        await apiRequest("PUT", `/api/ai-agent/faqs/${currentFaq.id}`, faqData);
      } else {
        await apiRequest("POST", "/api/ai-agent/faqs", faqData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent/faqs"] });
      setFaqFormOpen(false);
      toast({
        title: currentFaq ? "FAQ atualizada" : "FAQ criada",
        description: currentFaq 
          ? "A FAQ foi atualizada com sucesso." 
          : "A FAQ foi criada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a FAQ.",
        variant: "destructive",
      });
    }
  };
  
  // Delete FAQ
  const handleDeleteFaq = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/ai-agent/faqs/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agent/faqs"] });
      toast({
        title: "FAQ excluída",
        description: "A FAQ foi excluída com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a FAQ.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-2xl font-bold">Erro ao carregar dados</h2>
        <p>Não foi possível carregar as informações do agente de IA.</p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-agent"] })}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container py-6 min-h-screen overflow-auto">
      <div className="flex flex-col items-center justify-start w-full max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <MessageSquare className="h-8 w-8 text-primary" /> Agente de IA
          </h1>
          <p className="text-muted-foreground">
            Configure seu assistente virtual para comunicação automatizada
          </p>
        </div>
      
        <Card className="shadow-lg border-t-4 border-t-primary w-full mb-10">
          <CardContent className="p-0">
            <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full rounded-none border-b justify-center p-0">
                <TabsTrigger 
                  value="general" 
                  className="flex-1 rounded-none py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Configuração Geral
                </TabsTrigger>
                <TabsTrigger 
                  value="steps" 
                  className="flex-1 rounded-none py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  Fluxo de Conversão
                </TabsTrigger>
                <TabsTrigger 
                  value="faqs" 
                  className="flex-1 rounded-none py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary"
                >
                  FAQs
                </TabsTrigger>
              </TabsList>
              
              {/* General Configuration Tab */}
              <TabsContent value="general" className="p-6">
                <div className="grid gap-6">
                  {/* Enable/Disable Agent */}
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="agent-status">Ativar Agente de IA</Label>
                    <Switch
                      id="agent-status"
                      checked={agentData.enabled}
                      onCheckedChange={(checked) => handleSwitchChange("enabled" as keyof AiAgent, checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Personality Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Personalidade</h3>
                    
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="triggerText">Mensagem de Saudação</Label>
                        <Textarea
                          id="triggerText"
                          name="triggerText"
                          placeholder="Olá, sou o assistente virtual. Como posso ajudar?"
                          value={agentData.triggerText || ""}
                          onChange={handleAgentInputChange}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="personality">Personalidade</Label>
                          <Input
                            id="personality"
                            name="personality"
                            placeholder="Amigável e profissional"
                            value={agentData.personality || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="expertise">Área de Expertise</Label>
                          <Input
                            id="expertise"
                            name="expertise"
                            placeholder="Atendimento ao cliente"
                            value={agentData.expertise || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="voiceTone">Tom de Voz</Label>
                          <Input
                            id="voiceTone"
                            name="voiceTone"
                            placeholder="Formal"
                            value={agentData.voiceTone || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="rules">Regras de Comportamento</Label>
                        <Textarea
                          id="rules"
                          name="rules"
                          placeholder="Regras para o comportamento do agente"
                          value={agentData.rules || ""}
                          onChange={handleAgentInputChange}
                        />
                        
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="file"
                            id="rules-media"
                            className="hidden"
                            accept=".pdf,.csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadMedia(file);
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="gap-2"
                            onClick={() => document.getElementById("rules-media")?.click()}
                            disabled={isUploading && uploadType === "rules"}
                          >
                            {isUploading && uploadType === "rules" ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Importando...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                Importar Mídia
                              </>
                            )}
                          </Button>
                          
                          {agentData.mediaData && (
                            <>
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>Mídia importada: {agentData.mediaFilename}</span>
                              </span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="gap-2 text-red-600 hover:text-red-700"
                                onClick={handleClearMedia}
                              >
                                <X className="h-4 w-4" />
                                Remover
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* CRM Auto Movement Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Movimentação Automática de CRM</h3>
                        <p className="text-sm text-muted-foreground">Permite que o agente mova os contatos automaticamente entre os fluxos do CRM</p>
                      </div>
                      <Switch
                        id="autoMoveCrm-status"
                        checked={agentData.autoMoveCrm || false}
                        onCheckedChange={(checked) => handleSwitchChange("autoMoveCrm" as keyof AiAgent, checked)}
                      />
                    </div>
                    
                    {agentData.autoMoveCrm && (
                      <div className="flex items-center gap-2 mt-4 p-4 bg-muted rounded-md">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        <p className="text-sm">
                          O agente poderá mover contatos entre: <span className="font-medium">Lead → Prospect → Cliente</span> com base nas respostas recebidas.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Follow-up Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Follow-ups Automáticos</h3>
                      <Switch
                        id="followup-status"
                        checked={agentData.followUpEnabled}
                        onCheckedChange={(checked) => handleSwitchChange("followUpEnabled" as keyof AiAgent, checked)}
                      />
                    </div>
                    
                    {agentData.followUpEnabled && (
                      <div className="grid gap-4 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="followUpCount">Número de Follow-ups</Label>
                            <Input
                              id="followUpCount"
                              name="followUpCount"
                              type="number"
                              min="0"
                              max="5"
                              placeholder="3"
                              value={agentData.followUpCount || 0}
                              onChange={handleAgentInputChange}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="messageInterval">Intervalo entre Mensagens</Label>
                            <Input
                              id="messageInterval"
                              name="messageInterval"
                              placeholder="30 minutos"
                              value={agentData.messageInterval || ""}
                              onChange={handleAgentInputChange}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="followUpPrompt">Mensagem de Follow-up</Label>
                          <Textarea
                            id="followUpPrompt"
                            name="followUpPrompt"
                            placeholder="Gostaria de mais informações sobre nossos serviços?"
                            value={agentData.followUpPrompt || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Scheduling Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Agendamento Automático</h3>
                      <Switch
                        id="scheduling-status"
                        checked={agentData.schedulingEnabled}
                        onCheckedChange={(checked) => handleSwitchChange("schedulingEnabled" as keyof AiAgent, checked)}
                      />
                    </div>
                    
                    {agentData.schedulingEnabled && (
                      <div className="grid gap-4 mt-2">
                        <div className="space-y-2">
                          <Label htmlFor="agendaId">ID da Agenda</Label>
                          <Input
                            id="agendaId"
                            name="agendaId"
                            placeholder="ID da sua agenda conectada"
                            value={agentData.agendaId || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="schedulingDuration">Duração da Consulta</Label>
                            <Input
                              id="schedulingDuration"
                              name="schedulingDuration"
                              placeholder="30 minutos"
                              value={agentData.schedulingDuration || ""}
                              onChange={handleAgentInputChange}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="schedulingPromptConsult">Mensagem para Consulta</Label>
                          <Textarea
                            id="schedulingPromptConsult"
                            name="schedulingPromptConsult"
                            placeholder="Gostaria de agendar uma consulta?"
                            value={agentData.schedulingPromptConsult || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="schedulingPromptTime">Mensagem para Horário</Label>
                          <Textarea
                            id="schedulingPromptTime"
                            name="schedulingPromptTime"
                            placeholder="Qual horário seria melhor para você?"
                            value={agentData.schedulingPromptTime || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button onClick={handleSaveAgent} className="gap-2">
                      <Save className="h-4 w-4" />
                      Salvar Configurações
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Steps Tab */}
              <TabsContent value="steps" className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium">Etapas do Fluxo de Conversão</h3>
                  <Button onClick={() => openStepForm()} className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Nova Etapa
                  </Button>
                </div>
                
                {isLoadingSteps ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-border" />
                  </div>
                ) : steps.length === 0 ? (
                  <div className="text-center py-10 border rounded-md">
                    <p className="text-muted-foreground">Nenhuma etapa configurada.</p>
                    <p className="text-sm mt-2">Clique em "Nova Etapa" para criar uma.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Ordem</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[100px]">Mídia</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {steps.map((step: AiAgentStep) => (
                          <TableRow key={step.id}>
                            <TableCell className="font-medium">{step.order}</TableCell>
                            <TableCell>{step.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {step.description || "—"}
                            </TableCell>
                            <TableCell>
                              {step.mediaData ? (
                                <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
                                  <MoveRight className="h-4 w-4 text-primary" />
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => openStepForm(step)}
                                >
                                  Editar
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteStep(step.id)}
                                >
                                  <Trash className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    <p className="text-sm text-muted-foreground mt-4">
                      O fluxo de conversão define as etapas pelas quais um lead passa durante a interação com o agente. 
                      Configure as etapas em ordem de prioridade.
                    </p>
                  </div>
                )}
                
                <Dialog open={stepFormOpen} onOpenChange={setStepFormOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {currentStep ? `Editar Etapa: ${currentStep.name}` : "Nova Etapa"}
                      </DialogTitle>
                      <DialogDescription>
                        Defina as informações da etapa do fluxo de conversão.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-order" className="text-right">
                          Ordem
                        </Label>
                        <Input
                          id="step-order"
                          name="order"
                          type="number"
                          min="1"
                          className="col-span-3"
                          value={stepData.order || 1}
                          onChange={handleStepInputChange}
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-name" className="text-right">
                          Nome
                        </Label>
                        <Input
                          id="step-name"
                          name="name"
                          className="col-span-3"
                          value={stepData.name || ""}
                          onChange={handleStepInputChange}
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-description" className="text-right">
                          Descrição
                        </Label>
                        <Textarea
                          id="step-description"
                          name="description"
                          className="col-span-3"
                          value={stepData.description || ""}
                          onChange={handleStepInputChange}
                        />
                      </div>
                      

                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setStepFormOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveStep}>
                        Salvar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
              
              {/* FAQs Tab */}
              <TabsContent value="faqs" className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium">Perguntas Frequentes (FAQs)</h3>
                  <Button onClick={() => openFaqForm()} className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Nova FAQ
                  </Button>
                </div>
                
                {isLoadingFaqs ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-border" />
                  </div>
                ) : faqs.length === 0 ? (
                  <div className="text-center py-10 border rounded-md">
                    <p className="text-muted-foreground">Nenhuma FAQ configurada.</p>
                    <p className="text-sm mt-2">Clique em "Nova FAQ" para criar uma.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {faqs.map((faq: AiAgentFaq) => (
                      <Card key={faq.id} className="overflow-hidden">
                        <CardHeader className="p-4 bg-muted/50">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">
                              {faq.question}
                            </CardTitle>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2"
                                onClick={() => openFaqForm(faq)}
                              >
                                Editar
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => handleDeleteFaq(faq.id)}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <p className="text-sm">{faq.answer}</p>
                          {faq.mediaData && (
                            <div className="mt-2 p-2 bg-primary/10 rounded-sm inline-flex items-center gap-2">
                              <MoveRight className="h-4 w-4 text-primary" />
                              <span className="text-xs">Mídia anexada</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    
                    <p className="text-sm text-muted-foreground mt-4">
                      As FAQs são usadas pelo agente para responder perguntas comuns sem precisar recorrer à IA generativa, 
                      melhorando o tempo de resposta e a precisão.
                    </p>
                  </div>
                )}
                
                <Dialog open={faqFormOpen} onOpenChange={setFaqFormOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {currentFaq ? "Editar FAQ" : "Nova FAQ"}
                      </DialogTitle>
                      <DialogDescription>
                        Adicione uma pergunta frequente e sua resposta.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="faq-question">
                          Pergunta
                        </Label>
                        <Input
                          id="faq-question"
                          name="question"
                          value={faqData.question || ""}
                          onChange={handleFaqInputChange}
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="faq-answer">
                          Resposta
                        </Label>
                        <Textarea
                          id="faq-answer"
                          name="answer"
                          rows={5}
                          value={faqData.answer || ""}
                          onChange={handleFaqInputChange}
                        />
                      </div>
                      

                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setFaqFormOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveFaq}>
                        Salvar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}