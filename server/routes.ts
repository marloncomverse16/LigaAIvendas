import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupFileUpload } from "./uploads";
import { importCSVContent } from "./csvImporter";
import { processProspectingFile } from "./imports";
import * as xlsx from "xlsx";
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
import * as whatsappApi from "./api/whatsapp-api";
import { getWhatsAppQrCode, getWhatsAppContacts } from "./direct-connection";
import { serveMediaProxy } from "./api/simple-media-proxy";
import { setupWebSocketServer, sendMessage } from "./websocket";
import { checkMetaConnectionStatus, connectMetaWhatsApp, disconnectMetaWhatsApp } from "./api/whatsapp-meta-connection";
import { WhatsAppCloudService } from "./api/whatsapp-cloud-service";
import multer from "multer";
import fs from "fs";
import { runContactDiagnostics } from "./api/contact-diagnostics";
import { getContactsV2 } from "./api/evolution-contacts-v2";

// Novas importações para o menu Conexões
import { 
  getWhatsAppQrCode as getQrCode,
  checkConnectionStatus as checkConnectionStatusNew
} from "./api/connections";

// Importação das rotas para a nova interface WhatsApp
import evolutionRoutes from "./api/evolution-routes";

// Importação do controlador para envio direto via Meta API
import { sendMetaMessageDirectly } from "./api/meta-direct-send";

// Importação do proxy direto para mídia do WhatsApp
import { directMediaProxy, whatsappAudioProxy } from "./api/direct-media-proxy";
import { whatsappMediaProxy } from "./api/whatsapp-media-proxy";
import { getUserServer } from "./api/meta-api-service";
import {
  connectWhatsAppMeta,
  disconnectWhatsAppMeta,
  sendMetaWhatsAppMessage
} from "./api/meta-connections";

// Importação do novo controlador para verificar status da Meta API
import { getUserServerConfig } from "./api/user-server-config";
import { checkMetaConnectionStatus } from "./api/meta-status";

// Importação do controlador para forçar verificação de conexão
import { forceConnectionCheck } from "./api/force-connection";

// Importação do controlador para configuração de webhook da Evolution API
import evolutionWebhookRoutes from "./api/evolution-webhook";
// Importação do receptor de webhook da Evolution API
import evolutionWebhookReceiver from "./api/evolution-webhook-receiver";

// Importação do testador de webhook de contatos
import { testContactsWebhook } from "./api/test-webhook";

// Novas importações para conexões Meta API específicas do usuário

// Configuração do multer para upload de arquivos
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Aceitar apenas CSV ou Excel
    if (file.mimetype.includes('csv') || 
        file.mimetype.includes('excel') || 
        file.mimetype.includes('spreadsheet') ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});
import {
  connectWhatsAppMeta as connectUserWhatsAppMeta,
  checkMetaConnectionStatus as checkUserMetaConnectionStatus,
  disconnectWhatsAppMeta as disconnectUserWhatsAppMeta,
  sendMetaWhatsAppMessage as sendUserMetaWhatsAppMessage,
  updateMetaSettings,
  getMetaSettings
} from "./api/user-meta-connections";
import { getUserMetaTemplates } from "./api/meta-templates";
import { getMetaTemplatesDirectly } from "./api/meta-direct-templates";
import { sendMetaMessageDirectly } from "./api/meta-direct-send";
import { diagnoseMeta } from "./api/meta-diagnostic";
import { fixMetaConfigFields } from "./api/meta-fix-fields";
import { createMessageSendingHistory, listMessageSendingHistory, updateMessageSendingHistory } from "./api/message-sending-history";
// Removido import problemático - usando queries diretas ao banco
import { checkMetaApiConnection } from "./meta-debug";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { settings } from "@shared/schema";
import { EvolutionApiClient } from "./evolution-api";
import { listContacts, syncContacts, exportContacts } from "./api/contacts";

