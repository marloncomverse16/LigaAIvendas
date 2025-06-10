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
  
  // API de contatos com ISOLAMENTO RIGOROSO - sem sincronização automática
  app.get("/api/contacts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    try {
      const userId = req.user!.id;
      console.log(`🔍 [ISOLADO] Buscando contatos para usuário ${userId}`);
      
      // Importar dependências necessárias
      const { db } = await import('./db');
      const { contacts } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // ISOLAMENTO GARANTIDO: Buscar APENAS contatos do usuário autenticado
      const userContacts = await db.select().from(contacts)
        .where(eq(contacts.userId, userId))
        .orderBy(contacts.name, contacts.phoneNumber);
      
      console.log(`✅ [ISOLADO] Encontrados ${userContacts.length} contatos para usuário ${userId}`);
      console.log(`📋 [DEBUG] Contatos retornados:`, userContacts.map(c => ({ id: c.id, userId: c.userId, phone: c.phoneNumber, name: c.name })));
      
      res.json({ contacts: userContacts });
    } catch (error) {
      console.error('❌ Erro ao buscar contatos isolados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar contatos',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Endpoint temporariamente BLOQUEADO para evitar vazamento de dados
  app.post("/api/contacts/sync-all", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    console.error('❌ ENDPOINT BLOQUEADO: /api/contacts/sync-all foi desativado devido a vazamento de dados');
    
    return res.status(503).json({
      success: false,
      message: 'Sincronização temporariamente desabilitada por segurança',
      error: 'Isolamento de dados em correção'
    });
  });

  // Endpoint temporariamente BLOQUEADO para evitar vazamento de dados
  app.post("/api/chat/sync-contacts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    
    console.error('❌ ENDPOINT BLOQUEADO: /api/chat/sync-contacts foi desativado devido a vazamento de dados');
    
    return res.status(503).json({
      success: false,
      message: 'Sincronização temporariamente desabilitada por segurança',
      error: 'Isolamento de dados em correção'
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}