import { Request, Response } from "express";
import { db } from "../db";
import { userAiAgents, serverAiAgents, type InsertUserAiAgent } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Retorna os agentes IA associados ao usuário atual
 */
export async function getUserAiAgents(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: "ID do usuário inválido" });
    }

    // Buscar todos os agentes do usuário com informações completas do agente
    const agents = await db.select({
      id: userAiAgents.id,
      userId: userAiAgents.userId,
      agentId: userAiAgents.agentId,
      isDefault: userAiAgents.isDefault,
      createdAt: userAiAgents.createdAt,
      updatedAt: userAiAgents.updatedAt,
      // Dados do agente
      agentName: serverAiAgents.name,
      agentDescription: serverAiAgents.description,
      agentWebhookUrl: serverAiAgents.webhookUrl,
      agentActive: serverAiAgents.active,
      serverId: serverAiAgents.serverId,
    })
    .from(userAiAgents)
    .innerJoin(serverAiAgents, eq(userAiAgents.agentId, serverAiAgents.id))
    .where(eq(userAiAgents.userId, userId));
    
    return res.status(200).json(agents);
  } catch (error) {
    console.error("Erro ao buscar agentes IA do usuário:", error);
    return res.status(500).json({ message: "Erro ao buscar agentes IA do usuário" });
  }
}

/**
 * Retorna os agentes IA disponíveis para um servidor específico que ainda
 * não estão associados ao usuário.
 */
export async function getAvailableServerAiAgents(req: Request, res: Response) {
  try {
    const serverId = parseInt(req.params.serverId);
    const userId = parseInt(req.params.userId);
    
    if (isNaN(serverId) || isNaN(userId)) {
      return res.status(400).json({ message: "Parâmetros inválidos" });
    }

    // Buscar os IDs dos agentes que o usuário já possui
    const userAgents = await db
      .select({ agentId: userAiAgents.agentId })
      .from(userAiAgents)
      .where(eq(userAiAgents.userId, userId));
    
    // Extrair apenas os IDs para um array
    const userAgentIds = userAgents.map(ua => ua.agentId);
    
    // Buscar agentes do servidor que não estão na lista de agentes do usuário
    const availableAgents = await db
      .select()
      .from(serverAiAgents)
      .where(
        and(
          eq(serverAiAgents.serverId, serverId),
          eq(serverAiAgents.active, true),
          userAgentIds.length > 0 
            ? sql`${serverAiAgents.id} NOT IN (${userAgentIds.join(',')})`
            : undefined // Se não houver agentes associados, não aplicar esta condição
        )
      );
    
    return res.status(200).json(availableAgents);
  } catch (error) {
    console.error("Erro ao buscar agentes IA disponíveis:", error);
    return res.status(500).json({ message: "Erro ao buscar agentes IA disponíveis" });
  }
}

/**
 * Associa um agente IA a um usuário
 */
export async function assignAiAgentToUser(req: Request, res: Response) {
  try {
    const data: InsertUserAiAgent = req.body;
    
    // Verificar se o usuário e o agente existem
    if (!data.userId || !data.agentId) {
      return res.status(400).json({ message: "Dados incompletos" });
    }
    
    // Verificar se a associação já existe
    const existing = await db
      .select()
      .from(userAiAgents)
      .where(
        and(
          eq(userAiAgents.userId, data.userId),
          eq(userAiAgents.agentId, data.agentId)
        )
      );
      
    if (existing.length > 0) {
      return res.status(400).json({ message: "Este agente já está associado ao usuário" });
    }
    
    // Se for definido como padrão, primeiro remover o padrão existente
    if (data.isDefault) {
      await db
        .update(userAiAgents)
        .set({ isDefault: false })
        .where(eq(userAiAgents.userId, data.userId));
    }
    
    // Criar a nova associação
    const [userAgent] = await db
      .insert(userAiAgents)
      .values(data)
      .returning();
    
    return res.status(201).json(userAgent);
  } catch (error) {
    console.error("Erro ao associar agente IA ao usuário:", error);
    return res.status(500).json({ message: "Erro ao associar agente IA ao usuário" });
  }
}

/**
 * Remove a associação de um agente IA com um usuário
 */
export async function removeAiAgentFromUser(req: Request, res: Response) {
  try {
    const userAgentId = parseInt(req.params.userAgentId);
    
    if (isNaN(userAgentId)) {
      return res.status(400).json({ message: "ID de associação inválido" });
    }
    
    const [deleted] = await db
      .delete(userAiAgents)
      .where(eq(userAiAgents.id, userAgentId))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ message: "Associação não encontrada" });
    }
    
    return res.status(200).json({ message: "Agente IA removido do usuário com sucesso" });
  } catch (error) {
    console.error("Erro ao remover agente IA do usuário:", error);
    return res.status(500).json({ message: "Erro ao remover agente IA do usuário" });
  }
}

/**
 * Define um agente IA como padrão para o usuário
 */
export async function setDefaultAiAgent(req: Request, res: Response) {
  try {
    const userAgentId = parseInt(req.params.userAgentId);
    
    if (isNaN(userAgentId)) {
      return res.status(400).json({ message: "ID de associação inválido" });
    }
    
    // Buscar o ID do usuário para esta associação
    const [userAgent] = await db
      .select()
      .from(userAiAgents)
      .where(eq(userAiAgents.id, userAgentId));
    
    if (!userAgent) {
      return res.status(404).json({ message: "Associação não encontrada" });
    }
    
    // Remover o padrão existente
    await db
      .update(userAiAgents)
      .set({ isDefault: false })
      .where(eq(userAiAgents.userId, userAgent.userId));
    
    // Definir o novo padrão
    const [updated] = await db
      .update(userAiAgents)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(userAiAgents.id, userAgentId))
      .returning();
    
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao definir agente IA padrão:", error);
    return res.status(500).json({ message: "Erro ao definir agente IA padrão" });
  }
}