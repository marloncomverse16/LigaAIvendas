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
  insertUserSchema, ConnectionStatus, insertServerSchema,
  userAiAgents, serverAiAgents
} from "@shared/schema";
import { z } from "zod";
import axios from "axios";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { checkConnectionStatus, disconnectWhatsApp } from "./connection";
import { getWhatsAppQrCode } from "./direct-connection";
import { setupWebSocketServer, sendMessage } from "./websocket";

// Novas importações para o menu Conexões
import { 
  getWhatsAppQrCode as getQrCode, 
  connectWhatsAppCloud, 
  checkConnectionStatus as checkConnectionStatusNew,
  disconnectWhatsApp as disconnectWhatsAppNew
} from "./api/connections";
import {
  connectWhatsAppMeta,
  checkMetaConnectionStatus,
  disconnectWhatsAppMeta,
  sendMetaWhatsAppMessage
} from "./api/meta-connections";

// Novas importações para conexões Meta API específicas do usuário
import {
  connectWhatsAppMeta as connectUserWhatsAppMeta,
  checkMetaConnectionStatus as checkUserMetaConnectionStatus,
  disconnectWhatsAppMeta as disconnectUserWhatsAppMeta,
  sendMetaWhatsAppMessage as sendUserMetaWhatsAppMessage,
  updateMetaSettings,
  getMetaSettings
} from "./api/user-meta-connections";
import { EvolutionApiClient } from "./evolution-api";
import { listContacts, syncContacts, exportContacts } from "./api/contacts";

// Importações para os agentes IA de servidores
import {
  getServerAiAgents,
  getServerAiAgent,
  createServerAiAgent,
  updateServerAiAgent,
  deleteServerAiAgent
} from "./api/server-ai-agents";

