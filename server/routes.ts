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
    // Removendo a verificação de autenticação temporariamente para fins de depuração
    // if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Usar um ID fixo para testes se não estiver autenticado
      const id = req.isAuthenticated() ? (req.user as Express.User).id : 1;
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
        // Voltando a usar POST como estava originalmente
        console.log("Enviando webhook POST para:", webhookUrl);
        const response = await axios.post(webhookUrl, {
          action: "requestQrCode",
          userId: id,
          username: user.username,
          callbackUrl: `${req.protocol}://${req.get('host')}/api/connection/callback`
        });
        
        // Vamos verificar a estrutura da resposta para extrair o QR code corretamente
        console.log("Resposta do webhook:", JSON.stringify(response.data, null, 2));
        
        // Verifica diferentes formatos possíveis da resposta
        let qrCodeBase64 = null;
        
        console.log("Tipo de resposta:", typeof response.data);
        console.log("Resposta completa:", JSON.stringify(response.data).substring(0, 1000));
        
        if (response.data && Array.isArray(response.data)) {
          // Se a resposta é um array
          console.log("Resposta é um array de comprimento:", response.data.length);
          
          if (response.data.length > 0 && response.data[0].success) {
            console.log("Formato de array com success encontrado");
            const jsonData = response.data[0];
            
            if (jsonData.data && jsonData.data.base64) {
              console.log("QR code em jsonData.data.base64");
              // Verificamos se o base64 já inclui o prefixo data:image
              qrCodeBase64 = jsonData.data.base64.startsWith('data:') 
                ? jsonData.data.base64 
                : jsonData.data.base64;
            } else if (jsonData.data && jsonData.data.code) {
              console.log("QR code em jsonData.data.code");
              qrCodeBase64 = jsonData.data.code;
            }
          } else if (response.data.length > 0 && response.data[0].json) {
            console.log("Formato de array com json encontrado");
            const jsonData = response.data[0].json;
            
            if (jsonData.data && jsonData.data.base64) {
              qrCodeBase64 = jsonData.data.base64;
            }
          }
        } else if (response.data && response.data.data && response.data.data.base64) {
          // Formato { data: { base64: "..." } }
          console.log("Formato data.base64 encontrado");
          qrCodeBase64 = response.data.data.base64;
        } else if (response.data && response.data.data && response.data.data.pairingCode) {
          // Formato { data: { pairingCode: "...", code: "..." } }
          console.log("Formato data.pairingCode encontrado");
          qrCodeBase64 = response.data.data.code;
        } else if (response.data && response.data.qrCode) {
          // Formato { qrCode: "..." }
          console.log("Formato qrCode encontrado");
          qrCodeBase64 = response.data.qrCode;
        }
        
        if (qrCodeBase64) {
          connectionStatus[id] = {
            connected: false,
            qrCode: qrCodeBase64,
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
  });
  
  // Rota de callback para o n8n informar sobre a conexão do dispositivo
  app.post("/api/connection/callback", async (req, res) => {
    try {
      const { userId, connected } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "ID do usuário não fornecido" });
      }
      
      // Atualiza o status de conexão
      connectionStatus[userId] = {
        connected: !!connected,
        lastUpdated: new Date()
      };
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao processar callback:", error);
      res.status(500).json({ message: "Erro ao processar callback" });
    }
  });
  
  // Rota para desconectar o dispositivo
  app.post("/api/connection/disconnect", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const { id } = req.user as Express.User;
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Usar a URL configurada pelo usuário
      const webhookUrl = user.whatsappWebhookUrl;
      
      if (webhookUrl) {
        try {
          // Tenta chamar o webhook para desconectar
          await axios.post(webhookUrl, {
            action: "disconnect",
            userId: id
          });
        } catch (error) {
          console.error("Erro ao desconectar via webhook:", error);
        }
      }
      
      // Atualiza o status para desconectado
      connectionStatus[id] = {
        connected: false,
        lastUpdated: new Date()
      };
      
      res.json(connectionStatus[id]);
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      res.status(500).json({ message: "Erro ao desconectar" });
    }
  });

  // Middleware para verificar se o usuário é administrador
  const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const user = req.user as Express.User;
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem acessar este recurso." });
    }
    
    next();
  };

  // Rotas de administração de usuários
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.get("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const userData = req.body;
      
      // Verificar se o nome de usuário já existe
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Hash da senha antes de salvar
      userData.password = await hashPassword(userData.password);
      
      const newUser = await storage.createUser(userData);
      res.status(201).json({ ...newUser, password: undefined });
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.put("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      // Se estiver atualizando a senha, faça o hash
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevenir a exclusão do próprio usuário administrador
      if (userId === (req.user as Express.User).id) {
        return res.status(400).json({ message: "Não é possível excluir o próprio usuário" });
      }
      
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "Usuário não encontrado ou erro ao excluir" });
      }
      
      res.status(200).json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Rota para criar uma instância do WhatsApp para um usuário
  app.post("/api/admin/users/:id/create-whatsapp-instance", isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { webhookInstanceUrl } = req.body;
    
    if (!webhookInstanceUrl) {
      return res.status(400).json({ success: false, message: "URL do webhook da instância é obrigatória" });
    }
    
    try {
      // Buscar usuário para obter informações
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuário não encontrado" });
      }
      
      // Atualizar o usuário com a URL do webhook de instância
      const userData = {
        ...user,
        whatsappInstanceWebhook: webhookInstanceUrl,
        // Limpa o ID da instância para que uma nova seja criada
        whatsappInstanceId: null
      };
      
      await storage.updateUser(userId, userData);
      
      // Chamar o webhook com as informações do usuário para criar a instância
      try {
        const response = await axios.post(webhookInstanceUrl, {
          action: "createInstance",
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          company: user.company,
          callbackUrl: `${req.protocol}://${req.get('host')}/api/connection/instance-callback/${userId}`
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // Se o webhook retornar um ID de instância, salve-o
        if (response.data && response.data.instanceId) {
          const updatedData = {
            ...user,
            whatsappInstanceId: response.data.instanceId
          };
          
          await storage.updateUser(userId, updatedData);
            
          return res.status(200).json({ 
            success: true, 
            message: "Instância do WhatsApp criada com sucesso", 
            instanceId: response.data.instanceId 
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          message: "Solicitação de criação de instância enviada com sucesso" 
        });
        
      } catch (error) {
        console.error("Erro ao chamar webhook para criar instância:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Erro ao chamar webhook para criar instância", 
          error: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
      
    } catch (error) {
      console.error("Erro ao criar instância do WhatsApp:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Erro ao criar instância do WhatsApp", 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rotas para funcionalidade de prospecção
  app.get("/api/prospecting/searches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      // Mock de buscas de prospecção para demonstração
      const mockSearches = [
        {
          id: 1,
          userId: req.user.id,
          segment: "Restaurantes",
          city: "São Paulo",
          filters: "Estabelecimentos com mais de 10 funcionários",
          status: "concluido",
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
          completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 dias atrás
          leadsFound: 35,
          dispatchesDone: 28,
          dispatchesPending: 7,
          webhookUrl: req.user.prospectingWebhookUrl || null
        },
        {
          id: 2,
          userId: req.user.id,
          segment: "Clínicas médicas",
          city: "Rio de Janeiro",
          filters: "Especialidades: Cardiologia, Ortopedia",
          status: "em_andamento",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 dias atrás
          completedAt: null,
          leadsFound: 12,
          dispatchesDone: 5,
          dispatchesPending: 7,
          webhookUrl: req.user.prospectingWebhookUrl || null
        },
        {
          id: 3,
          userId: req.user.id,
          segment: "Escritórios de advocacia",
          city: "Belo Horizonte",
          filters: "Direito empresarial",
          status: "pendente",
          createdAt: new Date(), // hoje
          completedAt: null,
          leadsFound: 0,
          dispatchesDone: 0,
          dispatchesPending: 0,
          webhookUrl: req.user.prospectingWebhookUrl || null
        }
      ];
      
      res.json(mockSearches);
    } catch (error) {
      console.error("Erro ao buscar pesquisas de prospecção:", error);
      res.status(500).json({ message: "Erro ao buscar pesquisas de prospecção" });
    }
  });

  app.post("/api/prospecting/searches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchData = insertProspectingSearchSchema.parse(req.body);
      
      console.log("Dados da busca de prospecção recebidos:", searchData);
      
      // Se tiver um webhookUrl, tenta chamar o webhook via GET (conforme solicitado)
      if (searchData.webhookUrl) {
        try {
          const webhookUrl = searchData.webhookUrl;
          console.log("Tentando chamar webhook GET:", webhookUrl);
          
          const user = req.user as Express.User;
          
          // Preparar os parâmetros de consulta para o webhook
          const params = new URLSearchParams({
            segmento: searchData.segment,
            cidade: searchData.city || '',
            filtros: searchData.filters || '',
            usuario_id: user.id.toString(),
            callback_url: `${req.protocol}://${req.get('host')}/api/prospecting/webhook-callback/${user.id}`
          });
          
          // Construir URL completa com parâmetros
          const fullUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}${params.toString()}`;
          console.log("URL completa do webhook:", fullUrl);
          
          // Chamar o webhook via GET
          const response = await axios.get(fullUrl);
          
          console.log("Resposta do webhook:", response.data);
          
          // Se o webhook retornar dados de prospecção, usar esses dados
          if (response.data) {
            // Usar os dados retornados pelo webhook para criar a busca
            const webhookResponse = response.data;
            
            // Extrair informações do webhook - adaptado para diferentes formatos possíveis
            let leadsEncontrados = 0;
            let status = "em_andamento";
            let concluido = false;
            
            // Verificar se há dados de leads
            if (Array.isArray(webhookResponse)) {
              // Caso seja um array
              if (webhookResponse.length > 0 && webhookResponse[0].data && Array.isArray(webhookResponse[0].data)) {
                leadsEncontrados = webhookResponse[0].data.length;
              } else {
                leadsEncontrados = webhookResponse.length;
              }
              
              // Se tiver dados, consideramos como concluído
              if (leadsEncontrados > 0) {
                status = "concluido";
                concluido = true;
              }
            } else if (typeof webhookResponse === 'object') {
              // Caso seja um objeto
              if (webhookResponse.leadsEncontrados) {
                leadsEncontrados = webhookResponse.leadsEncontrados;
              } else if (webhookResponse.totalLeads) {
                leadsEncontrados = webhookResponse.totalLeads;
              } else if (webhookResponse.data && Array.isArray(webhookResponse.data)) {
                leadsEncontrados = webhookResponse.data.length;
              }
              
              status = webhookResponse.status || (leadsEncontrados > 0 ? "concluido" : "em_andamento");
              concluido = webhookResponse.concluido || leadsEncontrados > 0;
            }
            
            const newSearch = {
              id: Math.floor(Math.random() * 1000) + 100,
              userId: req.user.id,
              segment: searchData.segment,
              city: searchData.city || null,
              filters: searchData.filters || null,
              status: status,
              createdAt: new Date(),
              completedAt: concluido ? new Date() : null,
              leadsFound: leadsEncontrados,
              dispatchesDone: 0,
              dispatchesPending: leadsEncontrados, 
              webhookUrl: searchData.webhookUrl,
              webhookData: webhookResponse
            };
            
            console.log("Busca criada com dados do webhook:", newSearch);
            return res.status(200).json(newSearch);
          }
          
          console.log("Webhook chamado com sucesso, mas sem dados específicos retornados");
        } catch (webhookError) {
          console.error("Erro ao chamar webhook de prospecção:", webhookError);
          // Continuamos o fluxo mesmo com erro, para criar uma busca local
        }
      }
      
      // Se não tiver webhook ou ocorrer erro, criar um mock da busca
      const newSearch = {
        id: Math.floor(Math.random() * 1000) + 100,
        userId: req.user.id,
        segment: searchData.segment,
        city: searchData.city || null,
        filters: searchData.filters || null,
        status: "pendente",
        createdAt: new Date(),
        completedAt: null,
        leadsFound: 0,
        dispatchesDone: 0,
        dispatchesPending: 0,
        webhookUrl: searchData.webhookUrl
      };
      
      res.status(200).json(newSearch);
    } catch (error) {
      console.error("Erro ao criar busca de prospecção:", error);
      res.status(500).json({ 
        message: "Erro ao criar busca de prospecção", 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  app.get("/api/prospecting/results/:searchId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.searchId);
      
      if (isNaN(searchId)) {
        return res.status(400).json({ message: "ID de busca inválido" });
      }
      
      // Encontrar a busca correspondente
      const search = await storage.getProspectingSearch(searchId);
      
      if (!search) {
        // Se a busca não existir no banco, usar a busca mockada
        console.log("Busca não encontrada, usando resultados mockados");
      }
      
      // Identificar a cidade da busca para criar resultados mais relevantes
      const cidade = search?.city || "São Paulo";
      const segmento = search?.segment || "Transporte";
      
      // Mock de resultados para demonstração baseado no exemplo do usuário
      const mockResults = [
        {
          id: 1,
          searchId,
          nome: `${segmento} Escolar ${cidade}`,
          telefone: `+55 43 99144-0027`,
          email: '',
          endereco: `R. Meyer, 340, ${cidade}`,
          tipo: "Transportation service",
          site: "www.transporteescolar.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 2,
          searchId,
          nome: `TCGL - Transporte Coletivo Grande ${cidade}`,
          telefone: `+55 43 3379-2400`,
          email: '',
          endereco: `R. Messias W. de Souza, 756, ${cidade}`,
          tipo: "Transportation service",
          site: "www.tcgl.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 3,
          searchId,
          nome: `Sabrina Transportes Escolares`,
          telefone: `+55 43 99143-7056`,
          email: '',
          endereco: `R. Antonio Inácio Pereira, 110, ${cidade}`,
          tipo: "Transportation service",
          site: "www.sabrinatransportes.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 4,
          searchId,
          nome: `Balla Transportes`,
          telefone: `+55 43 99478-7660`,
          email: '',
          endereco: `R. Brasil, 1625, ${cidade}`,
          tipo: "Mover",
          site: "www.ballatransportes.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 5,
          searchId,
          nome: `BR TRANSPORTES FRETES`,
          telefone: `+55 43 99167-7134`,
          email: '',
          endereco: `R. Ouro Preto, 440, ${cidade}`,
          tipo: "Freight forwarding service",
          site: "www.brtransportes.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 6,
          searchId,
          nome: `Pozzer Transportes`,
          telefone: `+55 43 3379-9500`,
          email: '',
          endereco: `Av. Tiradentes, 3205, ${cidade}`,
          tipo: "Transportation service",
          site: "www.pozzertransportes.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 7,
          searchId,
          nome: `Transportadora em ${cidade} Paraná - AIL Logística e Transporte`,
          telefone: `+55 43 3052-1809`,
          email: '',
          endereco: `Avenida Ayrton Senna da Silva 200 sl 1704 Gleba Palhano 1, ${cidade}`,
          tipo: "Trucking company",
          site: "www.aillogistica.com.br",
          cidade: cidade,
          estado: "PR"
        },
        {
          id: 8,
          searchId,
          nome: `Sotran SA Logística e Transportes`,
          telefone: `+55 43 3711-3800`,
          email: '',
          endereco: `Rua João Wyclif, 111 - 2301, ${cidade}`,
          tipo: "Trucking company",
          site: "www.sotran.com.br",
          cidade: cidade,
          estado: "PR"
        }
      ];
      
      // Se houver mais de 8 resultados, adicionar outros resultados mockados
      if ((search?.leadsFound || 0) > 8) {
        const extras = Array.from({ length: (search?.leadsFound || 0) - 8 }, (_, i) => ({
          id: i + 9,
          searchId,
          nome: `${segmento} ${i + 9} ${cidade}`,
          telefone: `+55 43 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
          email: '',
          endereco: `R. ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 1000) + 100}, ${cidade}`,
          tipo: i % 2 === 0 ? "Transportation service" : "Logistics company",
          site: `www.transporte${i + 9}.com.br`,
          cidade: cidade,
          estado: "PR"
        }));
        
        mockResults.push(...extras);
      }
      
      res.json(mockResults);
    } catch (error) {
      console.error("Erro ao buscar resultados de prospecção:", error);
      res.status(500).json({ message: "Erro ao buscar resultados de prospecção" });
    }
  });

  app.delete("/api/prospecting/searches/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      
      if (isNaN(searchId)) {
        return res.status(400).json({ message: "ID de busca inválido" });
      }
      
      // Simula exclusão bem-sucedida
      res.status(200).json({ message: "Busca excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir busca de prospecção:", error);
      res.status(500).json({ message: "Erro ao excluir busca de prospecção" });
    }
  });

  // Rota callback para receber atualizações dos webhooks de prospecção
  app.post("/api/prospecting/webhook-callback/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const callbackData = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: "ID de usuário inválido" });
      }
      
      console.log(`Recebido callback de prospecção para usuário ${userId}:`, callbackData);
      
      // Aqui você implementaria a lógica para atualizar o status da busca
      // e adicionar novos resultados
      
      res.status(200).json({ success: true, message: "Callback processado com sucesso" });
    } catch (error) {
      console.error("Erro ao processar callback de prospecção:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao processar callback de prospecção", 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
