import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupFileUpload } from "./uploads";
import { 
  insertLeadSchema, insertProspectSchema, insertDispatchSchema, insertSettingsSchema, 
  insertAiAgentSchema, insertAiAgentStepsSchema, insertAiAgentFaqsSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Setup file upload middleware
  setupFileUpload(app);
  
  // API endpoints
  
  // User profile
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });
  
  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const { name, company, phone, bio } = req.body;
      
      const updatedUser = await storage.updateUser(id, {
        name,
        company,
        phone,
        bio
      });
      
      if (!updatedUser) return res.status(404).json({ message: "Usuário não encontrado" });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });
  
  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      
      const leadsCount = await storage.countLeadsByUserId(id);
      const prospectsCount = await storage.countProspectsByUserId(id);
      const dispatchesCount = await storage.countDispatchesByUserId(id);
      
      // Get settings for theme
      const settings = await storage.getSettingsByUserId(id) || {
        darkMode: false,
        primaryColor: "#047857",
        secondaryColor: "#4f46e5",
        logoUrl: null
      };
      
      // Check whatsapp connection status (mocked)
      const whatsappStatus = "desconectado";
      
      // Get available tokens (mocked)
      const availableTokens = 1500;
      
      // Get dispatch status (mocked)
      const dispatchStatus = "inativo";
      
      res.json({
        leadsCount,
        prospectsCount,
        dispatchesCount,
        whatsappStatus,
        availableTokens,
        dispatchStatus,
        settings
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
  
  // Metrics/Charts
  app.get("/api/metrics", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const metrics = await storage.getMetricsByUserId(id);
      
      // Sort metrics by year and month order
      const monthOrder = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
      ];
      
      metrics.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return monthOrder.indexOf(a.month.toLowerCase()) - monthOrder.indexOf(b.month.toLowerCase());
      });
      
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar métricas" });
    }
  });
  
  // Leads
  app.get("/api/leads", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const leads = await storage.getLeadsByUserId(id);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar leads" });
    }
  });
  
  app.post("/api/leads", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const leadData = insertLeadSchema.parse(req.body);
      
      const newLead = await storage.createLead({
        ...leadData,
        userId: id
      });
      
      res.status(201).json(newLead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao criar lead" });
    }
  });
  
  // Prospects
  app.get("/api/prospects", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const prospects = await storage.getProspectsByUserId(id);
      res.json(prospects);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar prospecções" });
    }
  });
  
  app.post("/api/prospects", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const prospectData = insertProspectSchema.parse(req.body);
      
      const newProspect = await storage.createProspect({
        ...prospectData,
        userId: id
      });
      
      res.status(201).json(newProspect);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao criar prospecção" });
    }
  });
  
  // Dispatches
  app.get("/api/dispatches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const dispatches = await storage.getDispatchesByUserId(id);
      res.json(dispatches);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar disparos" });
    }
  });
  
  app.post("/api/dispatches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const dispatchData = insertDispatchSchema.parse(req.body);
      
      const newDispatch = await storage.createDispatch({
        ...dispatchData,
        userId: id
      });
      
      res.status(201).json(newDispatch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao criar disparo" });
    }
  });
  
  // Settings
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const settings = await storage.getSettingsByUserId(id);
      
      if (!settings) {
        // Create default settings if they don't exist
        const defaultSettings = await storage.createSettings({
          userId: id,
          logoUrl: null,
          primaryColor: "#047857",
          secondaryColor: "#4f46e5",
          darkMode: false
        });
        
        return res.json(defaultSettings);
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });
  
  app.put("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      
      const updatedSettings = await storage.updateSettings(id, settingsData);
      
      if (!updatedSettings) {
        return res.status(404).json({ message: "Configurações não encontradas" });
      }
      
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // AI Agent
  app.get("/api/ai-agent", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const agent = await storage.getAiAgentByUserId(id);
      
      if (!agent) {
        // Create default agent if it doesn't exist
        const defaultAgent = await storage.createAiAgent({
          userId: id,
          enabled: false,
          triggerText: "Olá, sou o assistente virtual da LiguIA. Como posso ajudar?",
          personality: "Profissional e prestativo",
          expertise: "Atendimento ao cliente",
          voiceTone: "Formal",
          rules: "Responda apenas sobre informações da empresa",
          followUpEnabled: false,
          followUpCount: 0,
          messageInterval: "30 minutos",
          followUpPrompt: "Gostaria de mais informações?",
          schedulingEnabled: false,
          agendaId: null,
          schedulingPromptConsult: "Gostaria de agendar uma consulta?",
          schedulingPromptTime: "Qual horário seria melhor para você?",
          schedulingDuration: "30 minutos"
        });
        
        return res.json(defaultAgent);
      }
      
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar agente de IA" });
    }
  });
  
  app.put("/api/ai-agent", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const agentData = insertAiAgentSchema.partial().parse(req.body);
      
      // Check if agent exists
      const existingAgent = await storage.getAiAgentByUserId(id);
      
      if (!existingAgent) {
        // Create agent if it doesn't exist
        const newAgent = await storage.createAiAgent({
          ...agentData,
          userId: id
        } as any);
        
        return res.status(201).json(newAgent);
      }
      
      // Update existing agent
      const updatedAgent = await storage.updateAiAgent(id, agentData);
      
      if (!updatedAgent) {
        return res.status(404).json({ message: "Agente de IA não encontrado" });
      }
      
      res.json(updatedAgent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao atualizar agente de IA" });
    }
  });
  
  // AI Agent Steps
  app.get("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const steps = await storage.getAiAgentSteps(id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar etapas do agente de IA" });
    }
  });
  
  app.post("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const stepData = insertAiAgentStepsSchema.parse(req.body);
      
      const newStep = await storage.createAiAgentStep({
        ...stepData,
        userId: id
      });
      
      res.status(201).json(newStep);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao criar etapa do agente de IA" });
    }
  });
  
  app.put("/api/ai-agent/steps/:stepId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const { stepId } = req.params;
      const stepData = insertAiAgentStepsSchema.partial().parse(req.body);
      
      // Verify user owns this step
      const step = await storage.getAiAgentStep(Number(stepId));
      if (!step || step.userId !== id) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      
      const updatedStep = await storage.updateAiAgentStep(Number(stepId), stepData);
      
      if (!updatedStep) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      
      res.json(updatedStep);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao atualizar etapa do agente de IA" });
    }
  });
  
  app.delete("/api/ai-agent/steps/:stepId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const { stepId } = req.params;
      
      // Verify user owns this step
      const step = await storage.getAiAgentStep(Number(stepId));
      if (!step || step.userId !== id) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      
      const success = await storage.deleteAiAgentStep(Number(stepId));
      
      if (!success) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir etapa do agente de IA" });
    }
  });
  
  // AI Agent FAQs
  app.get("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const faqs = await storage.getAiAgentFaqs(id);
      res.json(faqs);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar FAQs do agente de IA" });
    }
  });
  
  app.post("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const faqData = insertAiAgentFaqsSchema.parse(req.body);
      
      const newFaq = await storage.createAiAgentFaq({
        ...faqData,
        userId: id
      });
      
      res.status(201).json(newFaq);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao criar FAQ do agente de IA" });
    }
  });
  
  app.put("/api/ai-agent/faqs/:faqId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const { faqId } = req.params;
      const faqData = insertAiAgentFaqsSchema.partial().parse(req.body);
      
      // Verify user owns this FAQ
      const faq = await storage.getAiAgentFaq(Number(faqId));
      if (!faq || faq.userId !== id) {
        return res.status(404).json({ message: "FAQ não encontrada" });
      }
      
      const updatedFaq = await storage.updateAiAgentFaq(Number(faqId), faqData);
      
      if (!updatedFaq) {
        return res.status(404).json({ message: "FAQ não encontrada" });
      }
      
      res.json(updatedFaq);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      res.status(500).json({ message: "Erro ao atualizar FAQ do agente de IA" });
    }
  });
  
  app.delete("/api/ai-agent/faqs/:faqId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const { faqId } = req.params;
      
      // Verify user owns this FAQ
      const faq = await storage.getAiAgentFaq(Number(faqId));
      if (!faq || faq.userId !== id) {
        return res.status(404).json({ message: "FAQ não encontrada" });
      }
      
      const success = await storage.deleteAiAgentFaq(Number(faqId));
      
      if (!success) {
        return res.status(404).json({ message: "FAQ não encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir FAQ do agente de IA" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