// Importações para os agentes IA de usuários
import {
  getUserAiAgents,
  getAvailableServerAiAgents,
  assignAiAgentToUser,
  removeAiAgentFromUser,
  setDefaultAiAgent
} from "./api/user-ai-agents";

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
// (definido no /server/connection.ts)

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
  app.get("/api/connection/status", checkConnectionStatus);
  
  // Rota para conectar o WhatsApp (usando o método otimizado)
  app.post("/api/connection/connect", getWhatsAppQrCode);
  
  // Rota para desconectar o WhatsApp
  app.post("/api/connection/disconnect", disconnectWhatsApp);
  
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
      const serverId = userData.serverId; // Capturar serverId se existir
      
      // Remover serverId pois vamos tratar separadamente
      if ('serverId' in userData) {
        delete userData.serverId;
      }
      
      console.log(`Atualizando usuário ${userId} com dados:`, userData);
      
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
      
      // Se foi enviado um serverId, atualizá-lo separadamente
      if (serverId !== undefined) {
        console.log(`Atualizando serverId do usuário ${userId} para: ${serverId}`);
        await storage.updateUserServerId(userId, serverId);
        
        // Recarregar usuário para obter dados atualizados
        const refreshedUser = await storage.getUser(userId);
        if (refreshedUser) {
          updatedUser.serverId = refreshedUser.serverId;
        }
      }
      
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
  
  // Admin - Ativar/Desativar usuário
  app.patch("/api/admin/users/:id/toggle-active", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Verificar se usuário existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Impedir desativação do próprio usuário admin
      if (userId === (req.user as Express.User).id) {
        return res.status(400).json({ message: "Não é possível desativar seu próprio usuário" });
      }
      
      // Alternar o status de ativo/inativo
      const newActiveStatus = !existingUser.active;
      const updatedUser = await storage.updateUser(userId, { active: newActiveStatus });
      
      // Remover senha da resposta
      const { password, ...userResponse } = updatedUser || existingUser;
      
      // Adicionar mensagem adequada na resposta
      const statusMessage = newActiveStatus ? "ativado" : "desativado";
      res.json({ 
        ...userResponse, 
        active: newActiveStatus,
        message: `Usuário ${statusMessage} com sucesso` 
      });
    } catch (error) {
      console.error("Erro ao alterar status do usuário:", error);
      res.status(500).json({ message: "Erro ao alterar status do usuário" });
    }
  });
  
  // Configurações de usuário
  app.get("/api/settings", async (req, res) => {
    try {
      let settings;
      
      if (req.isAuthenticated()) {
        settings = await storage.getSettingsByUserId((req.user as Express.User).id);
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
      let settings = await storage.getSettingsByUserId(userId);
      
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
      
      // Buscar pesquisas do usuário (corrigido o nome da função)
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
      
      // Criar nova pesquisa
      const search = await storage.createProspectingSearch({
        ...searchData,
        userId,
        status: "pendente"
      });
      
      // Se houver webhook, fazer a chamada
      if (searchData.webhookUrl) {
        console.log("Chamando webhook:", searchData.webhookUrl);
        
        try {
          // Modificado para usar GET em vez de POST, conforme exigido pelo webhook configurado no n8n
          const webhookResponse = await axios.get(searchData.webhookUrl, {
            params: {
              segment: searchData.segment,
              city: searchData.city,
              filters: searchData.filters
            }
          });
          
          console.log("Resposta do webhook:", JSON.stringify(webhookResponse.data));
          
          // Verificar formato dos dados e calcular o número de leads encontrados
          let leadsCount = 0;
          if (Array.isArray(webhookResponse.data)) {
            leadsCount = webhookResponse.data.length;
          } else if (webhookResponse.data && Array.isArray(webhookResponse.data.data)) {
            leadsCount = webhookResponse.data.data.length;
          }
          
          // Marcar pesquisa como concluída
          const newSearch = await storage.updateProspectingSearch(search.id, {
            status: "concluido",
            completedAt: new Date(),
            leadsFound: leadsCount,
            dispatchesPending: leadsCount
          });
          
          // Processar dados retornados
          if (Array.isArray(webhookResponse.data)) {
            // Se for um array de resultados
            // Para cada item no array, criar um resultado
            await Promise.all(webhookResponse.data.map(async (item) => {
              try {
                // Adaptar campos com base no formato dos dados
                const nome = item.nome || item.name || item.title || item.razaoSocial || null;
                const telefone = item.telefone || item.phone || item.celular || null;
                const email = item.email || null;
                const endereco = item.endereco || item.address || null;
                const tipo = item.tipo || item.type || item.categoryName || null;
                const cidade = item.cidade || item.city || searchData.city || null;
                const estado = item.estado || item.state || item.uf || null;
                const site = item.site || item.website || item.url || null;
                
                console.log("Processando item:", {
                  nome, telefone, email, endereco, tipo, site, cidade, estado
                });
                
                // Criar resultado no banco - importante usar os nomes corretos das colunas
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
                
                // Criar resultado no banco - importante usar os nomes corretos das colunas
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
      }
      
      console.log("Busca criada sem webhook:", search);
      res.status(201).json(search);
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
  
  // Esta é a rota que o frontend usa
  app.get("/api/prospecting/results/:id", async (req, res) => {
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
      console.log(`Resultados encontrados para pesquisa ${searchId}:`, results);
      
      // Verificar se o webhook retornou dados
      if (!results || results.length === 0) {
        console.log("Buscando dados diretamente da API do webhook para exibição");
        
        try {
          // Chamar o webhook diretamente para obter os dados
          const response = await axios.get(search.webhookUrl);
          console.log("Resposta do webhook:", response.data);
          
          // Verificar se há dados retornados
          if (response.data && Array.isArray(response.data.data)) {
            // Processar dados do webhook e criar resultados temporários para exibição
            const processedResults = response.data.data.map((item: any, index: number) => {
              const nome = item.nome || item.name || item.title || item.razaoSocial || null;
              const telefone = item.telefone || item.phone || item.celular || null;
              const email = item.email || null;
              const endereco = item.endereco || item.address || null;
              const tipo = item.tipo || item.type || item.categoryName || null;
              const site = item.site || item.website || item.url || null;
              
              return {
                id: index + 1000, // ID temporário
                searchId,
                name: nome,
                phone: telefone,
                email: email,
                address: endereco,
                type: tipo,
                site: site,
                createdAt: new Date(),
                updatedAt: new Date()
              };
            });
            
            console.log("Resultados processados para exibição:", processedResults);
            
            // Importante: definir o tipo de conteúdo como JSON
            res.setHeader('Content-Type', 'application/json');
            return res.json(processedResults);
          }
        } catch (webhookError) {
          console.error("Erro ao buscar dados do webhook:", webhookError);
        }
      }
      
      // Importante: definir o tipo de conteúdo como JSON
      res.setHeader('Content-Type', 'application/json');
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
        // Chamar webhook com os resultados - modificado para usar GET em vez de POST
        await axios.get(user.dispatchesWebhookUrl, {
          params: {
            searchId,
            segment: search.segment,
            city: search.city,
            filters: search.filters,
            resultsCount: results.length
          }
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
  
  // Rota para excluir uma busca de prospecção
  app.delete("/api/prospecting/searches/:id", async (req, res) => {
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
      
      // Excluir a pesquisa
      const success = await storage.deleteProspectingSearch(searchId);
      
      if (success) {
        res.status(200).json({ message: "Pesquisa excluída com sucesso" });
      } else {
        res.status(500).json({ message: "Falha ao excluir pesquisa" });
      }
    } catch (error) {
      console.error("Erro ao excluir pesquisa:", error);
      res.status(500).json({ message: "Erro ao excluir pesquisa" });
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
  
  // ============ Rotas para Envio de Mensagens ============
  
  // Rotas para modelos de mensagens
  app.get("/api/message-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const templates = await storage.getMessageTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Erro ao buscar modelos de mensagens:", error);
      res.status(500).json({ message: "Erro ao buscar modelos de mensagens" });
    }
  });
  
  app.post("/api/message-templates", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const templateData = {
        ...req.body,
        userId
      };
      
      const newTemplate = await storage.createMessageTemplate(templateData);
      res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Erro ao criar modelo de mensagem:", error);
      res.status(500).json({ message: "Erro ao criar modelo de mensagem" });
    }
  });
  
  app.put("/api/message-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const templateId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar modelo para verificar propriedade
      const template = await storage.getMessageTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Modelo de mensagem não encontrado" });
      }
      
      // Verificar se o modelo pertence ao usuário
      if (template.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updatedTemplate = await storage.updateMessageTemplate(templateId, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Erro ao atualizar modelo de mensagem:", error);
      res.status(500).json({ message: "Erro ao atualizar modelo de mensagem" });
    }
  });
  
  app.delete("/api/message-templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const templateId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar modelo para verificar propriedade
      const template = await storage.getMessageTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Modelo de mensagem não encontrado" });
      }
      
      // Verificar se o modelo pertence ao usuário
      if (template.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      await storage.deleteMessageTemplate(templateId);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir modelo de mensagem:", error);
      res.status(500).json({ message: "Erro ao excluir modelo de mensagem" });
    }
  });
  
  // Rotas para envio de mensagens
  app.get("/api/message-sendings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const sendings = await storage.getMessageSendings(userId);
      res.json(sendings);
    } catch (error) {
      console.error("Erro ao buscar envios de mensagens:", error);
      res.status(500).json({ message: "Erro ao buscar envios de mensagens" });
    }
  });
  
  app.post("/api/message-sendings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const sendingData = {
        ...req.body,
        userId
      };
      
      const newSending = await storage.createMessageSending(sendingData);
      
      // Se não tiver agendamento, executar imediatamente
      if (!sendingData.scheduledAt) {
        await processMessageSending(newSending.id, userId);
      }
      
      res.status(201).json(newSending);
    } catch (error) {
      console.error("Erro ao criar envio de mensagens:", error);
      res.status(500).json({ message: "Erro ao criar envio de mensagens" });
    }
  });
  
  // Função para processar envio de mensagens
  async function processMessageSending(sendingId: number, userId: number) {
    try {
      // Buscar dados do envio
      const sending = await storage.getMessageSending(sendingId);
      if (!sending) {
        throw new Error("Envio não encontrado");
      }
      
      // Buscar usuário para obter webhook
      const user = await storage.getUser(userId);
      if (!user || !user.dispatchesWebhookUrl) {
        throw new Error("Usuário ou webhook não configurado");
      }
      
      // Buscar resultados da pesquisa
      const results = await storage.getProspectingResults(sending.searchId);
      if (results.length === 0) {
        throw new Error("Não há resultados para enviar");
      }
      
      // Limitar à quantidade configurada
      const resultsToSend = results.slice(0, sending.quantity);
      
      // Buscar o modelo de mensagem se especificado
      let messageContent = sending.customMessage || "";
      if (sending.templateId) {
        const template = await storage.getMessageTemplate(sending.templateId);
        if (template) {
          messageContent = template.content;
        }
      }
      
      // Chamar webhook com os parâmetros necessários
      await axios.post(user.dispatchesWebhookUrl, {
        sendingId: sending.id,
        searchId: sending.searchId,
        message: messageContent,
        results: resultsToSend,
        aiLearningEnabled: sending.aiLearningEnabled,
        userId,
        username: user.username,
        email: user.email,
        name: user.name,
        company: user.company,
        phone: user.phone
      });
      
      // Atualizar status do envio
      await storage.updateMessageSending(sendingId, {
        status: "enviado",
        executedAt: new Date()
      });
      
      // Registrar histórico de envio para cada resultado
      for (const result of resultsToSend) {
        await storage.createMessageSendingHistory({
          sendingId,
          resultId: result.id,
          status: "sucesso"
        });
      }
      
      return { success: true, count: resultsToSend.length };
    } catch (error) {
      console.error("Erro ao processar envio:", error);
      
      // Atualizar status do envio para erro
      if (sendingId) {
        await storage.updateMessageSending(sendingId, {
          status: "erro",
          executedAt: new Date()
        });
      }
      
      return { 
        success: false, 
        error: error.message || "Erro desconhecido" 
      };
    }
  }
  
  app.post("/api/message-sendings/:id/send-now", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const sendingId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar envio para verificar propriedade
      const sending = await storage.getMessageSending(sendingId);
      
      if (!sending) {
        return res.status(404).json({ message: "Envio não encontrado" });
      }
      
      // Verificar se o envio pertence ao usuário
      if (sending.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const result = await processMessageSending(sendingId, userId);
      
      if (result.success) {
        res.json({
          message: "Envio processado com sucesso",
          count: result.count
        });
      } else {
        res.status(500).json({
          message: "Erro ao processar envio",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Erro ao processar envio:", error);
      res.status(500).json({ message: "Erro ao processar envio" });
    }
  });
  
  app.get("/api/message-sendings/:id/history", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const sendingId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      // Buscar envio para verificar propriedade
      const sending = await storage.getMessageSending(sendingId);
      
      if (!sending) {
        return res.status(404).json({ message: "Envio não encontrado" });
      }
      
      // Verificar se o envio pertence ao usuário
      if (sending.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const history = await storage.getMessageSendingHistory(sendingId);
      res.json(history);
    } catch (error) {
      console.error("Erro ao buscar histórico de envio:", error);
      res.status(500).json({ message: "Erro ao buscar histórico de envio" });
    }
  });
  
  // WhatsApp API Routes
  app.get("/api/whatsapp/contacts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const contacts = await storage.getWhatsappContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Erro ao buscar contatos do WhatsApp:", error);
      res.status(500).json({ message: "Erro ao buscar contatos do WhatsApp" });
    }
  });
  
  app.get("/api/whatsapp/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const contactId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      const contact = await storage.getWhatsappContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      
      // Verificar se o contato pertence ao usuário
      if (contact.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Erro ao buscar contato do WhatsApp:", error);
      res.status(500).json({ message: "Erro ao buscar contato do WhatsApp" });
    }
  });
  
  app.get("/api/whatsapp/contacts/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const contactId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const contact = await storage.getWhatsappContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      
      // Verificar se o contato pertence ao usuário
      if (contact.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const messages = await storage.getWhatsappMessages(userId, contactId, limit);
      res.json(messages);
    } catch (error) {
      console.error("Erro ao buscar mensagens do WhatsApp:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens do WhatsApp" });
    }
  });
  
  app.post("/api/whatsapp/send", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const { contactId, message } = req.body;
      
      if (!contactId || !message) {
        return res.status(400).json({ message: "Contato e mensagem são obrigatórios" });
      }
      
      const contact = await storage.getWhatsappContact(parseInt(contactId));
      
      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }
      
      // Verificar se o contato pertence ao usuário
      if (contact.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      // Importar a função para enviar mensagem WebSocket
      const { sendMessage } = require('./websocket');
      await sendMessage(userId, contact.id, message);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao enviar mensagem WhatsApp:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem WhatsApp" });
    }
  });
  
  app.put("/api/whatsapp/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const { whatsappApiUrl, whatsappApiToken, whatsappInstanceId } = req.body;
      
      // Atualizar configurações do usuário
      const user = await storage.updateUser(userId, {
        whatsappApiUrl,
        whatsappApiToken,
        whatsappInstanceId
      });
      
      res.json({ success: true, user });
    } catch (error) {
      console.error("Erro ao atualizar configurações do WhatsApp:", error);
      res.status(500).json({ message: "Erro ao atualizar configurações do WhatsApp" });
    }
  });
  
  // Rotas de Servidores
  app.get("/api/servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Verificar se o usuário é admin
      if (!req.user.isAdmin) {
        // Se não for admin, retornar apenas os servidores associados a este usuário
        const servers = await storage.getUserServers(req.user.id);
        return res.json(servers);
      }
      
      // Se for admin, retornar todos os servidores
      const servers = await storage.getAllServers();
      res.json(servers);
    } catch (error) {
      console.error("Erro ao buscar servidores:", error);
      res.status(500).json({ message: "Erro ao buscar servidores" });
    }
  });
  
  app.get("/api/servers/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const servers = await storage.getActiveServers();
      res.json(servers);
    } catch (error) {
      console.error("Erro ao buscar servidores ativos:", error);
      res.status(500).json({ message: "Erro ao buscar servidores ativos" });
    }
  });
  
  app.get("/api/servers/provider/:provider", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const provider = req.params.provider;
      const servers = await storage.getServersByProvider(provider);
      res.json(servers);
    } catch (error) {
      console.error(`Erro ao buscar servidores do provedor ${req.params.provider}:`, error);
      res.status(500).json({ message: `Erro ao buscar servidores do provedor ${req.params.provider}` });
    }
  });
  
  // Contagem de usuários por servidor
  app.get("/api/servers/users-count", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const counts = await storage.countUsersByServer();
      res.json(counts);
    } catch (error) {
      console.error("Erro ao buscar contagem de usuários:", error);
      res.status(500).json({ message: "Erro ao buscar contagem de usuários por servidor" });
    }
  });

  app.get("/api/servers/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const id = parseInt(req.params.id);
      const server = await storage.getServerById(id);
      
      if (!server) {
        return res.status(404).json({ message: "Servidor não encontrado" });
      }
      
      // Verificar se o usuário é admin ou se o servidor está associado ao usuário
      if (!req.user.isAdmin) {
        const userServers = await storage.getUserServers(req.user.id);
        const isUserServer = userServers.some(s => s.id === id);
        
        if (!isUserServer) {
          return res.status(403).json({ message: "Acesso negado a este servidor" });
        }
      }
      
      res.json(server);
    } catch (error) {
      console.error(`Erro ao buscar servidor ${req.params.id}:`, error);
      res.status(500).json({ message: `Erro ao buscar servidor` });
    }
  });
  
  app.post("/api/servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem criar servidores" });
    }
    
    try {
      const serverData = insertServerSchema.parse(req.body);
      const newServer = await storage.createServer(serverData);
      res.status(201).json(newServer);
    } catch (error) {
      console.error("Erro ao criar servidor:", error);
      res.status(500).json({ message: "Erro ao criar servidor" });
    }
  });
  
  app.put("/api/servers/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem atualizar servidores" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const serverData = req.body;
      
      const updatedServer = await storage.updateServer(id, serverData);
      
      if (!updatedServer) {
        return res.status(404).json({ message: "Servidor não encontrado" });
      }
      
      res.json(updatedServer);
    } catch (error) {
      console.error(`Erro ao atualizar servidor ${req.params.id}:`, error);
      res.status(500).json({ message: "Erro ao atualizar servidor" });
    }
  });
  
  app.delete("/api/servers/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem excluir servidores" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteServer(id);
      
      if (!success) {
        return res.status(404).json({ message: "Servidor não encontrado" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error(`Erro ao excluir servidor ${req.params.id}:`, error);
      res.status(500).json({ message: "Erro ao excluir servidor" });
    }
  });
  
  // Rotas para gerenciar agentes IA de servidores
  app.get("/api/servers/:serverId/ai-agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // A função getServerAiAgents trata os parâmetros e retorna os agentes
    return getServerAiAgents(req, res);
  });
  
  app.post("/api/servers/:serverId/ai-agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // A função createServerAiAgent trata os parâmetros e cria o agente
    return createServerAiAgent(req, res);
  });
  
  app.get("/api/server-ai-agents/:agentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // A função getServerAiAgent trata os parâmetros e retorna o agente específico
    return getServerAiAgent(req, res);
  });
  
  app.put("/api/server-ai-agents/:agentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // A função updateServerAiAgent trata os parâmetros e atualiza o agente
    return updateServerAiAgent(req, res);
  });
  
  app.delete("/api/server-ai-agents/:agentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // A função deleteServerAiAgent trata os parâmetros e remove o agente
    return deleteServerAiAgent(req, res);
  });
  
  // Rotas para gerenciar associações de agentes IA com usuários
  app.get("/api/users/:userId/ai-agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar permissão: apenas o próprio usuário ou admin pode ver
    if (parseInt(req.params.userId) !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    return getUserAiAgents(req, res);
  });
  
  app.get("/api/servers/:serverId/available-ai-agents/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar permissão: apenas o próprio usuário ou admin pode ver
    if (parseInt(req.params.userId) !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    return getAvailableServerAiAgents(req, res);
  });
  
  app.post("/api/user-ai-agents", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar permissão: apenas o próprio usuário ou admin pode criar
    if (req.body.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    return assignAiAgentToUser(req, res);
  });
  
  app.delete("/api/user-ai-agents/:userAgentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Para verificar permissão, primeiro precisamos obter os dados da associação
    try {
      const userAgentId = parseInt(req.params.userAgentId);
      const [userAgent] = await db
        .select()
        .from(userAiAgents)
        .where(eq(userAiAgents.id, userAgentId));
      
      if (!userAgent) {
        return res.status(404).json({ message: "Associação não encontrada" });
      }
      
      // Verificar permissão: apenas o próprio usuário ou admin pode remover
      if (userAgent.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      return removeAiAgentFromUser(req, res);
    } catch (error) {
      console.error("Erro ao verificar permissão:", error);
      return res.status(500).json({ message: "Erro ao processar a solicitação" });
    }
  });
  
  app.post("/api/user-ai-agents/:userAgentId/set-default", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Para verificar permissão, primeiro precisamos obter os dados da associação
    try {
      const userAgentId = parseInt(req.params.userAgentId);
      const [userAgent] = await db
        .select()
        .from(userAiAgents)
        .where(eq(userAiAgents.id, userAgentId));
      
      if (!userAgent) {
        return res.status(404).json({ message: "Associação não encontrada" });
      }
      
      // Verificar permissão: apenas o próprio usuário ou admin pode definir o padrão
      if (userAgent.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      return setDefaultAiAgent(req, res);
    } catch (error) {
      console.error("Erro ao verificar permissão:", error);
      return res.status(500).json({ message: "Erro ao processar a solicitação" });
    }
  });
  
  // Rotas de associação de usuário com servidor
  app.get("/api/user-servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userServers = await storage.getUserServers(req.user.id);
      res.json(userServers);
    } catch (error) {
      console.error("Erro ao buscar servidores do usuário:", error);
      res.status(500).json({ message: "Erro ao buscar servidores do usuário" });
    }
  });
  
  // Rota para buscar usuários associados a um servidor
  app.get("/api/user-servers/:serverId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem visualizar todos os usuários de um servidor" });
    }
    
    try {
      const serverId = parseInt(req.params.serverId);
      console.log(`Buscando usuários para o servidor ${serverId} (admin: ${req.user.isAdmin})`);
      
      // Buscar usuários do servidor com informações completas
      const serverUsers = await storage.getServerUsers(serverId);
      console.log(`Encontrados ${serverUsers.length} usuários associados ao servidor ${serverId}`);
      
      res.json(serverUsers);
    } catch (error) {
      console.error(`Erro ao buscar usuários do servidor ${req.params.serverId}:`, error);
      res.status(500).json({ message: "Erro ao buscar usuários do servidor" });
    }
  });
  
  app.post("/api/user-servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Apenas administradores podem associar servidores a usuários" });
    }
    
    try {
      const { userId, serverId } = req.body;
      
      console.log("Recebido na API /api/user-servers:", { userId, serverId, body: req.body });
      
      if (!userId || !serverId) {
        return res.status(400).json({ message: "userId e serverId são obrigatórios" });
      }
      
      // Adicionar à tabela de associação user_servers
      const userServer = await storage.addUserServer(userId, serverId);
      
      if (!userServer) {
        console.error("Não foi possível adicionar o servidor ao usuário");
        return res.status(400).json({ message: "Não foi possível adicionar o servidor ao usuário" });
      }
      
      console.log("Servidor adicionado à associação user_servers:", userServer);
      
      // Atualizar o campo serverId do usuário
      const updatedUser = await storage.updateUserServerId(userId, serverId);
      
      if (!updatedUser) {
        console.error("Servidor associado à tabela user_servers, mas não foi possível atualizar o serverId do usuário");
      } else {
        console.log("Campo serverId do usuário atualizado:", updatedUser.serverId);
      }
      
      res.status(201).json({
        userServer,
        userUpdated: !!updatedUser,
        user: updatedUser
      });
    } catch (error) {
      console.error("Erro ao adicionar servidor ao usuário:", error);
      res.status(500).json({ message: "Erro ao adicionar servidor ao usuário" });
    }
  });
  
  app.delete("/api/user-servers/:serverId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    const serverId = parseInt(req.params.serverId);
    
    try {
      // Usuários não-admin só podem remover seus próprios servidores
      let userId = req.user.id;
      
      // Se for um admin e especificou userId no query, pode remover de qualquer usuário
      if (req.user.isAdmin && req.query.userId) {
        userId = parseInt(req.query.userId as string);
      }
      
      // Remover da tabela de associação user_servers
      const success = await storage.removeUserServer(userId, serverId);
      
      if (!success) {
        return res.status(404).json({ message: "Associação não encontrada" });
      }
      
      // Verificar se o usuário tem o serverId configurado como servidor atual
      const user = await storage.getUser(userId);
      
      if (user && user.serverId === serverId) {
        // Se estiver removendo o servidor atual do usuário, limpar o serverId
        await storage.updateUser(userId, { serverId: null });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error(`Erro ao remover servidor ${req.params.serverId} do usuário:`, error);
      res.status(500).json({ message: "Erro ao remover servidor do usuário" });
    }
  });
  
  // Rota para definir o servidor padrão do usuário
  app.post("/api/user/select-server", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { serverId } = req.body;
      
      if (!serverId) {
        return res.status(400).json({ message: "serverId é obrigatório" });
      }
      
      // Verificar se o usuário tem acesso ao servidor
      const userServers = await storage.getUserServers(req.user.id);
      const hasAccess = userServers.some(server => server.id === serverId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Usuário não tem acesso a este servidor" });
      }
      
      // Atualizar o serverId do usuário
      const updatedUser = await storage.updateUserServerId(req.user.id, serverId);
      
      if (!updatedUser) {
        return res.status(400).json({ message: "Não foi possível atualizar o servidor do usuário" });
      }
      
      res.status(200).json({ message: "Servidor selecionado com sucesso", user: updatedUser });
    } catch (error) {
      console.error("Erro ao selecionar servidor:", error);
      res.status(500).json({ message: "Erro ao selecionar servidor" });
    }
  });
  
  // Rota para atribuir automaticamente um servidor a um usuário (usa o servidor com MAIOR ocupação)
  app.post("/api/admin/auto-assign-server", isAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId é obrigatório" });
      }
      
      // Verificar se o usuário existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Encontrar o servidor com a MAIOR ocupação que ainda tenha vagas disponíveis
      // Nota: apesar do nome "Least", a função retorna o servidor com MAIOR taxa de utilização
      const bestServer = await storage.getServerWithLeastUsers(true);
      
      if (!bestServer) {
        return res.status(404).json({ message: "Nenhum servidor ativo disponível" });
      }
      
      console.log(`Auto-associando usuário ${userId} ao servidor ${bestServer.name} (ID: ${bestServer.id})`);
      
      // Verificar se o usuário já está associado a este servidor
      const userServers = await storage.getUserServers(userId);
      const alreadyAssociated = userServers.some(server => server.id === bestServer.id);
      
      if (!alreadyAssociated) {
        // Associar usuário ao servidor
        await storage.addUserServer(userId, bestServer.id);
        console.log(`Adicionada associação entre usuário ${userId} e servidor ${bestServer.id}`);
      } else {
        console.log(`Usuário ${userId} já estava associado ao servidor ${bestServer.id}`);
      }
      
      // Definir como servidor atual do usuário
      await storage.updateUserServerId(userId, bestServer.id);
      console.log(`Servidor ${bestServer.id} definido como atual para o usuário ${userId}`);
      
      res.json({
        message: "Servidor atribuído automaticamente com sucesso",
        server: {
          id: bestServer.id,
          name: bestServer.name,
          provider: bestServer.provider,
          ipAddress: bestServer.ipAddress
        }
      });
    } catch (error) {
      console.error("Erro ao atribuir servidor automaticamente:", error);
      res.status(500).json({ message: "Erro ao atribuir servidor automaticamente" });
    }
  });
  
  // API para remover uma relação específica de usuário-servidor pelo ID da relação
  // Novo endpoint para obter as relações de servidor de um usuário específico
  app.get("/api/user-servers/user/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    const userId = parseInt(req.params.userId);
    const isAdmin = req.user.isAdmin;
    
    // Verificar permissão: deve ser o próprio usuário ou um admin
    if (userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    try {
      console.log(`Buscando relações de servidor para o usuário ${userId} (admin: ${isAdmin})`);
      const relations = await storage.getUserServerRelationsByUserId(userId);
      console.log(`Encontradas ${relations.length} relações para o usuário ${userId}`);
      return res.json(relations);
    } catch (error) {
      console.error("Erro ao buscar relações de servidor:", error);
      return res.status(500).json({ message: "Erro ao buscar relações de servidor" });
    }
  });
  
  app.delete("/api/user-servers/relation/:relationId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    const relationId = parseInt(req.params.relationId);
    const isAdmin = req.user.isAdmin;
    
    try {
      console.log(`Tentando remover relação com ID ${relationId} (admin: ${isAdmin})`);
      
      // Verificar se a relação existe
      const relation = await storage.getUserServerRelationById(relationId);
      
      if (!relation) {
        console.log(`Relação ${relationId} não encontrada`);
        return res.status(404).json({ message: "Relação não encontrada" });
      }
      
      // Apenas admins ou o próprio usuário podem remover a relação
      if (!isAdmin && relation.userId !== req.user.id) {
        return res.status(403).json({ message: "Você não tem permissão para remover esta relação" });
      }
      
      // Remover a relação
      const success = await storage.removeUserServerRelation(relationId);
      
      if (success) {
        console.log(`Relação ${relationId} removida com sucesso`);
        res.sendStatus(200);
      } else {
        console.log(`Falha ao remover relação ${relationId}`);
        res.status(500).json({ message: "Erro ao remover relação" });
      }
    } catch (error) {
      console.error("Erro ao remover relação de usuário-servidor:", error);
      res.status(500).json({ message: "Erro ao remover relação de usuário-servidor" });
    }
  });
  
  // Novas rotas para o menu Conexões
  app.post("/api/connections/qrcode", getQrCode);
  app.post("/api/connections/cloud", connectWhatsAppCloud);
  app.get("/api/connections/status", checkConnectionStatusNew);
  app.post("/api/connections/disconnect", disconnectWhatsAppNew);
  
  // Rotas para conexão direta com a Meta API
  app.post("/api/meta-connections/connect", connectWhatsAppMeta);
  app.get("/api/meta-connections/status", checkMetaConnectionStatus);
  app.post("/api/meta-connections/disconnect", disconnectWhatsAppMeta);
  app.post("/api/meta-connections/send", sendMetaWhatsAppMessage);
  
  // Endpoints para gerenciamento de contatos
  app.get("/api/contacts", listContacts);
  app.post("/api/contacts/sync", syncContacts);
  app.get("/api/contacts/export", exportContacts);
  
  // Configure HTTP server
  const httpServer = createServer(app);
  
  // Configurar WebSocket Server no arquivo websocket.ts
  // Esta função será chamada externamente após a criação do servidor HTTP
  
  return httpServer;
}