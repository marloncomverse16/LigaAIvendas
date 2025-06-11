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

// Rastrear o status de conexão de cada usuário
interface ConnectionData {
  connected: boolean;
  qrCode?: string;
  lastUpdated: Date;
}

const connectionStatus: Record<number, ConnectionData> = {};

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
  
  app.get("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Retorna etapas mockadas para demonstração
      const mockSteps = [
        {
          id: 1,
          aiAgentId: 1,
          order: 1,
          question: "Qual sua necessidade principal?",
          answerOptions: ["Suporte", "Orçamento", "Dúvidas"],
          nextStepLogic: { Suporte: 2, Orçamento: 3, Dúvidas: 4 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          aiAgentId: 1,
          order: 2,
          question: "Qual área você precisa de suporte?",
          answerOptions: ["Técnico", "Financeiro", "Uso do produto"],
          nextStepLogic: { Técnico: 5, Financeiro: 6, "Uso do produto": 7 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 3,
          aiAgentId: 1,
          order: 3,
          question: "Que tipo de orçamento você precisa?",
          answerOptions: ["Produto completo", "Módulos específicos", "Serviços"],
          nextStepLogic: { "Produto completo": 8, "Módulos específicos": 9, Serviços: 10 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json(mockSteps);
    } catch (error) {
      console.error("Erro ao buscar etapas do agente:", error);
      res.status(500).json({ message: "Erro ao buscar etapas do agente" });
    }
  });
  
  app.put("/api/ai-agent/steps", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const stepsData = req.body;
      
      // Simula atualização e retorna os dados enviados
      res.json(stepsData);
    } catch (error) {
      console.error("Erro ao atualizar etapas do agente:", error);
      res.status(500).json({ message: "Erro ao atualizar etapas do agente" });
    }
  });
  
  app.get("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Retorna FAQs mockadas para demonstração
      const mockFaqs = [
        {
          id: 1,
          aiAgentId: 1,
          question: "Como faço para recuperar minha senha?",
          answer: "Para recuperar sua senha, clique em 'Esqueci minha senha' na tela de login e siga as instruções enviadas ao seu e-mail.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          aiAgentId: 1,
          question: "Quais são os horários de atendimento?",
          answer: "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, exceto feriados nacionais.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 3,
          aiAgentId: 1,
          question: "Como faço para cancelar minha assinatura?",
          answer: "Para cancelar sua assinatura, acesse seu perfil, vá em 'Minha assinatura' e clique no botão 'Cancelar'. Lembre-se que você pode ter acesso ao serviço até o final do período já pago.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json(mockFaqs);
    } catch (error) {
      console.error("Erro ao buscar FAQs do agente:", error);
      res.status(500).json({ message: "Erro ao buscar FAQs do agente" });
    }
  });
  
  app.put("/api/ai-agent/faqs", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const faqsData = req.body;
      
      // Simula atualização e retorna os dados enviados
      res.json(faqsData);
    } catch (error) {
      console.error("Erro ao atualizar FAQs do agente:", error);
      res.status(500).json({ message: "Erro ao atualizar FAQs do agente" });
    }
  });
  
  app.post("/api/leads", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const leadData = insertLeadSchema.parse(req.body);
      
      // Simula criação de lead e retorna com ID
      const newLead = {
        ...leadData,
        id: Math.floor(Math.random() * 1000) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.status(201).json(newLead);
    } catch (error) {
      console.error("Erro ao criar lead:", error);
      res.status(500).json({ message: "Erro ao criar lead" });
    }
  });
  
  app.get("/api/leads", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Simula lista de leads
      const mockLeads = [
        {
          id: 1,
          name: "João Silva",
          company: "Empresa A",
          email: "joao@empresaa.com",
          phone: "+5511999999999",
          source: "Website",
          status: "Novo",
          assignedTo: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          name: "Maria Oliveira",
          company: "Empresa B",
          email: "maria@empresab.com",
          phone: "+5511888888888",
          source: "Indicação",
          status: "Em contato",
          assignedTo: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json(mockLeads);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      res.status(500).json({ message: "Erro ao buscar leads" });
    }
  });
  
  app.get("/api/leads/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const leadId = parseInt(req.params.id);
      
      // Simula um único lead
      const mockLead = {
        id: leadId,
        name: "João Silva",
        company: "Empresa A",
        email: "joao@empresaa.com",
        phone: "+5511999999999",
        source: "Website",
        status: "Novo",
        assignedTo: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json(mockLead);
    } catch (error) {
      console.error("Erro ao buscar lead:", error);
      res.status(500).json({ message: "Erro ao buscar lead" });
    }
  });
  
  app.put("/api/leads/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const leadId = parseInt(req.params.id);
      const leadData = req.body;
      
      // Simula atualização de lead
      const updatedLead = {
        ...leadData,
        id: leadId,
        updatedAt: new Date().toISOString()
      };
      
      res.json(updatedLead);
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      res.status(500).json({ message: "Erro ao atualizar lead" });
    }
  });
  
  app.post("/api/leads/:id/interactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const leadId = parseInt(req.params.id);
      const interactionData = insertLeadInteractionSchema.parse(req.body);
      
      // Simula criação de interação
      const newInteraction = {
        ...interactionData,
        id: Math.floor(Math.random() * 1000) + 1,
        leadId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.status(201).json(newInteraction);
    } catch (error) {
      console.error("Erro ao criar interação:", error);
      res.status(500).json({ message: "Erro ao criar interação" });
    }
  });
  
  app.get("/api/leads/:id/interactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const leadId = parseInt(req.params.id);
      
      // Simula lista de interações
      const mockInteractions = [
        {
          id: 1,
          leadId,
          type: "Email",
          content: "Primeiro contato enviado",
          outcome: "Aguardando resposta",
          createdBy: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          leadId,
          type: "Ligação",
          content: "Cliente interessado no produto X",
          outcome: "Agendar demonstração",
          createdBy: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json(mockInteractions);
    } catch (error) {
      console.error("Erro ao buscar interações:", error);
      res.status(500).json({ message: "Erro ao buscar interações" });
    }
  });
  
  app.get("/api/leads/recommendations", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Simula recomendações de leads
      const mockRecommendations = [
        {
          id: 1,
          leadId: 3,
          reason: "Perfil similar a clientes convertidos",
          score: 0.85,
          actions: ["Ligar", "Enviar material sobre produto X"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          leadId: 7,
          reason: "Visitou site várias vezes na última semana",
          score: 0.78,
          actions: ["Oferecer demonstração", "Enviar proposta"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      res.json(mockRecommendations);
    } catch (error) {
      console.error("Erro ao buscar recomendações:", error);
      res.status(500).json({ message: "Erro ao buscar recomendações" });
    }
  });
  
  // Rota para verificar o status da conexão com WhatsApp
  app.get("/api/connection/status", async (req, res) => {
    // Removendo a verificação de autenticação temporariamente para fins de depuração
    // if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Usar um ID fixo para testes se não estiver autenticado
      const id = req.isAuthenticated() ? (req.user as Express.User).id : 1;
      
      // Se não tiver status, retorna desconectado
      if (!connectionStatus[id]) {
        connectionStatus[id] = {
          connected: false,
          lastUpdated: new Date()
        };
      }
      
      res.json(connectionStatus[id]);
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      res.status(500).json({ message: "Erro ao verificar status" });
    }
  });
  
  // Rota para conectar o WhatsApp
  app.post("/api/connection/connect", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Preparar o QR Code ou status de conexão
      connectionStatus[userId] = {
        connected: false,
        qrCode: "data:image/png;base64,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",
        lastUpdated: new Date()
      };
      
      // Simular que após 8 segundos a conexão foi estabelecida
      setTimeout(() => {
        if (connectionStatus[userId]) {
          connectionStatus[userId] = {
            connected: true,
            name: "Meu WhatsApp",
            phone: "+5511999999999",
            lastUpdated: new Date()
          };
        }
      }, 8000);
      
      res.json(connectionStatus[userId]);
    } catch (error) {
      console.error("Erro ao conectar:", error);
      res.status(500).json({ message: "Erro ao conectar" });
    }
  });
  
  // Rota para desconectar o WhatsApp
  app.post("/api/connection/disconnect", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      
      // Simular desconexão
      connectionStatus[userId] = {
        connected: false,
        lastUpdated: new Date()
      };
      
      res.json(connectionStatus[userId]);
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      res.status(500).json({ message: "Erro ao desconectar" });
    }
  });
  
  // Admin - Usuários
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Verificar se o usuário é admin
      const user = await storage.getUser((req.user as Express.User).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });
  
  // Verificação de permissão de admin
  const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      const user = await storage.getUser((req.user as Express.User).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Acesso negado - requer permissão de administrador" });
      }
      next();
    } catch (error) {
      console.error("Erro ao verificar permissão de admin:", error);
      res.status(500).json({ message: "Erro ao verificar permissão" });
    }
  };
  
  // Admin - Criar usuário
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      // Validar dados do novo usuário
      const userData = insertUserSchema.parse(req.body);
      
      // Verificar se username já existe
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Criptografar senha
      const hashedPassword = await hashPassword(userData.password);
      
      // Criar novo usuário
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Remover senha da resposta
      const { password, ...userResponse } = newUser;
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });
  
  // Admin - Atualizar usuário
  app.put("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      // Verificar se usuário existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Se a senha for fornecida, criptografá-la
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Atualizar usuário
      const updatedUser = await storage.updateUser(userId, userData);
      
      // Remover senha da resposta
      const { password, ...userResponse } = updatedUser;
      
      res.json(userResponse);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });
  
  // Admin - Excluir usuário
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Verificar se usuário existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Impedir exclusão do próprio usuário admin
      if (userId === (req.user as Express.User).id) {
        return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
      }
      
      // Excluir usuário
      await storage.deleteUser(userId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });
  
  // Configurações de usuário
  app.get("/api/settings", async (req, res) => {
    try {
      let settings;
      
      if (req.isAuthenticated()) {
        settings = await storage.getSettingsForUser((req.user as Express.User).id);
      }
      
      // Se não encontrou ou não está autenticado, retorna configurações padrão
      if (!settings) {
        settings = {
          id: 0,
          userId: 0,
          logoUrl: null,
          primaryColor: "#047857",  // Padrão verde
          secondaryColor: "#4f46e5", // Padrão indigo
          darkMode: false
        };
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });
  
  app.put("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const settingsData = insertSettingsSchema.parse(req.body);
      
      // Verificar se já existe configurações para o usuário
      let settings = await storage.getSettingsForUser(userId);
      
      if (settings) {
        // Atualizar configurações existentes
        settings = await storage.updateSettings(settings.id, settingsData);
      } else {
        // Criar novas configurações
        settings = await storage.createSettings({
          ...settingsData,
          userId
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });
  
  // Carregar informações do usuário atual
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const user = await storage.getUser((req.user as Express.User).id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Remover senha da resposta
      const { password, ...userResponse } = user;
      
      res.json(userResponse);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });
  
  // Atualizar perfil do usuário atual
  app.put("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const userData = req.body;
      
      // Se a senha for fornecida, criptografá-la
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Atualizar usuário
      const updatedUser = await storage.updateUser(userId, userData);
      
      // Remover senha da resposta
      const { password, ...userResponse } = updatedUser;
      
      res.json(userResponse);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });
  
  // Atualizar senha do usuário atual
  app.put("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }
      
      // Verificar se a senha atual está correta
      const user = await storage.getUser(userId);
      if (!user || !(await comparePasswords(currentPassword, user.password))) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }
      
      // Atualizar senha
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.status(200).json({ message: "Senha atualizada com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      res.status(500).json({ message: "Erro ao atualizar senha" });
    }
  });
  
  // Estatísticas do dashboard
  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Dados mockados para o dashboard
      const stats = {
        leads: {
          total: 156,
          novosMes: 32,
          emNegociacao: 48,
          convertidos: 15
        },
        prospecções: {
          realizadas: 24,
          resultados: 347,
          pendentes: 2
        },
        atendimentos: {
          total: 189,
          concluidos: 175,
          emAndamento: 14
        },
        dashboardData: {
          conversoes: [12, 19, 15, 32, 22, 14, 15, 21, 33, 28, 19, 12],
          interacoes: [45, 56, 62, 51, 49, 63, 72, 68, 55, 49, 72, 50]
        }
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
  
  // Dados de métricas
  app.get("/api/metrics", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Dados mockados para métricas
      const currentYear = new Date().getFullYear();
      const metrics = [
        {
          month: "Janeiro",
          year: currentYear,
          leadsCount: 24,
          prospectsCount: 45,
          dispatchesCount: 120
        },
        {
          month: "Fevereiro",
          year: currentYear,
          leadsCount: 32,
          prospectsCount: 52,
          dispatchesCount: 140
        },
        {
          month: "Março",
          year: currentYear,
          leadsCount: 45,
          prospectsCount: 68,
          dispatchesCount: 155
        },
        {
          month: "Abril",
          year: currentYear,
          leadsCount: 52,
          prospectsCount: 72,
          dispatchesCount: 180
        }
      ];
      
      res.json(metrics);
    } catch (error) {
      console.error("Erro ao buscar métricas:", error);
      res.status(500).json({ message: "Erro ao buscar métricas" });
    }
  });
  
  // Prospecção
  app.get("/api/prospecting/searches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      console.log(`Buscando pesquisas para o usuário ${userId}`);
      
      // Buscar pesquisas do usuário
      const searches = await storage.getProspectingSearches(userId);
      console.log(`Encontradas ${searches.length} pesquisas para o usuário ${userId}:`, searches);
      
      res.json(searches);
    } catch (error) {
      console.error("Erro ao buscar pesquisas:", error);
      res.status(500).json({ message: "Erro ao buscar pesquisas" });
    }
  });
  
  app.post("/api/prospecting/searches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const searchData = insertProspectingSearchSchema.parse(req.body);
      
      // Buscar o servidor conectado do usuário para obter o webhook de prospecção
      const userServers = await storage.getUserServers(userId);
      if (userServers.length === 0) {
        return res.status(400).json({ message: "Nenhum servidor configurado para este usuário" });
      }
      
      const serverConfig = userServers[0]; // Usar o primeiro servidor (principal)
      const prospectingWebhookUrl = serverConfig.server?.prospectingWebhookUrl;
      
      if (!prospectingWebhookUrl) {
        return res.status(400).json({ 
          message: "Webhook de prospecção não configurado no servidor conectado" 
        });
      }
      
      console.log(`🔗 Usando webhook de prospecção do servidor: ${prospectingWebhookUrl}`);
      
      // Criar nova pesquisa com o webhook do servidor
      const search = await storage.createProspectingSearch({
        ...searchData,
        userId,
        status: "pendente",
        webhookUrl: prospectingWebhookUrl
      });
      
      // Fazer a chamada para o webhook
      console.log("Chamando webhook de prospecção:", prospectingWebhookUrl);
        
        try {
          const webhookResponse = await axios.get(prospectingWebhookUrl, {
            params: {
              segment: searchData.segment,
              city: searchData.city,
              filters: searchData.filters
            }
          });
          
          // Marcar pesquisa como concluída
          const newSearch = await storage.updateProspectingSearch(search.id, {
            status: "concluido",
            completedAt: new Date(),
            leadsFound: Array.isArray(webhookResponse.data) ? webhookResponse.data.length : 
              (webhookResponse.data && Array.isArray(webhookResponse.data.data)) ? webhookResponse.data.data.length : 0
          });
          
          // Processar dados retornados
          if (Array.isArray(webhookResponse.data)) {
            // Se for um array de resultados
            // Para cada item no array, criar um resultado
            await Promise.all(webhookResponse.data.map(async (item) => {
              try {
                // Adaptar campos com base no formato dos dados
                const nome = item.nome || item.name || item.razaoSocial || null;
                const telefone = item.telefone || item.phone || item.celular || null;
                const email = item.email || null;
                const endereco = item.endereco || item.address || null;
                const tipo = item.tipo || item.type || null;
                const cidade = item.cidade || item.city || searchData.city || null;
                const estado = item.estado || item.state || item.uf || null;
                const site = item.site || item.website || null;
                
                // Criar resultado no banco
                await storage.createProspectingResult({
                  searchId: newSearch.id,
                  name: nome,
                  phone: telefone,
                  email: email,
                  address: endereco,
                  type: tipo,
                  site: site,
                  cidade: cidade,
                  estado: estado
                });
              } catch (itemError) {
                console.error("Erro ao processar item de resultado:", itemError);
              }
            }));
          } else if (webhookResponse.data && Array.isArray(webhookResponse.data.data)) {
            // Se for um objeto com array de dados
            await Promise.all(webhookResponse.data.data.map(async (item) => {
              try {
                const nome = item.nome || item.name || item.razaoSocial || null;
                const telefone = item.telefone || item.phone || item.celular || null;
                const email = item.email || null;
                const endereco = item.endereco || item.address || null;
                const tipo = item.tipo || item.type || null;
                const cidade = item.cidade || item.city || searchData.city || null;
                const estado = item.estado || item.state || item.uf || null;
                const site = item.site || item.website || null;
                
                await storage.createProspectingResult({
                  searchId: newSearch.id,
                  name: nome,
                  phone: telefone,
                  email: email,
                  address: endereco,
                  type: tipo,
                  site: site,
                  cidade: cidade,
                  estado: estado
                });
              } catch (itemError) {
                console.error("Erro ao processar item de resultado:", itemError);
              }
            }));
          }
          
          console.log("Busca criada com dados do webhook:", newSearch);
          return res.status(201).json(newSearch);
        } catch (webhookError) {
          console.error("Erro ao chamar webhook:", webhookError);
          
          // Marcar pesquisa como erro
          const errorSearch = await storage.updateProspectingSearch(search.id, {
            status: "erro",
            completedAt: new Date()
          });
          
          return res.status(400).json({
            message: "Erro ao processar busca via webhook",
            error: webhookError.message,
            search: errorSearch
          });
        }
    } catch (error) {
      console.error("Erro ao criar pesquisa:", error);
      res.status(500).json({ message: "Erro ao criar pesquisa" });
    }
  });
  
  app.get("/api/prospecting/searches/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      res.json(search);
    } catch (error) {
      console.error("Erro ao buscar pesquisa:", error);
      res.status(500).json({ message: "Erro ao buscar pesquisa" });
    }
  });
  
  app.get("/api/prospecting/searches/:id/results", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa para verificar propriedade
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar resultados
      const results = await storage.getProspectingResults(searchId);
      
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar resultados:", error);
      res.status(500).json({ message: "Erro ao buscar resultados" });
    }
  });
  
  app.post("/api/prospecting/searches/:id/dispatch", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar usuário para obter webhook de integração
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      if (!user.dispatchesWebhookUrl) {
        return res.status(400).json({ message: "Webhook de envios não configurado" });
      }
      
      // Buscar resultados
      const results = await storage.getProspectingResults(searchId);
      
      if (results.length === 0) {
        return res.status(400).json({ message: "Não há resultados para enviar" });
      }
      
      // Preparar histórico de envio
      const historyEntry = await storage.createProspectingDispatchHistory({
        searchId,
        executedBy: userId,
        resultsCount: results.length,
        success: true
      });
      
      try {
        // Chamar webhook com os resultados
        await axios.post(user.dispatchesWebhookUrl, {
          searchId,
          searchInfo: {
            segment: search.segment,
            city: search.city,
            filters: search.filters
          },
          results: results
        });
        
        // Marcar resultados como enviados
        const now = new Date();
        await Promise.all(results.map(async (result) => {
          await storage.updateProspectingResult(result.id, {
            dispatchedAt: now
          });
        }));
        
        // Atualizar contadores na pesquisa
        await storage.updateProspectingSearch(searchId, {
          dispatchesDone: (search.dispatchesDone || 0) + 1,
          dispatchesPending: 0
        });
        
        res.json({
          message: "Resultados enviados com sucesso",
          dispatchCount: results.length,
          historyId: historyEntry.id
        });
      } catch (webhookError) {
        console.error("Erro ao chamar webhook de envios:", webhookError);
        
        // Atualizar histórico com erro
        await storage.updateProspectingDispatchHistory(historyEntry.id, {
          success: false,
          errorMessage: webhookError.message || "Erro desconhecido"
        });
        
        res.status(500).json({
          message: "Erro ao enviar resultados",
          error: webhookError.message
        });
      }
    } catch (error) {
      console.error("Erro ao processar envio:", error);
      res.status(500).json({ message: "Erro ao processar envio" });
    }
  });
  
  // Agendamento de envios
  app.get("/api/prospecting/searches/:id/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa para verificar propriedade
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar agendamentos
      const schedules = await storage.getProspectingSchedules(searchId);
      
      res.json(schedules);
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });
  
  app.post("/api/prospecting/searches/:id/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Validar data do agendamento
      const { scheduledAt } = req.body;
      
      if (!scheduledAt) {
        return res.status(400).json({ message: "Data de agendamento é obrigatória" });
      }
      
      const scheduledDate = new Date(scheduledAt);
      
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({ message: "Data de agendamento inválida ou no passado" });
      }
      
      // Criar agendamento
      const schedule = await storage.createProspectingSchedule({
        searchId,
        scheduledAt: scheduledDate,
        createdBy: userId,
        status: "pendente"
      });
      
      // Atualizar contador na pesquisa
      await storage.updateProspectingSearch(searchId, {
        dispatchesPending: (search.dispatchesPending || 0) + 1
      });
      
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      res.status(500).json({ message: "Erro ao criar agendamento" });
    }
  });
  
  app.get("/api/prospecting/searches/:id/history", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar pesquisa para verificar propriedade
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        return res.status(404).json({ message: "Pesquisa não encontrada" });
      }
      
      // Verificar se a pesquisa pertence ao usuário
      if (search.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Buscar histórico
      const history = await storage.getProspectingDispatchHistory(searchId);
      
      res.json(history);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });
  
  // Recomendações de leads
  app.get("/api/lead-recommendations", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      
      // Dados mockados para recomendações
      const mockRecommendations = [
        {
          id: 1,
          leadId: 102,
          leadName: "João da Silva",
          company: "Farmácia Saúde Total",
          score: 87,
          reason: "Alto engajamento nas últimas comunicações",
          lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pendente"
        },
        {
          id: 2,
          leadId: 145,
          leadName: "Maria Oliveira",
          company: "Supermercado Bom Preço",
          score: 92,
          reason: "Visitou páginas de produtos premium",
          lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pendente"
        },
        {
          id: 3,
          leadId: 78,
          leadName: "Carlos Santos",
          company: "Auto Peças Velozes",
          score: 75,
          reason: "Perfil similar a clientes convertidos recentemente",
          lastActivity: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          status: "vista"
        }
      ];
      
      res.json(mockRecommendations);
    } catch (error) {
      console.error("Erro ao buscar recomendações:", error);
      res.status(500).json({ message: "Erro ao buscar recomendações" });
    }
  });
  
  app.put("/api/lead-recommendations/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const recommendationId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !["pendente", "vista", "ignorada", "convertida"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      
      // Simulação de atualização bem-sucedida
      res.json({
        id: recommendationId,
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao atualizar status da recomendação:", error);
      res.status(500).json({ message: "Erro ao atualizar status da recomendação" });
    }
  });
  
  // Configure HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}