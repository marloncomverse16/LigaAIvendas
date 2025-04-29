import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupFileUpload } from "./uploads";
import { 
  insertLeadSchema, insertProspectSchema, insertDispatchSchema, insertSettingsSchema, 
  insertAiAgentSchema, insertAiAgentStepsSchema, insertAiAgentFaqsSchema,
  insertLeadInteractionSchema, insertLeadRecommendationSchema,
  insertProspectingSearchSchema, insertProspectingResultSchema,
  insertUserSchema, ConnectionStatus
} from "@shared/schema";
import { z } from "zod";
import axios from "axios";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Setup file upload middleware
  setupFileUpload(app);
  
  // API endpoints
  
  // AI Agent routes - Versão temporária com dados mock
  app.get("/api/ai-agent", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Retorna um agente mockado para demonstração
      const mockAgent = {
        id: 1,
        userId: req.user.id,
        enabled: true,
        triggerText: "Olá! Sou o assistente virtual. Como posso ajudar?",
        personality: "Amigável e profissional",
        expertise: "Atendimento e suporte",
        voiceTone: "Formal",
        rules: "Ser sempre cordial e respeitoso",
        followUpEnabled: true,
        followUpCount: 2,
        messageInterval: "30 minutos",
        followUpPrompt: "Ainda precisa de ajuda com algo?",
        schedulingEnabled: true,
        agendaId: "agenda123",
        schedulingPromptConsult: "Gostaria de agendar uma consulta?",
        schedulingPromptTime: "Qual o melhor horário para você?",
        schedulingDuration: "30 minutos",
        autoMoveCrm: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(mockAgent);
    } catch (error) {
      console.error("Erro ao buscar agente de IA:", error);
      res.status(500).json({ message: "Erro ao buscar agente de IA" });
    }
  });
  
  app.put("/api/ai-agent", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Simula sucesso na atualização e retorna dados combinados
      const agentData = req.body;
      
      const updatedAgent = {
        id: 1,
        userId: req.user.id,
        enabled: agentData.enabled !== undefined ? agentData.enabled : true,
        triggerText: agentData.triggerText || "Olá! Sou o assistente virtual. Como posso ajudar?",
        personality: agentData.personality || "Amigável e profissional",
        expertise: agentData.expertise || "Atendimento e suporte",
        voiceTone: agentData.voiceTone || "Formal",
        rules: agentData.rules || "Ser sempre cordial e respeitoso",
        followUpEnabled: agentData.followUpEnabled !== undefined ? agentData.followUpEnabled : true,
        followUpCount: agentData.followUpCount || 2,
        messageInterval: agentData.messageInterval || "30 minutos",
        followUpPrompt: agentData.followUpPrompt || "Ainda precisa de ajuda com algo?",
        schedulingEnabled: agentData.schedulingEnabled !== undefined ? agentData.schedulingEnabled : true,
        agendaId: agentData.agendaId || "agenda123",
        schedulingPromptConsult: agentData.schedulingPromptConsult || "Gostaria de agendar uma consulta?",
        schedulingPromptTime: agentData.schedulingPromptTime || "Qual o melhor horário para você?",
        schedulingDuration: agentData.schedulingDuration || "30 minutos",
        autoMoveCrm: agentData.autoMoveCrm !== undefined ? agentData.autoMoveCrm : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(updatedAgent);
    } catch (error) {
      console.error("Erro ao atualizar agente de IA:", error);
      res.status(500).json({ message: "Erro ao atualizar agente de IA" });
    }
  });
  
  // AI Agent Steps - Versão temporária com dados mock
  app.get("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Retorna etapas mockadas para demonstração
      const mockSteps = [
        {
          id: 1,
          userId: req.user.id,
          name: "Apresentação",
          description: "Introdução ao produto e serviços",
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        },
        {
          id: 2,
          userId: req.user.id,
          name: "Identificação de Necessidades",
          description: "Entender as necessidades do cliente",
          order: 2,
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        },
        {
          id: 3,
          userId: req.user.id,
          name: "Demonstração",
          description: "Demonstrar como o produto resolve o problema",
          order: 3,
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        }
      ];
      
      res.json(mockSteps);
    } catch (error) {
      console.error("Erro ao buscar etapas do agente:", error);
      res.status(500).json({ message: "Erro ao buscar etapas do agente" });
    }
  });
  
  app.post("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const stepData = req.body;
      
      // Simula criação de uma nova etapa
      const newStep = {
        id: Math.floor(Math.random() * 1000) + 10,
        userId: req.user.id,
        name: stepData.name,
        description: stepData.description || null,
        order: stepData.order,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        mediaUrl: null
      };
      
      res.status(201).json(newStep);
    } catch (error) {
      console.error("Erro ao criar etapa:", error);
      res.status(500).json({ message: "Erro ao criar etapa" });
    }
  });
  
  app.put("/api/ai-agent/steps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const stepId = parseInt(req.params.id);
      const stepData = req.body;
      
      // Simula atualização de uma etapa
      const updatedStep = {
        id: stepId,
        userId: req.user.id,
        name: stepData.name || "Etapa",
        description: stepData.description || null,
        order: stepData.order || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaUrl: null
      };
      
      res.json(updatedStep);
    } catch (error) {
      console.error("Erro ao atualizar etapa:", error);
      res.status(500).json({ message: "Erro ao atualizar etapa" });
    }
  });
  
  app.delete("/api/ai-agent/steps/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Simplesmente retorna sucesso
    res.status(204).send();
  });
  
  // AI Agent FAQs - Versão temporária com dados mock
  app.get("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Retorna FAQs mockadas para demonstração
      const mockFaqs = [
        {
          id: 1,
          userId: req.user.id,
          question: "Quais são os horários de atendimento?",
          answer: "Nosso atendimento funciona de segunda a sexta, das 8h às 18h.",
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        },
        {
          id: 2,
          userId: req.user.id,
          question: "Como posso solicitar um orçamento?",
          answer: "Você pode solicitar um orçamento diretamente pelo site ou entrando em contato pelo telefone.",
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        },
        {
          id: 3,
          userId: req.user.id,
          question: "Qual é o prazo de entrega dos produtos?",
          answer: "O prazo de entrega varia de acordo com a região, mas normalmente é de 3 a 5 dias úteis.",
          createdAt: new Date().toISOString(),
          updatedAt: null,
          mediaUrl: null
        }
      ];
      
      res.json(mockFaqs);
    } catch (error) {
      console.error("Erro ao buscar FAQs do agente:", error);
      res.status(500).json({ message: "Erro ao buscar FAQs do agente" });
    }
  });
  
  app.post("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const faqData = req.body;
      
      // Simula criação de uma nova FAQ
      const newFaq = {
        id: Math.floor(Math.random() * 1000) + 10,
        userId: req.user.id,
        question: faqData.question,
        answer: faqData.answer,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        mediaUrl: null
      };
      
      res.status(201).json(newFaq);
    } catch (error) {
      console.error("Erro ao criar FAQ:", error);
      res.status(500).json({ message: "Erro ao criar FAQ" });
    }
  });
  
  app.put("/api/ai-agent/faqs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const faqId = parseInt(req.params.id);
      const faqData = req.body;
      
      // Simula atualização de uma FAQ
      const updatedFaq = {
        id: faqId,
        userId: req.user.id,
        question: faqData.question || "Pergunta",
        answer: faqData.answer || "Resposta",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaUrl: null
      };
      
      res.json(updatedFaq);
    } catch (error) {
      console.error("Erro ao atualizar FAQ:", error);
      res.status(500).json({ message: "Erro ao atualizar FAQ" });
    }
  });
  
  app.delete("/api/ai-agent/faqs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Simplesmente retorna sucesso
    res.status(204).send();
  });
  
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
      
      // Get user for token info
      const user = await storage.getUser(id);
      
      // Check whatsapp connection status (mocked)
      const whatsappStatus = "desconectado";
      
      // Get available tokens
      const availableTokens = user?.availableTokens || 0;
      
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
  
  // Admin Routes
  // Middleware para checar se o usuário é admin
  const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const user = await storage.getUser(id);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado. Permissão de administrador necessária." });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: "Erro ao verificar permissões" });
    }
  };
  
  // Listar todos os usuários (admin)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });
  
  // Criar usuário (admin)
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }
      
      // Hash da senha
      const hashedPassword = await hashPassword(userData.password);
      
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });
  
  // Obter usuário por ID (admin)
  app.get("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });
  
  // Atualizar usuário (admin)
  app.put("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Validate update data
      const updateData = insertUserSchema.partial().parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // If updating username, check if it's already taken
      if (updateData.username && updateData.username !== existingUser.username) {
        const userWithUsername = await storage.getUserByUsername(updateData.username);
        if (userWithUsername && userWithUsername.id !== userId) {
          return res.status(400).json({ message: "Nome de usuário já existe" });
        }
      }
      
      // If updating email, check if it's already taken
      if (updateData.email && updateData.email !== existingUser.email) {
        const userWithEmail = await storage.getUserByEmail(updateData.email);
        if (userWithEmail && userWithEmail.id !== userId) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }
      
      // If updating password, hash it
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.format() });
      }
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });
  
  // Excluir usuário (admin)
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Não permitir que um admin exclua a si mesmo
      if (userId === (req.user as Express.User).id) {
        return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
      }
      
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
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
  
  // Connection API Endpoints - WhatsApp Connect via Webhook
  // Status de conexão armazenado em memória
  const connectionStatus: Record<number, ConnectionStatus> = {};
  
  app.get("/api/connection/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      
      // Se não tiver um status ainda, retorna desconectado
      if (!connectionStatus[id]) {
        connectionStatus[id] = { 
          connected: false,
          lastUpdated: new Date()
        };
      }
      
      res.json(connectionStatus[id]);
    } catch (error) {
      console.error("Erro ao verificar status da conexão:", error);
      res.status(500).json({ message: "Erro ao verificar status da conexão" });
    }
  });
  
  app.post("/api/connection/connect", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Usar a URL configurada pelo usuário
      const webhookUrl = user.whatsappWebhookUrl;
      
      if (!webhookUrl) {
        return res.status(400).json({ message: "URL de webhook do WhatsApp não configurada para este usuário" });
      }
      
      console.log(`Tentando conectar usando webhook: ${webhookUrl}`);
      
      try {
        // Tenta fazer a chamada para o webhook para obter o QR code
        const response = await axios.post(webhookUrl, {
          action: "requestQrCode",
          userId: id,
          username: user.username,
          callbackUrl: `${req.protocol}://${req.get('host')}/api/connection/callback`
        });
        
        if (response.data && response.data.qrCode) {
          // Se o webhook retornou um QR code, usamos ele
          connectionStatus[id] = {
            connected: false,
            qrCode: response.data.qrCode,
            lastUpdated: new Date()
          };
        } else {
          // Se não tem QR code na resposta, usamos um código temporário para teste
          connectionStatus[id] = {
            connected: false,
            qrCode: "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",
            lastUpdated: new Date()
          };
        }
      } catch (error) {
        console.error("Erro ao conectar via webhook:", error);
        
        // Em caso de erro na chamada do webhook, usamos QR code de teste
        connectionStatus[id] = {
          connected: false,
          qrCode: "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",
          lastUpdated: new Date()
        };
      }
        
      return res.json(connectionStatus[id]);
    } catch (error) {
      console.error("Erro ao iniciar conexão:", error);
      res.status(500).json({ message: "Erro ao iniciar conexão" });
    }
}
