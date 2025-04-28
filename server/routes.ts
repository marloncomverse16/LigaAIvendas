import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { setupFileUpload } from "./uploads";
import { insertLeadSchema, insertProspectSchema, insertDispatchSchema, insertSettingsSchema } from "@shared/schema";
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

  const httpServer = createServer(app);
  return httpServer;
}
