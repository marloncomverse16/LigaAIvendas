import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/header";
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
  MoveRight
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
  mediaUrl: string | null;
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
  mediaUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface AiAgentFaq {
  id: number;
  userId: number;
  question: string;
  answer: string;
  mediaUrl: string | null;
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
    retry: 1
  });
  
  // State for the agent form
  const [agentData, setAgentData] = useState<Partial<AiAgent>>({
    enabled: false,
    triggerText: "",
    personality: "",
    expertise: "",
    voiceTone: "",
    rules: "",
    mediaUrl: null,
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
    mediaUrl: ""
  });
  
  // State for FAQ form
  const [faqFormOpen, setFaqFormOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<AiAgentFaq | null>(null);
  const [faqData, setFaqData] = useState<Partial<AiAgentFaq>>({
    question: "",
    answer: "",
    mediaUrl: ""
  });
  
  // State for media upload
  const [uploadType, setUploadType] = useState<"rules" | "step" | "faq" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Update local state when agent data is loaded
  if (agent && !isLoading && Object.keys(agentData).every(key => {
    const k = key as keyof typeof agentData;
    return !agentData[k] && k !== 'enabled' && k !== 'followUpEnabled' && k !== 'schedulingEnabled' && k !== 'autoMoveCrm' && k !== 'mediaUrl';
  })) {
    setAgentData(agent);
  }
  
  // Handle input changes
  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAgentData(prev => ({ ...prev, [name as keyof AiAgent]: value }));
  };
  
  // Handle switch changes
  const handleSwitchChange = (name: keyof AiAgent, checked: boolean) => {
    setAgentData(prev => ({ ...prev, [name]: checked }));
  };
  
  // Save agent settings
  const handleSaveAgent = async () => {
    try {
      await apiRequest("PUT", "/api/ai-agent", agentData);
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
        mediaUrl: step.mediaUrl || ""
      });
    } else {
      setCurrentStep(null);
      setStepData({
        name: "",
        description: "",
        order: steps.length + 1,
        mediaUrl: ""
      });
    }
    setStepFormOpen(true);
  };
  
  // Handle media upload
  const handleUploadMedia = async (file: File, type: "rules" | "step" | "faq") => {
    try {
      setIsUploading(true);
      setUploadType(type);
      
      // Aqui você implementaria o upload real para o servidor
      // Este é um exemplo simulado de upload
      setTimeout(() => {
        const fakeUrl = URL.createObjectURL(file);
        
        if (type === "rules") {
          // Atualizar a mídia nas regras de comportamento
          setAgentData(prev => ({
            ...prev,
            mediaUrl: fakeUrl
          }));
        } else if (type === "step") {
          // Atualizar a mídia na etapa atual
          setStepData(prev => ({
            ...prev,
            mediaUrl: fakeUrl
          }));
        } else if (type === "faq") {
          // Atualizar a mídia na FAQ atual
          setFaqData(prev => ({
            ...prev,
            mediaUrl: fakeUrl
          }));
        }
        
        setIsUploading(false);
        setUploadType(null);
        
        toast({
          title: "Mídia importada",
          description: "A mídia foi importada com sucesso.",
        });
      }, 1500);
      
    } catch (error) {
      setIsUploading(false);
      setUploadType(null);
      toast({
        title: "Erro ao importar mídia",
        description: "Ocorreu um erro ao importar a mídia.",
        variant: "destructive",
      });
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
        mediaUrl: faq.mediaUrl || ""
      });
    } else {
      setCurrentFaq(null);
      setFaqData({
        question: "",
        answer: "",
        mediaUrl: ""
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
    <div className="container mx-auto py-6">
      <Header 
        title="Agente de IA" 
        subtitle="Configure seu assistente virtual para comunicação automatizada"
      />
      
      <div className="grid gap-6 mt-6">
        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Configuração Geral</TabsTrigger>
            <TabsTrigger value="steps">Fluxo de Conversão</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
          </TabsList>
          
          {/* General Configuration Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
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
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadMedia(file, "rules");
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
                          {agentData.mediaUrl && (
                            <span className="text-sm text-muted-foreground">
                              Mídia importada
                            </span>
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
                            placeholder="ID da agenda no Google Calendar"
                            value={agentData.agendaId || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="schedulingPromptConsult">Mensagem de Consulta</Label>
                          <Textarea
                            id="schedulingPromptConsult"
                            name="schedulingPromptConsult"
                            placeholder="Gostaria de agendar uma consulta?"
                            value={agentData.schedulingPromptConsult || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="schedulingPromptTime">Mensagem de Horário</Label>
                          <Textarea
                            id="schedulingPromptTime"
                            name="schedulingPromptTime"
                            placeholder="Qual o melhor horário para você?"
                            value={agentData.schedulingPromptTime || ""}
                            onChange={handleAgentInputChange}
                          />
                        </div>
                        
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
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveAgent} className="gap-2">
                      <Save className="h-4 w-4" />
                      Salvar Configurações
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Steps Tab */}
          <TabsContent value="steps">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Fluxo de Conversão</CardTitle>
                <Button onClick={() => openStepForm()} size="sm" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Nova Etapa
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingSteps ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-border" />
                  </div>
                ) : steps.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="font-medium">Nenhuma etapa definida</h3>
                    <p className="text-sm text-muted-foreground">
                      Adicione etapas para criar um fluxo de conversão para seu agente de IA.
                    </p>
                    <Button onClick={() => openStepForm()} variant="outline" className="mt-2">
                      Adicionar primeira etapa
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right w-28">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {steps.map((step: AiAgentStep) => (
                        <TableRow key={step.id}>
                          <TableCell className="font-medium">{step.order}</TableCell>
                          <TableCell>{step.name}</TableCell>
                          <TableCell className="max-w-md truncate">{step.description}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openStepForm(step)}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteStep(step.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* Step Form Dialog */}
            <Dialog open={stepFormOpen} onOpenChange={setStepFormOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {currentStep ? "Editar Etapa" : "Adicionar Etapa"}
                  </DialogTitle>
                  <DialogDescription>
                    {currentStep
                      ? "Atualize as informações da etapa do fluxo"
                      : "Adicione uma nova etapa ao fluxo de conversão"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="step-name">Nome da Etapa</Label>
                    <Input
                      id="step-name"
                      name="name"
                      placeholder="Etapa de apresentação"
                      value={stepData.name}
                      onChange={handleStepInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step-description">Descrição</Label>
                    <Textarea
                      id="step-description"
                      name="description"
                      placeholder="Descreva o objetivo desta etapa"
                      value={stepData.description}
                      onChange={handleStepInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step-order">Ordem</Label>
                    <Input
                      id="step-order"
                      name="order"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={stepData.order}
                      onChange={handleStepInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mídia</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="step-media"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadMedia(file, "step");
                          }
                        }}
                      />
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => document.getElementById("step-media")?.click()}
                        disabled={isUploading && uploadType === "step"}
                      >
                        {isUploading && uploadType === "step" ? (
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
                      {stepData.mediaUrl && (
                        <span className="text-sm text-muted-foreground">
                          Mídia importada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStepFormOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveStep}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
          
          {/* FAQs Tab */}
          <TabsContent value="faqs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Perguntas Frequentes (FAQs)</CardTitle>
                <Button onClick={() => openFaqForm()} size="sm" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Nova FAQ
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingFaqs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-border" />
                  </div>
                ) : faqs.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="font-medium">Nenhuma FAQ definida</h3>
                    <p className="text-sm text-muted-foreground">
                      Adicione perguntas frequentes para que seu agente possa respondê-las automaticamente.
                    </p>
                    <Button onClick={() => openFaqForm()} variant="outline" className="mt-2">
                      Adicionar primeira FAQ
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pergunta</TableHead>
                        <TableHead>Resposta</TableHead>
                        <TableHead className="text-right w-28">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faqs.map((faq: any) => (
                        <TableRow key={faq.id}>
                          <TableCell className="font-medium max-w-xs truncate">{faq.question}</TableCell>
                          <TableCell className="max-w-sm truncate">{faq.answer}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openFaqForm(faq)}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteFaq(faq.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* FAQ Form Dialog */}
            <Dialog open={faqFormOpen} onOpenChange={setFaqFormOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {currentFaq ? "Editar FAQ" : "Adicionar FAQ"}
                  </DialogTitle>
                  <DialogDescription>
                    {currentFaq
                      ? "Atualize as informações da pergunta frequente"
                      : "Adicione uma nova pergunta frequente para seu agente"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="faq-question">Pergunta</Label>
                    <Input
                      id="faq-question"
                      name="question"
                      placeholder="Qual o horário de funcionamento?"
                      value={faqData.question}
                      onChange={handleFaqInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faq-answer">Resposta</Label>
                    <Textarea
                      id="faq-answer"
                      name="answer"
                      placeholder="Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h."
                      value={faqData.answer}
                      onChange={handleFaqInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mídia</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="faq-media"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadMedia(file, "faq");
                          }
                        }}
                      />
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => document.getElementById("faq-media")?.click()}
                        disabled={isUploading && uploadType === "faq"}
                      >
                        {isUploading && uploadType === "faq" ? (
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
                      {faqData.mediaUrl && (
                        <span className="text-sm text-muted-foreground">
                          Mídia importada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setFaqFormOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveFaq}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}