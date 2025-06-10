import { Request, Response } from "express";
import { db } from "../db";
import { serverAiAgents, type InsertServerAiAgent } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Retorna a lista de agentes IA para um determinado servidor
 */
export async function getServerAiAgents(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const serverId = parseInt(req.params.serverId);
    const userId = req.user!.id;
    
    if (isNaN(serverId)) {
      return res.status(400).json({ message: "ID do servidor inválido" });
    }

    // Verificar se o usuário tem acesso a este servidor
    const { storage } = await import('../storage');
    const userServers = await storage.getUserServers(userId);
    const hasAccess = userServers.some(us => us.server?.id === serverId);
    
    if (!hasAccess) {
      console.log(`⚠️ SECURITY: Usuário ${userId} tentou acessar agentes IA do servidor ${serverId} sem permissão`);
      return res.status(403).json({ message: "Acesso negado a este servidor" });
    }

    const agents = await db.select().from(serverAiAgents)
      .where(eq(serverAiAgents.serverId, serverId));
    
    return res.status(200).json(agents);
  } catch (error) {
    console.error("Erro ao buscar agentes IA:", error);
    return res.status(500).json({ message: "Erro ao buscar agentes IA" });
  }
}

/**
 * Cria um novo agente IA para um servidor
 */
export async function createServerAiAgent(req: Request, res: Response) {
  try {
    const serverId = parseInt(req.params.serverId);
    
    if (isNaN(serverId)) {
      return res.status(400).json({ message: "ID do servidor inválido" });
    }

    const data: InsertServerAiAgent = {
      ...req.body,
      serverId,
    };

    const [agent] = await db.insert(serverAiAgents)
      .values(data)
      .returning();
    
    return res.status(201).json(agent);
  } catch (error) {
    console.error("Erro ao criar agente IA:", error);
    return res.status(500).json({ message: "Erro ao criar agente IA" });
  }
}

/**
 * Atualiza um agente IA existente
 */
export async function updateServerAiAgent(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const agentId = parseInt(req.params.agentId);
    const userId = req.user!.id;
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "ID do agente inválido" });
    }

    // Buscar o agente para verificar o servidor e propriedade
    const [existingAgent] = await db.select().from(serverAiAgents)
      .where(eq(serverAiAgents.id, agentId));
    
    if (!existingAgent) {
      return res.status(404).json({ message: "Agente IA não encontrado" });
    }

    // Verificar se o usuário tem acesso ao servidor deste agente
    const { storage } = await import('../storage');
    const userServers = await storage.getUserServers(userId);
    const hasAccess = userServers.some(us => us.server?.id === existingAgent.serverId);
    
    if (!hasAccess) {
      console.log(`⚠️ SECURITY: Usuário ${userId} tentou atualizar agente IA ${agentId} do servidor ${existingAgent.serverId} sem permissão`);
      return res.status(403).json({ message: "Acesso negado a este agente IA" });
    }

    const [updated] = await db.update(serverAiAgents)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(serverAiAgents.id, agentId))
      .returning();
    
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao atualizar agente IA:", error);
    return res.status(500).json({ message: "Erro ao atualizar agente IA" });
  }
}

/**
 * Remove um agente IA
 */
export async function deleteServerAiAgent(req: Request, res: Response) {
  try {
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "ID do agente inválido" });
    }

    const [deleted] = await db.delete(serverAiAgents)
      .where(eq(serverAiAgents.id, agentId))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ message: "Agente IA não encontrado" });
    }
    
    return res.status(200).json({ message: "Agente IA removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover agente IA:", error);
    return res.status(500).json({ message: "Erro ao remover agente IA" });
  }
}

/**
 * Obtém detalhes de um agente IA específico
 */
export async function getServerAiAgent(req: Request, res: Response) {
  try {
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "ID do agente inválido" });
    }

    const [agent] = await db.select().from(serverAiAgents)
      .where(eq(serverAiAgents.id, agentId));
    
    if (!agent) {
      return res.status(404).json({ message: "Agente IA não encontrado" });
    }
    
    return res.status(200).json(agent);
  } catch (error) {
    console.error("Erro ao buscar agente IA:", error);
    return res.status(500).json({ message: "Erro ao buscar agente IA" });
  }
}