// Importação das rotas de chat
import chatRoutes from "./api/chat";

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
  // INTERCEPTADOR GLOBAL PARA DEBUG - vai mostrar TODAS as requisições POST
  app.use((req, res, next) => {
    if (req.method === 'POST') {
      console.log(`🔍🔍🔍 REQUISIÇÃO POST INTERCEPTADA: ${req.url}`);
      if (req.url.includes('whatsapp') || req.url.includes('send') || req.url.includes('meta')) {
        console.log(`📋📋📋 Body WhatsApp/Meta:`, JSON.stringify(req.body, null, 2));
      }
    }
    next();
  });

  // Setup authentication
  setupAuth(app);
  
  // Setup file upload middleware
  setupFileUpload(app);
  
  // API endpoints
  
  // Registrar rotas de chat
  app.use("/api/chat", chatRoutes);
  
  // Registrar rotas da nova interface do WhatsApp
  app.use("/api/evolution", evolutionRoutes);
  
  // Registrar rotas de conexão
  app.get("/api/connections/status", checkConnectionStatusNew);
  app.get("/api/connections/qrcode", getQrCode);
  
  // Temporariamente desativado para evitar problemas de conexão
  // app.use("/api/evolution-webhook", evolutionWebhookRoutes);
  // app.use("/api/evolution-webhook-receiver", evolutionWebhookReceiver);
  
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
  
  // Rotas para configurações da Meta API específicas do usuário
  app.get("/api/user/meta-settings", getMetaSettings);
  app.put("/api/user/meta-settings", updateMetaSettings);
  
  // Rotas para conexão com a Meta API específicas do usuário
  app.post("/api/user/meta-connect", connectUserWhatsAppMeta);
  app.get("/api/user/meta-status", checkUserMetaConnectionStatus);
  app.post("/api/user/meta-disconnect", disconnectUserWhatsAppMeta);
  app.post("/api/user/meta-send-message", sendUserMetaWhatsAppMessage);
  
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
  
  // Rota para importar arquivo de leads
  app.post("/api/prospecting/import", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Verificar arquivo
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      // Verificar dados obrigatórios
      if (!req.body.segment) {
        return res.status(400).json({ message: "Segmento é obrigatório" });
      }
      
      // Processar arquivo
      const file = req.file;
      const segment = req.body.segment;
      const city = req.body.city || null;
      const webhookUrl = req.body.webhookUrl || (req.user as Express.User).prospectingWebhookUrl || null;
      
      console.log("Processando arquivo:", file.originalname, "para o segmento:", segment);
      
      // Validar tipo de arquivo
      if (!file.mimetype.includes('csv') && 
          !file.mimetype.includes('excel') && 
          !file.mimetype.includes('spreadsheet') && 
          !file.originalname.endsWith('.csv') && 
          !file.originalname.endsWith('.xls') && 
          !file.originalname.endsWith('.xlsx')) {
        return res.status(400).json({ message: "Formato de arquivo inválido. Use CSV ou Excel." });
      }
      
      // Criar busca no banco
      const searchData = {
        userId: (req.user as Express.User).id,
        segment,
        city,
        filters: `Importado via arquivo: ${file.originalname}`,
        webhookUrl,
        status: "processando" // Status inicial de processamento
      };
      
      const search = await storage.createProspectingSearch(searchData);
      
      // Processar arquivo usando o módulo dedicado
      try {
        const importResult = await processProspectingFile(file, search.id, storage);
        
        // Atualizar a busca com os resultados
        await storage.updateProspectingSearch(search.id, {
          leadsFound: importResult.importedLeads,
          dispatchesPending: importResult.importedLeads,
          status: importResult.importedLeads > 0 ? "concluido" : "erro"
        });
        
        return res.status(200).json({
          message: importResult.message,
          searchId: search.id,
          importedLeads: importResult.importedLeads,
          errors: importResult.errorLeads
        });
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        await storage.updateProspectingSearch(search.id, { status: "erro" });
        return res.status(500).json({ 
          message: "Erro ao processar arquivo", 
          error: String(error) 
        });
      }
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      return res.status(500).json({ 
        message: "Erro interno ao importar leads", 
        error: String(error) 
      });
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
      console.log("Buscando templates para o usuário");
      const userId = (req.user as Express.User).id;
      console.log("ID do usuário:", userId);
      
      const templates = await storage.getMessageTemplates(userId);
      console.log("Templates encontrados:", templates.length);
      
      res.json(templates);
    } catch (error) {
      console.error("Erro ao buscar modelos de mensagens:", error);
      console.error("Detalhes do erro:", JSON.stringify(error, null, 2));
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
      
      // Verificar o tipo de conexão WhatsApp escolhido (Meta API ou QR Code)
      const whatsappConnectionType = sending.whatsappConnectionType || "qrcode";
      
      // Se for conexão Meta API, enviar diretamente através da API da Meta
      if (whatsappConnectionType === "meta") {
        console.log("Enviando mensagem via Meta API");
        
        // Verificar se há uma conexão Meta API configurada para o usuário
        const metaUserServer = await getUserServer(userId);
        
        if (!metaUserServer || !metaUserServer.phoneNumberId) {
          throw new Error("Configuração da Meta API não encontrada. Configure nas Configurações > WhatsApp Cloud API (Meta)");
        }
        
        // Buscar resultados da pesquisa
        const searchId = sending.searchId || 0;
        const results = await storage.getProspectingResults(searchId);
        if (results.length === 0) {
          throw new Error("Não há resultados para enviar");
        }
        
        // Limitar à quantidade configurada
        const quantity = sending.quantity || 10;
        const resultsToSend = results.slice(0, quantity);
        
        // Com Meta API só podemos usar templates, verificar
        if (!sending.templateId) {
          throw new Error("Para envios via Meta API é necessário utilizar um template aprovado");
        }
        
        // Buscar o template para obter o nome
        const template = await storage.getMessageTemplate(sending.templateId || 0);
        if (!template) {
          throw new Error("Template não encontrado");
        }
        
        // Chamar a função que envia mensagens pela Meta API
        // Esta chamada retorna imediatamente e o processamento continua em segundo plano
        await sendMetaMessageDirectly({ 
          body: {
            searchId: sending.searchId,
            templateId: sending.templateId,
            templateName: template.title,
            quantity: sending.quantity
          },
          user: { id: userId }
        } as Request, {
          status: () => ({ json: () => {} }),
          json: () => {}
        } as unknown as Response);
        
        return { success: true, count: resultsToSend.length };
      } 
      // Se for conexão QR Code, enviar através do webhook configurado
      else {
        console.log("Enviando mensagem via QR Code (webhook)");
        
        // Buscar servidor do usuário para obter webhook de envio de mensagens
        const userServers = await storage.getUserServers(userId);
        if (!userServers || userServers.length === 0) {
          throw new Error("Nenhum servidor configurado para o usuário");
        }
        
        // Procurar um servidor com webhook de envio configurado
        const server = await storage.getServerById(userServers[0].serverId);
        if (!server || !server.messageSendingWebhookUrl) {
          throw new Error("Webhook de envio de mensagens não configurado no servidor");
        }
        
        // Buscar usuário para informações adicionais
        const user = await storage.getUser(userId);
        if (!user) {
          throw new Error("Usuário não encontrado");
        }
        
        // Buscar resultados da pesquisa
        const searchId = sending.searchId || 0;
        const results = await storage.getProspectingResults(searchId);
        if (results.length === 0) {
          throw new Error("Não há resultados para enviar");
        }
        
        // Limitar à quantidade configurada
        const quantity = sending.quantity || 10;
        const resultsToSend = results.slice(0, quantity);
        
        // Buscar o modelo de mensagem se especificado
        let messageContent = sending.customMessage || "";
        if (sending.templateId) {
          const template = await storage.getMessageTemplate(sending.templateId || 0);
          if (template) {
            messageContent = template.content;
          }
        }
        
        // Chamar webhook com os parâmetros necessários
        await axios.post(server.messageSendingWebhookUrl, {
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
          status: "enviado"
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
      }
    } catch (error: any) {
      console.error("Erro ao processar envio:", error);
      
      // Atualizar status do envio para erro
      if (sendingId) {
        await storage.updateMessageSending(sendingId, {
          status: "erro"
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
  // Endpoint direto para obter contatos do WhatsApp (alternativa robusta)
  app.get("/api/chat/direct-contacts", getWhatsAppContacts);
  
  // Rotas para o WhatsApp Web (nova interface)
  // Rotas para o WhatsApp Web simuladas para demonstração
  app.get("/api/whatsapp/status", (req, res) => {
    // Simula uma conexão bem-sucedida
    return res.status(200).json({
      success: true,
      connected: true,
      state: "open",
      data: {
        state: "open",
        connected: true
      }
    });
  });
  
  app.get("/api/whatsapp/contacts", (req, res) => {
    // Dados simulados de contatos
    const mockContacts = [
      {
        id: "5511999998888@c.us",
        name: "Contato Simulado 1",
        pushName: "Contato 1",
        phone: "5511999998888@c.us",
        lastMessage: "Olá, como vai?",
        lastMessageTime: "12:30",
        unreadCount: 2
      },
      {
        id: "5511999997777@c.us",
        name: "Contato Simulado 2",
        pushName: "Contato 2",
        phone: "5511999997777@c.us",
        lastMessage: "Vamos agendar uma reunião?",
        lastMessageTime: "10:45", 
        unreadCount: 0
      },
      {
        id: "5511999996666@c.us",
        name: "Contato Simulado 3",
        pushName: "Contato 3",
        phone: "5511999996666@c.us",
        lastMessage: "Enviando informações solicitadas.",
        lastMessageTime: "09:15",
        unreadCount: 1
      }
    ];
    
    return res.status(200).json(mockContacts);
  });
  
  app.get("/api/whatsapp/messages/:contactId", (req, res) => {
    const { contactId } = req.params;
    
    // Mensagens simuladas para cada contato
    const mockMessages = {
      "5511999998888@c.us": [
        {
          id: "msg-001",
          content: "Olá, tudo bem?",
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-002",
          content: "Sim, tudo ótimo! E com você?",
          timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
          fromMe: true,
          status: "read"
        },
        {
          id: "msg-003",
          content: "Estou bem também, obrigado!",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-004",
          content: "Olá, como vai?",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          fromMe: false,
          status: "delivered"
        }
      ],
      "5511999997777@c.us": [
        {
          id: "msg-011",
          content: "Bom dia!",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-012",
          content: "Bom dia! Como posso ajudar?",
          timestamp: new Date(Date.now() - 7000000).toISOString(),
          fromMe: true,
          status: "read"
        },
        {
          id: "msg-013",
          content: "Gostaria de agendar uma reunião",
          timestamp: new Date(Date.now() - 6800000).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-014",
          content: "Claro, que tal amanhã às 10h?",
          timestamp: new Date(Date.now() - 6600000).toISOString(),
          fromMe: true,
          status: "read"
        },
        {
          id: "msg-015",
          content: "Vamos agendar uma reunião?",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          fromMe: false,
          status: "delivered"
        }
      ],
      "5511999996666@c.us": [
        {
          id: "msg-021",
          content: "Preciso de algumas informações",
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-022",
          content: "Quais informações você precisa?",
          timestamp: new Date(Date.now() - 10700000).toISOString(),
          fromMe: true,
          status: "read"
        },
        {
          id: "msg-023",
          content: "Sobre os novos produtos",
          timestamp: new Date(Date.now() - 10600000).toISOString(),
          fromMe: false,
          status: "read"
        },
        {
          id: "msg-024",
          content: "Vou preparar e enviar para você",
          timestamp: new Date(Date.now() - 10500000).toISOString(),
          fromMe: true,
          status: "read"
        },
        {
          id: "msg-025",
          content: "Enviando informações solicitadas.",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          fromMe: false,
          status: "delivered"
        }
      ]
    };
    
    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "ID do contato não fornecido"
      });
    }
    
    if (mockMessages[contactId]) {
      return res.status(200).json(mockMessages[contactId]);
    } else {
      return res.status(200).json([]);
    }
  });
  
  app.post("/api/whatsapp/send", (req, res) => {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: "Destinatário e/ou mensagem não fornecidos"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Mensagem enviada com sucesso",
      data: {
        id: `msg-${Date.now()}`,
        status: "sent"
      }
    });
  });
  
  // Novo endpoint usando a implementação correta conforme documentação oficial
  app.get("/api/chat/contacts-v2", getContactsV2);
  
  // Endpoint de sincronização de contatos usando método POST conforme recomendação da Evolution API
  app.post("/api/chat/sync-contacts", async (req, res) => {
    try {
      // Importar o módulo de sincronização apenas quando necessário
      const { syncWhatsAppContacts } = await import('./api/evolution-contacts-sync');
      await syncWhatsAppContacts(req, res);
    } catch (error) {
      console.error('Erro ao processar solicitação de sincronização:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao sincronizar contatos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Endpoint para obter contatos sincronizados (para compatibilidade com o frontend)
  app.get("/api/contacts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Usar a nova implementação baseada na documentação oficial
      const { findContacts } = await import('./api/evolution-chat');
      await findContacts(req, res);
    } catch (error) {
      console.error('Erro ao obter contatos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter contatos do WhatsApp',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Novas rotas compatíveis com a documentação da Evolution API - Aba Chat
  
  // Rota para verificar se números estão no WhatsApp
  app.post("/api/chat/whatsapp-numbers", async (req, res) => {
    try {
      const { checkWhatsAppNumbers } = await import('./api/evolution-chat');
      await checkWhatsAppNumbers(req, res);
    } catch (error) {
      console.error('Erro ao verificar números no WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar números no WhatsApp',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para buscar mensagens
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const { findMessages } = await import('./api/evolution-chat');
      await findMessages(req, res);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar mensagens do WhatsApp',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para buscar chats
  app.post("/api/chat/chats", async (req, res) => {
    try {
      const { findChats } = await import('./api/evolution-chat');
      await findChats(req, res);
    } catch (error) {
      console.error('Erro ao buscar chats:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar chats do WhatsApp',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para marcar mensagem como lida
  app.post("/api/chat/mark-read", async (req, res) => {
    try {
      const { markMessageAsRead } = await import('./api/evolution-chat');
      await markMessageAsRead(req, res);
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao marcar mensagem como lida',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para obter foto de perfil
  app.post("/api/chat/profile-picture", async (req, res) => {
    try {
      const { fetchProfilePictureUrl } = await import('./api/evolution-chat');
      await fetchProfilePictureUrl(req, res);
    } catch (error) {
      console.error('Erro ao obter foto de perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter foto de perfil',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para servir como proxy para arquivos de mídia do WhatsApp (aceita GET e POST)
  app.all("/api/proxy-media", async (req, res) => {
    try {
      // Importar e usar a implementação ultra-simplificada
      const { proxyMedia } = await import('./api/direct-media-proxy');
      await proxyMedia(req, res);
    } catch (error) {
      console.error('Erro ao fazer proxy para mídia:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar arquivo de mídia',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Proxy especializado para mídia do WhatsApp com suporte a descriptografia
  app.get("/api/whatsapp-media", whatsappMediaProxy);

  // Rotas para WhatsApp Cloud API (Meta) - usando as mesmas que funcionam na aba Conexões
  app.get("/api/whatsapp-meta/status", async (req, res) => {
    try {
      const { checkMetaConnectionStatus } = await import('./api/user-meta-connections');
      return await checkMetaConnectionStatus(req, res);
    } catch (error) {
      console.error('Erro ao verificar status Meta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para buscar mensagens da Meta Cloud API - NOVA ROTA
  app.get("/api/meta-cloud-messages/:chatId", async (req, res) => {
    console.log('🔍 NOVA ROTA /api/meta-cloud-messages/:chatId CHAMADA');
    
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { whatsappCloudService } = await import('./api/whatsapp-cloud-service');
      const chatId = req.params.chatId;
      
      console.log(`🔍 Buscando mensagens para usuário ${req.user.id}, chat ${chatId}`);
      
      const result = await whatsappCloudService.getMessages(req.user.id, chatId);
      
      console.log('🔍 Resultado do serviço:', result);
      
      if (!result.success) {
        console.log('🔍 Resultado não foi sucesso, enviando erro:', result.error);
        return res.status(500).json({ error: result.error });
      }
      
      console.log('🔍 Enviando dados:', result.data);
      res.json(result.data);
    } catch (error) {
      console.error('🚨 Erro ao buscar mensagens da Meta Cloud API:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para enviar mensagens de texto via Meta Cloud API
  app.post("/api/whatsapp-meta/send-text", async (req, res) => {
    console.log("🚀🚀🚀 ROTA /api/whatsapp-meta/send-text CHAMADA! 🚀🚀🚀");
    console.log("📨📨📨 Dados recebidos:", JSON.stringify(req.body, null, 2));
    
    if (!req.isAuthenticated()) {
      console.log("❌ Usuário não autenticado");
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios' });
      }

      // Buscar configurações da Meta API do usuário
      const userId = req.user.id;
      
      // Buscar configurações diretamente do banco de dados usando as tabelas do schema
      const { settings: settingsTable, userServers: userServersTable } = await import('@shared/schema');
      
      const [userSettings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
      if (!userSettings || !userSettings.whatsappMetaToken || !userSettings.whatsappMetaBusinessId) {
        return res.status(400).json({ 
          error: 'Token ou Business ID da Meta API não configurados. Configure primeiro na aba "Configurações"' 
        });
      }
      
      // Buscar Phone Number ID diretamente do banco de dados com logs detalhados
      console.log(`🔍 BUSCA: Procurando userServer para userId: ${userId}`);
      const [userServer] = await db.select().from(userServersTable).where(eq(userServersTable.userId, userId)).limit(1);
      console.log(`📊 RESULTADO userServer:`, userServer);
      
      if (!userServer || !userServer.metaPhoneNumberId) {
        console.log(`❌ ERRO: Phone Number ID não encontrado. userServer existe: ${!!userServer}, metaPhoneNumberId: ${userServer?.metaPhoneNumberId}`);
        return res.status(400).json({ 
          error: 'Phone Number ID não configurado. Configure primeiro na aba "Conexões - WhatsApp Meta API"' 
        });
      }
      
      console.log(`✅ PHONE NUMBER ID ENCONTRADO: ${userServer.metaPhoneNumberId}`);

      const metaConfig = {
        token: userSettings.whatsappMetaToken,
        phoneNumberId: userServer.metaPhoneNumberId,
        apiVersion: userSettings.whatsappMetaApiVersion || 'v18.0'
      };

      console.log('🔧 CONFIGURAÇÃO META COMPLETA:');
      console.log(`📱 Phone Number ID: "${metaConfig.phoneNumberId}"`);
      console.log(`🔑 Token (primeiros 30 chars): "${metaConfig.token?.substring(0, 30)}..."`);
      console.log(`📋 API Version: "${metaConfig.apiVersion}"`);

      // Formatar número (remover caracteres especiais e garantir formato correto)
      let phoneNumber = to.replace(/\D/g, '');
      
      // Garantir código do país
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      console.log(`📞 Número formatado: "${phoneNumber}"`);
      console.log(`💬 Mensagem: "${message}"`);

      // Preparar dados para envio usando as configurações personalizadas do usuário
      const metaApiUrl = `https://graph.facebook.com/${metaConfig.apiVersion}/${metaConfig.phoneNumberId}/messages`;
      console.log(`🌐 URL Meta API: "${metaApiUrl}"`);
      
      const messageData = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: {
          body: message
        }
      };

      console.log(`Enviando mensagem de texto para ${phoneNumber}: ${message.substring(0, 30)}...`);
      console.log('URL da Meta API:', metaApiUrl);
      console.log('Dados da mensagem:', JSON.stringify(messageData, null, 2));
      console.log('Token usado (primeiros 10 caracteres):', metaConfig.token.substring(0, 10) + '...');

      // Enviar para Meta API usando o token das configurações personalizadas
      const response = await fetch(metaApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaConfig.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });
      
      console.log('Status da resposta da Meta API:', response.status);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro da Meta API - Status:', response.status);
        console.error('Erro da Meta API - Response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          return res.status(response.status).json({ 
            error: errorData.error?.message || 'Erro ao enviar mensagem via Meta API',
            details: errorData
          });
        } catch (parseError) {
          return res.status(response.status).json({ 
            error: 'Erro ao enviar mensagem via Meta API',
            details: errorText,
            parseError: 'Resposta não é JSON válido'
          });
        }
      }

      const result = await response.json();
      console.log('Mensagem enviada com sucesso via Meta API:', result);

      // ✅ SALVAR MENSAGEM ENVIADA NO BANCO PARA APARECER NO CHAT
      try {
        const userId = (req as any).user?.id;
        console.log(`🔧 INÍCIO DO SALVAMENTO - userId: ${userId}, phoneNumber: ${phoneNumber}`);
        
        const { WhatsAppCloudService } = await import('./api/whatsapp-cloud-service');
        const whatsappCloudService = new WhatsAppCloudService();
        
        // Primeiro, garantir que existe uma conversa para este número
        console.log(`📞 Garantindo conversa existe para: ${phoneNumber}`);
        const conversationResult = await whatsappCloudService.ensureConversationExists(userId, phoneNumber, "Usuário");
        console.log(`📞 Resultado da conversa:`, conversationResult);
        
        // Agora salvar a mensagem enviada com fromMe: true
        const chatId = `chat_${phoneNumber}_${userId}`;
        console.log(`💾 Salvando mensagem no chatId: ${chatId}`);
        
        const saveResult = await whatsappCloudService.saveMessage(userId, chatId, {
          content: message,
          remoteJid: phoneNumber,
          fromMe: true, // 🎯 CRUCIAL: Marca como mensagem enviada por mim
          messageType: 'text',
          metaMessageId: result.messages?.[0]?.id
        });
        
        console.log(`✅ MENSAGEM ENVIADA SALVA COM SUCESSO!`);
        console.log(`📊 Resultado do salvamento:`, saveResult);
        
        // Verificar se realmente foi salva
        const verification = await whatsappCloudService.getMessages(userId, phoneNumber);
        console.log(`🔍 VERIFICAÇÃO - Total de mensagens após salvamento: ${verification.data?.length || 0}`);
        
      } catch (dbError) {
        console.log('❌ ERRO CRÍTICO ao salvar mensagem enviada:', dbError);
        console.error('Stack trace completo:', dbError.stack);
        // Não falhar o envio por erro de banco
      }
      
      res.json({
        success: true,
        messageId: result.messages?.[0]?.id,
        result: result
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem via Meta Cloud API:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para buscar chats da Meta Cloud API
  app.get("/api/whatsapp-cloud/chats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { WhatsAppCloudService } = await import('./api/whatsapp-cloud-service');
      const cloudService = new WhatsAppCloudService();
      const result = await cloudService.getChats(req.user.id);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json(result.data);
    } catch (error) {
      console.error('Erro ao buscar chats da Meta Cloud API:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para buscar mensagens da Meta Cloud API
  app.get("/api/whatsapp-cloud/messages/:chatId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { WhatsAppCloudService } = await import('./api/whatsapp-cloud-service');
      const cloudService = new WhatsAppCloudService();
      const chatId = req.params.chatId;
      
      const result = await cloudService.getMessages(req.user.id, chatId);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json(result.data);
    } catch (error) {
      console.error('Erro ao buscar mensagens da Meta Cloud API:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  app.post("/api/whatsapp-meta/connect", async (req, res) => {
    try {
      const { connectWhatsAppMeta } = await import('./api/user-meta-connections');
      return await connectWhatsAppMeta(req, res);
    } catch (error) {
      console.error('Erro ao conectar Meta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  app.post("/api/whatsapp-meta/disconnect", async (req, res) => {
    try {
      const { disconnectWhatsAppMeta } = await import('./api/user-meta-connections');
      return await disconnectWhatsAppMeta(req, res);
    } catch (error) {
      console.error('Erro ao desconectar Meta:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Novas rotas otimizadas para mídia do WhatsApp
  app.get("/api/media-proxy", async (req, res) => {
    try {
      const { directMediaProxy } = await import('./api/enhanced-media-proxy');
      await directMediaProxy(req, res);
    } catch (error) {
      console.error('Erro no proxy de mídia melhorado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar mídia',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Proxy específico para áudios
  app.get("/api/audio-proxy", async (req, res) => {
    try {
      const { audioProxy } = await import('./api/enhanced-media-proxy');
      await audioProxy(req, res);
    } catch (error) {
      console.error('Erro no proxy de áudio:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar áudio',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para processar mídia com Cloudinary (solução definitiva para problemas de CORS)
  app.get("/api/process-media", async (req, res) => {
    try {
      // Importar e usar o serviço de mídia do Cloudinary
      const { processMediaProxy } = await import('./api/cloudinary-media-service');
      await processMediaProxy(req, res);
    } catch (error) {
      console.error('Erro ao processar mídia com Cloudinary:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar mídia com Cloudinary',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Rota para proxy direto de mídia (mais confiável, sem conversão)
  app.get("/api/media-proxy", directMediaProxy);
  
  // Rota especializada para áudios do WhatsApp
  app.get("/api/audio-proxy", whatsappAudioProxy);
  
  // Rotas para envio de mensagens via Evolution API
  
  // Enviar mensagem de texto
  app.post("/api/message/text", async (req, res) => {
    try {
      const { sendText } = await import('./api/evolution-message');
      await sendText(req, res);
    } catch (error) {
      console.error('Erro ao enviar mensagem de texto:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar mensagem de texto',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Enviar mídia (imagem, vídeo, áudio, documento)
  app.post("/api/message/media", async (req, res) => {
    try {
      const { sendMedia } = await import('./api/evolution-message');
      await sendMedia(req, res);
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar mídia',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Enviar áudio no formato WhatsApp
  app.post("/api/message/whatsapp-audio", async (req, res) => {
    try {
      const { sendWhatsAppAudio } = await import('./api/evolution-message');
      await sendWhatsAppAudio(req, res);
    } catch (error) {
      console.error('Erro ao enviar áudio WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar áudio WhatsApp',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Enviar botões interativos
  app.post("/api/message/buttons", async (req, res) => {
    try {
      const { sendButtons } = await import('./api/evolution-message');
      await sendButtons(req, res);
    } catch (error) {
      console.error('Erro ao enviar botões:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar botões',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Enviar lista de opções
  app.post("/api/message/list", async (req, res) => {
    try {
      const { sendList } = await import('./api/evolution-message');
      await sendList(req, res);
    } catch (error) {
      console.error('Erro ao enviar lista:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar lista',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Endpoints de webhook para integração com Evolution API
  // Webhook para sincronização de contatos - GET /webhook/find/{instance}
  app.get("/webhook/find/:instance", async (req, res) => {
    try {
      const { handleFindWebhook } = await import('./api/webhook-handler');
      await handleFindWebhook(req, res);
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao processar webhook',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Endpoint para sincronização de contatos via POST
  // POST /chat/findContacts/{instance}
  app.post("/chat/findContacts/:instance", async (req, res) => {
    try {
      // Verificar se temos o apikey no header
      const apiKey = req.headers['apikey'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: 'API key não fornecida no header'
        });
      }
      
      console.log(`[WEBHOOK] Recebida solicitação POST para sincronização de contatos: ${req.params.instance}`);
      
      // Usar o mesmo handler do webhook GET
      const { handleFindWebhook } = await import('./api/webhook-handler');
      await handleFindWebhook(req, res);
    } catch (error) {
      console.error('Erro ao processar webhook POST:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao processar webhook',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Diagnóstico detalhado de contatos do WhatsApp
  app.get("/api/diagnostics/contacts", async (req, res) => {
    try {
      // Importar o módulo de diagnóstico apenas quando necessário
      const { runContactDiagnostics } = await import('./api/diagnostics/contacts');
      await runContactDiagnostics(req, res);
    } catch (error) {
      console.error('Erro ao processar solicitação de diagnóstico:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno ao executar diagnóstico de contatos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
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
  
  // Configurações da Meta API a nível de usuário
  // Rota removida pois já existe acima
  
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
      console.log(`[API] Atualizando servidor ${id} com dados:`, JSON.stringify(req.body, null, 2));
      
      if (isNaN(id)) {
        console.error(`[API] ID do servidor inválido: ${req.params.id}`);
        return res.status(400).json({ message: "ID do servidor inválido" });
      }
      
      const serverData = req.body;
      
      // Verificar se algum campo crítico está faltando
      if (!serverData.name || !serverData.ipAddress || !serverData.provider || !serverData.apiUrl) {
        console.error(`[API] Dados incompletos:`, JSON.stringify(serverData, null, 2));
        return res.status(400).json({ 
          message: "Dados incompletos. Verifique se todos os campos obrigatórios estão preenchidos." 
        });
      }
      
      try {
        const updatedServer = await storage.updateServer(id, serverData);
        
        if (!updatedServer) {
          console.log(`[API] Servidor ${id} não encontrado`);
          return res.status(404).json({ message: "Servidor não encontrado" });
        }
        
        console.log(`[API] Servidor ${id} atualizado com sucesso:`, JSON.stringify(updatedServer, null, 2));
        res.json(updatedServer);
      } catch (dbError) {
        console.error(`[API] Erro de banco de dados ao atualizar servidor ${id}:`, dbError);
        return res.status(500).json({ 
          message: "Erro ao atualizar servidor no banco de dados",
          error: dbError.message || String(dbError)
        });
      }
    } catch (error) {
      console.error(`[API] Erro ao processar atualização do servidor ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Erro ao atualizar servidor",
        error: error.message || String(error)
      });
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
  
  // Rota para obter o servidor padrão do usuário atual
  app.get("/api/user-servers/default", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      console.log(`Buscando servidor padrão para o usuário ${req.user.id}`);
      
      // Primeiro buscar as relações usuário-servidor
      const relations = await storage.getUserServerRelationsByUserId(req.user.id);
      console.log(`Encontradas ${relations?.length || 0} relações para o usuário ${req.user.id}`);
      
      if (!relations || relations.length === 0) {
        return res.status(404).json({ message: "Nenhum servidor associado ao usuário" });
      }
      
      // Procurar o servidor padrão
      const defaultRelation = relations.find(r => r.isDefault === true);
      
      if (defaultRelation) {
        console.log(`Encontrado servidor padrão: ${defaultRelation.serverId}`);
        return res.json(defaultRelation);
      }
      
      // Se não tiver padrão, pegar o primeiro da lista
      console.log(`Nenhum servidor padrão encontrado, usando o primeiro: ${relations[0].serverId}`);
      return res.json(relations[0]);
    } catch (error) {
      console.error("Erro ao buscar servidor padrão do usuário:", error);
      res.status(500).json({ message: "Erro ao buscar servidor padrão" });
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
  // Rota temporariamente desativada
  app.get("/api/connections/status", checkConnectionStatusNew);
  // app.post("/api/connections/disconnect", disconnectWhatsApp); // Desabilitado temporariamente
  
  // Rotas para conexão direta com a Meta API (nível de servidor)
  app.post("/api/meta-connections/connect", connectWhatsAppMeta);
  app.get("/api/meta-connections/status", checkMetaConnectionStatus);
  app.post("/api/meta-connections/disconnect", disconnectWhatsAppMeta);
  app.post("/api/meta-connections/send", sendMetaWhatsAppMessage);
  
  // Rotas para conexão Meta API específicas do usuário
  app.post("/api/user/meta-connections/connect", connectUserWhatsAppMeta);
  app.get("/api/user/meta-connections/status", checkUserMetaConnectionStatus);
  app.post("/api/user/meta-connections/disconnect", disconnectUserWhatsAppMeta);
  app.post("/api/user/meta-connections/send", sendUserMetaWhatsAppMessage);
  app.get("/api/user/meta-settings", getMetaSettings);
  app.post("/api/user/meta-settings", updateMetaSettings);
  
  // Rota de diagnóstico da Meta API (sem autenticação para facilitar testes)
  app.get("/api/meta-debug", checkMetaApiConnection);
  
  // Rota robusta direta para obter templates da Meta API
  app.get("/api/meta-templates", getMetaTemplatesDirectly);
  
  // Endpoint de diagnóstico para verificar se as configurações da Meta API estão sendo carregadas corretamente
  app.get("/api/diagnose/meta-settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      const userId = req.user.id;
      console.log(`DIAGNÓSTICO: Obtendo configurações Meta para usuário ${userId}`);
      
      // Buscar via serviço de usuário-settings
      // Buscar configurações diretamente do banco (corrigido para não usar o serviço inexistente)
      const userSettingsQuery = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
      const userSettingsResult = { 
        success: userSettingsQuery.length > 0, 
        data: userSettingsQuery[0] || null 
      };
      
      // Buscar também via ORM para comparação
      const [ormSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId));
      
      // Verificar se as configurações existem em ambos
      const serviceSettingsExist = !!userSettingsResult.data;
      const ormSettingsExist = !!ormSettings;
      
      // Preparar resposta de diagnóstico
      const diagnosticData = {
        userId,
        serviceSettings: {
          exists: serviceSettingsExist,
          token: serviceSettingsExist ? (userSettingsResult.data.whatsappMetaToken ? "Presente" : "Ausente") : "N/A",
          businessId: serviceSettingsExist ? (userSettingsResult.data.whatsappMetaBusinessId ? "Presente" : "Ausente") : "N/A",
          apiVersion: serviceSettingsExist ? userSettingsResult.data.whatsappMetaApiVersion : "N/A",
        },
        ormSettings: {
          exists: ormSettingsExist,
          token: ormSettingsExist ? (ormSettings.whatsappMetaToken ? "Presente" : "Ausente") : "N/A", 
          businessId: ormSettingsExist ? (ormSettings.whatsappMetaBusinessId ? "Presente" : "Ausente") : "N/A",
          apiVersion: ormSettingsExist ? ormSettings.whatsappMetaApiVersion : "N/A",
          database_columns: ormSettingsExist ? Object.keys(ormSettings) : []
        }
      };
      
      return res.status(200).json(diagnosticData);
    } catch (error) {
      console.error("Erro ao diagnosticar configurações Meta:", error);
      return res.status(500).json({ 
        message: "Erro ao diagnosticar configurações", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para obter configurações do servidor do usuário para o Evolution API
  app.get("/api/user/server-config", async (req, res) => {
    try {
      await getUserServerConfig(req, res);
    } catch (error) {
      console.error('Erro ao obter configurações do servidor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter configurações do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Rota para obter templates da Meta API
  app.get("/api/user/meta-templates", async (req, res) => {
    console.log("Rota /api/user/meta-templates chamada - VERSÃO CORRIGIDA");
    
    // Verificar autenticação logo de início
    if (!req.isAuthenticated()) {
      console.log("GET /api/user/meta-templates: Usuário não autenticado");
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      console.log(`GET /api/user/meta-templates: Chamando implementação para usuário ${req.user.id}`);
      await getUserMetaTemplates(req, res);
    } catch (error) {
      console.error("Erro ao processar requisição getUserMetaTemplates:", error);
      res.status(500).json({ 
        message: "Erro interno ao obter templates", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Rota direta para obter templates da Meta API sem autenticação
  // Útil para diagnóstico e testes
  app.get("/api/meta-direct-templates", async (req, res) => {
    console.log("Rota /api/meta-direct-templates chamada - ACESSO DIRETO");
    try {
      await getMetaTemplatesDirectly(req, res);
    } catch (error) {
      console.error("Erro ao processar requisição getMetaTemplatesDirectly:", error);
      res.status(500).json({
        message: "Erro interno ao obter templates diretamente",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para envio direto via Meta API
  app.post("/api/meta-direct-send", async (req, res) => {
    console.log("Rota /api/meta-direct-send chamada - ENVIO DIRETO");
    try {
      await sendMetaMessageDirectly(req, res);
    } catch (error) {
      console.error("Erro ao enviar mensagens diretamente:", error);
      res.status(500).json({ 
        message: "Erro ao enviar mensagens diretamente",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rotas para histórico de envio de mensagens
  app.post("/api/message-sending-history", createMessageSendingHistory);
  app.get("/api/message-sending-history", listMessageSendingHistory);
  app.patch("/api/message-sending-history/:id", updateMessageSendingHistory);
  
  // Rota de diagnóstico avançado para Meta API
  app.get("/api/meta-diagnostic", async (req, res) => {
    console.log("Iniciando diagnóstico avançado da Meta API");
    try {
      await diagnoseMeta(req, res);
    } catch (error) {
      console.error("Erro ao executar diagnóstico Meta:", error);
      res.status(500).json({
        message: "Erro interno no diagnóstico Meta",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para correção automática dos campos Meta API
  app.post("/api/meta-fix-fields", async (req, res) => {
    console.log("Iniciando correção automática dos campos Meta API");
    try {
      await fixMetaConfigFields(req, res);
    } catch (error) {
      console.error("Erro ao corrigir campos Meta:", error);
      res.status(500).json({
        message: "Erro interno na correção de campos",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota direta para enviar mensagens via Meta API sem autenticação
  // Útil para diagnóstico e testes
  app.post("/api/meta-direct-send", async (req, res) => {
    console.log("Rota /api/meta-direct-send chamada - ACESSO DIRETO");
    try {
      await sendMetaMessageDirectly(req, res);
    } catch (error) {
      console.error("Erro ao processar requisição sendMetaMessageDirectly:", error);
      res.status(500).json({
        message: "Erro interno ao enviar mensagem diretamente",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para diagnóstico de templates da Meta API
  app.get("/api/diagnose/meta-templates", async (req, res) => {
    console.log("Diagnóstico de templates da Meta API iniciado");
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    try {
      const userId = req.user.id;
      const diagnosticoData = { userId, steps: [] };
      
      // Passo 1: Verificar se usuário tem configurações
      diagnosticoData.steps.push({ step: 1, name: "Verificar configurações do usuário" });
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId));
      
      if (!userSettings) {
        diagnosticoData.steps.push({ 
          step: 1,
          status: "error",
          message: "Configurações do usuário não encontradas" 
        });
        return res.json(diagnosticoData);
      }
      
      diagnosticoData.steps.push({ 
        step: 1,
        status: "success",
        message: "Configurações encontradas",
        hasMetaToken: !!userSettings.whatsappMetaToken,
        hasMetaBusinessId: !!userSettings.whatsappMetaBusinessId,
        apiVersion: userSettings.whatsappMetaApiVersion || "v18.0"
      });
      
      // Passo 2: Verificar se credenciais Meta estão presentes e corretamente formatadas
      diagnosticoData.steps.push({ step: 2, name: "Verificar credenciais da Meta API" });
      
      if (!userSettings.whatsappMetaToken || !userSettings.whatsappMetaBusinessId) {
        diagnosticoData.steps.push({ 
          step: 2,
          status: "error",
          message: "Credenciais da Meta API não configuradas" 
        });
        return res.json(diagnosticoData);
      }
      
      // Verificar formato e possíveis valores invertidos
      let possiblySwapped = false;
      let tokenLooksOk = userSettings.whatsappMetaToken.length > 20;
      let businessIdLooksOk = !isNaN(Number(userSettings.whatsappMetaBusinessId));
      let tokenLength = userSettings.whatsappMetaToken.length || 0;
      let businessIdLength = userSettings.whatsappMetaBusinessId.length || 0;
      
      // Verificar se parecem estar invertidos
      if (businessIdLength > 60 && tokenLength < 30) {
        possiblySwapped = true;
      }
      
      diagnosticoData.steps.push({ 
        step: 2,
        status: possiblySwapped ? "warning" : "success",
        message: possiblySwapped 
          ? "Credenciais encontradas, mas podem estar invertidas" 
          : "Credenciais da Meta API encontradas",
        details: {
          tokenLooksValid: tokenLooksOk,
          businessIdLooksValid: businessIdLooksOk,
          possiblySwapped,
          businessIdLength,
          tokenLength: tokenLength > 10 ? "OK" : "MUITO CURTO"
        }
      });
      
      // Passo 3: Testar conexão básica com a API da Meta
      diagnosticoData.steps.push({ step: 3, name: "Testar conexão com API da Meta" });
      
      try {
        // Se os valores parecem estar invertidos, use as versões corrigidas
        const token = possiblySwapped ? userSettings.whatsappMetaBusinessId : userSettings.whatsappMetaToken;
        const businessId = possiblySwapped ? userSettings.whatsappMetaToken : userSettings.whatsappMetaBusinessId;
        const apiVersion = userSettings.whatsappMetaApiVersion || 'v18.0';
        
        const testEndpoint = `https://graph.facebook.com/${apiVersion}/${businessId}`;
        
        diagnosticoData.steps.push({ 
          step: 3,
          status: "info",
          message: possiblySwapped 
            ? "Tentando conexão com endpoint usando valores corrigidos" 
            : "Tentando conexão com endpoint",
          endpoint: testEndpoint,
          usingCorrectedValues: possiblySwapped
        });
        
        const response = await fetch(testEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          diagnosticoData.steps.push({ 
            step: 3,
            status: "error",
            message: "Falha na conexão básica com a API",
            statusCode: response.status,
            error: errorData.error?.message || "Erro desconhecido"
          });
          return res.json(diagnosticoData);
        }
        
        const businessData = await response.json();
        diagnosticoData.steps.push({ 
          step: 3,
          status: "success",
          message: "Conexão básica com API bem-sucedida",
          businessInfo: {
            id: businessData.id,
            name: businessData.name || "Nome não disponível"
          }
        });
      } catch (connectionError) {
        diagnosticoData.steps.push({ 
          step: 3,
          status: "error",
          message: "Erro ao testar conexão com API",
          error: connectionError instanceof Error ? connectionError.message : "Erro desconhecido"
        });
        return res.json(diagnosticoData);
      }
      
      // Passo 4: Buscar templates
      diagnosticoData.steps.push({ step: 4, name: "Buscar templates" });
      
      try {
        // Se os valores parecem estar invertidos, use as versões corrigidas
        const token = possiblySwapped ? userSettings.whatsappMetaBusinessId : userSettings.whatsappMetaToken;
        const businessId = possiblySwapped ? userSettings.whatsappMetaToken : userSettings.whatsappMetaBusinessId;
        const apiVersion = userSettings.whatsappMetaApiVersion || 'v18.0';
        
        const templatesEndpoint = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;
        
        diagnosticoData.steps.push({ 
          step: 4,
          status: "info",
          message: possiblySwapped 
            ? "Tentando buscar templates com valores corrigidos" 
            : "Tentando buscar templates",
          endpoint: templatesEndpoint,
          usingCorrectedValues: possiblySwapped
        });
        
        const response = await fetch(templatesEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          diagnosticoData.steps.push({ 
            step: 4,
            status: "error",
            message: "Falha ao buscar templates",
            statusCode: response.status,
            error: errorData.error?.message || "Erro desconhecido"
          });
          return res.json(diagnosticoData);
        }
        
        const templatesData = await response.json();
        
        // Verificar se há templates
        if (!templatesData.data || templatesData.data.length === 0) {
          diagnosticoData.steps.push({ 
            step: 4,
            status: "warning",
            message: "Nenhum template encontrado",
            rawResponse: templatesData
          });
          return res.json(diagnosticoData);
        }
        
        // Filtrar templates aprovados
        const approvedTemplates = templatesData.data.filter(
          (template: any) => template && template.status === "APPROVED"
        );
        
        diagnosticoData.steps.push({ 
          step: 4,
          status: "success",
          message: "Templates obtidos com sucesso",
          totalTemplates: templatesData.data.length,
          approvedTemplates: approvedTemplates.length,
          templates: approvedTemplates.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            category: t.category,
            language: t.language
          }))
        });
      } catch (templatesError) {
        diagnosticoData.steps.push({ 
          step: 4,
          status: "error",
          message: "Erro ao buscar templates",
          error: templatesError instanceof Error ? templatesError.message : "Erro desconhecido"
        });
        return res.json(diagnosticoData);
      }
      
      // Diagnóstico concluído com sucesso
      return res.json(diagnosticoData);
    } catch (error) {
      console.error("Erro no diagnóstico de templates:", error);
      return res.status(500).json({
        message: "Erro no diagnóstico",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoints para gerenciamento de contatos
  app.get("/api/contacts", listContacts);
  app.post("/api/contacts/sync", syncContacts);
  app.get("/api/contacts/export", exportContacts);
  
  // Rota para diagnóstico de problemas com API Evolution
  app.get("/api/diagnostics/contacts", runContactDiagnostics);
  
  // Rota para testar webhook de contatos
  app.get("/api/servers/:serverId/test-webhook", testContactsWebhook);

  // ===== WEBHOOK DA META API PARA RECEBER MENSAGENS =====
  // Verificação do webhook (chamado pela Meta para validar)
  app.get('/api/webhooks/meta', async (req, res) => {
    try {
      const { verifyWebhook } = await import('./api/meta-webhook');
      await verifyWebhook(req, res);
    } catch (error) {
      console.error('Erro no webhook Meta (GET):', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Recebimento de mensagens do webhook da Meta API
  app.post('/api/webhooks/meta', async (req, res) => {
    try {
      const { receiveWebhook } = await import('./api/meta-webhook');
      await receiveWebhook(req, res);
    } catch (error) {
      console.error('Erro no webhook Meta (POST):', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Rotas para WhatsApp Cloud API (Meta) - buscar conversas reais
  app.get('/api/whatsapp-cloud/chats', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    try {
      const userId = req.user!.id;
      const { whatsappCloudService } = await import('./api/whatsapp-cloud-service');
      const result = await whatsappCloudService.getChats(userId);
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error('Erro ao buscar chats da Meta API:', error);
      res.status(500).json({ error: 'Erro ao buscar chats da Meta API' });
    }
  });

  app.get('/api/whatsapp-cloud/messages/:chatId', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    try {
      const userId = req.user!.id;
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const { whatsappCloudService } = await import('./api/whatsapp-cloud-service');
      const result = await whatsappCloudService.getMessages(userId, chatId, limit);
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens da Meta API:', error);
      res.status(500).json({ error: 'Erro ao buscar mensagens da Meta API' });
    }
  });
  
  // Configure HTTP server
  const httpServer = createServer(app);
  
  // Configurar WebSocket Server no arquivo websocket.ts
  // Esta função será chamada externamente após a criação do servidor HTTP
  
  return httpServer;
}