import { Request, Response } from "express";
import { db } from "../db";
import { serverAiAgents, type InsertServerAiAgent } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Retorna a lista de agentes IA para um determinado servidor
 */
export async function getServerAiAgents(req: Request, res: Response) {
  try {
    const serverId = parseInt(req.params.serverId);
    
    if (isNaN(serverId)) {
      return res.status(400).json({ message: "ID do servidor inválido" });
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
  try {
    const agentId = parseInt(req.params.agentId);
    
    if (isNaN(agentId)) {
      return res.status(400).json({ message: "ID do agente inválido" });
    }

    const [updated] = await db.update(serverAiAgents)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(serverAiAgents.id, agentId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ message: "Agente IA não encontrado" });
    }
    
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