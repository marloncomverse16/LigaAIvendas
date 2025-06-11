import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProspectingSearchSchema } from "@shared/schema";
import axios from "axios";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação primeiro
  setupAuth(app);
  // Auth Routes
  app.post("/api/register", async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...userData,
        password: await hashPassword(userData.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Prospecting Routes com Webhook Automático
  app.get("/api/prospecting/searches", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const searches = await storage.getProspectingSearches(userId);
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
      
      console.log(`🔍 Iniciando nova pesquisa de prospecção para usuário ${userId}`);
      
      // Buscar o servidor conectado do usuário para obter o webhook de prospecção
      const userServers = await storage.getUserServers(userId);
      if (userServers.length === 0) {
        console.log(`❌ Nenhum servidor configurado para usuário ${userId}`);
        return res.status(400).json({ message: "Nenhum servidor configurado para este usuário" });
      }
      
      const serverConfig = userServers[0];
      const prospectingWebhookUrl = serverConfig.server?.prospectingWebhookUrl;
      
      if (!prospectingWebhookUrl) {
        console.log(`❌ Webhook de prospecção não configurado no servidor ${serverConfig.serverId}`);
        return res.status(400).json({ 
          message: "Webhook de prospecção não configurado no servidor conectado" 
        });
      }
      
      console.log(`🔗 Usando webhook automático de prospecção: ${prospectingWebhookUrl}`);
      
      // Criar nova pesquisa com o webhook do servidor
      const search = await storage.createProspectingSearch({
        ...searchData,
        userId,
        status: "pendente",
        webhookUrl: prospectingWebhookUrl
      });
      
      console.log(`✅ Pesquisa ${search.id} criada, iniciando chamada para webhook...`);
      
      // Fazer a chamada para o webhook automaticamente
      try {
        const webhookResponse = await axios.get(prospectingWebhookUrl, {
          params: {
            segment: searchData.segment,
            city: searchData.city,
            filters: searchData.filters
          },
          timeout: 30000 // 30 segundos de timeout
        });
        
        console.log(`📊 Webhook respondeu com ${webhookResponse.data?.length || 0} resultados`);
        
        // Marcar pesquisa como concluída
        const updatedSearch = await storage.updateProspectingSearch(search.id, {
          status: "concluido",
          leadsFound: Array.isArray(webhookResponse.data) ? webhookResponse.data.length : 0
        });
        
        // Processar dados retornados
        if (Array.isArray(webhookResponse.data) && webhookResponse.data.length > 0) {
          console.log(`📝 Processando ${webhookResponse.data.length} resultados...`);
          
          for (const item of webhookResponse.data) {
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
                searchId: search.id,
                name: nome,
                phone: telefone,
                email: email,
                address: endereco,
                type: tipo,
                cidade: cidade,
                estado: estado,
                site: site
              });
            } catch (itemError) {
              console.error("Erro ao processar item:", itemError);
            }
          }
        }
        
        res.status(201).json(updatedSearch);
        console.log(`✅ Pesquisa ${search.id} processada com sucesso via webhook automático`);
        
      } catch (webhookError: any) {
        console.error("❌ Erro ao chamar webhook:", webhookError.message);
        
        // Marcar pesquisa como erro
        const errorSearch = await storage.updateProspectingSearch(search.id, {
          status: "erro"
        });
        
        return res.status(500).json({
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

  // Prospecting Results Routes
  app.get("/api/prospecting/searches/:id/results", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const searchId = parseInt(req.params.id);
      const userId = (req.user as Express.User).id;
      
      const results = await storage.getProspectingResults(searchId);
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar resultados:", error);
      res.status(500).json({ message: "Erro ao buscar resultados" });
    }
  });

  // Server Routes
  app.get("/api/servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const servers = await storage.getAllServers();
      res.json(servers);
    } catch (error) {
      console.error("Erro ao buscar servidores:", error);
      res.status(500).json({ message: "Erro ao buscar servidores" });
    }
  });

  app.get("/api/user-servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const userServers = await storage.getUserServers(userId);
      res.json(userServers);
    } catch (error) {
      console.error("Erro ao buscar servidores do usuário:", error);
      res.status(500).json({ message: "Erro ao buscar servidores do usuário" });
    }
  });

  app.post("/api/user-servers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const { serverId } = req.body;
      
      const userServer = await storage.connectUserToServer(userId, serverId);
      res.status(201).json(userServer);
    } catch (error) {
      console.error("Erro ao conectar servidor:", error);
      res.status(500).json({ message: "Erro ao conectar servidor" });
    }
  });

  // Settings Routes
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const settings = await storage.getSettingsByUserId(userId);
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  // AI Agent Routes
  app.get("/api/ai-agent", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = (req.user as Express.User).id;
      const agent = await storage.getAiAgentByUserId(userId);
      res.json(agent);
    } catch (error) {
      console.error("Erro ao buscar agente AI:", error);
      res.status(500).json({ message: "Erro ao buscar agente AI" });
    }
  });

  // Configure HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}