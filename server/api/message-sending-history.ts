import { Request, Response } from "express";
import { db } from "../db";
import { messageSendingHistory, insertMessageSendingHistorySchema } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Cria um novo registro de histórico de envio de mensagens
 */
export async function createMessageSendingHistory(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    // Validar os dados recebidos
    console.log("Dados recebidos para validação:", {
      ...req.body,
      userId: req.user.id
    });
    
    const validationResult = insertMessageSendingHistorySchema.safeParse({
      ...req.body,
      userId: req.user.id
    });
    
    if (!validationResult.success) {
      console.error("Erro de validação:", JSON.stringify(validationResult.error.errors, null, 2));
      return res.status(400).json({ 
        message: "Dados inválidos", 
        errors: validationResult.error.errors 
      });
    }
    
    // Criar o registro no banco de dados
    const historyData = validationResult.data;
    
    const [created] = await db.insert(messageSendingHistory)
      .values({
        ...historyData,
        userId: req.user.id,
        startedAt: new Date(),
        createdAt: new Date()
      })
      .returning();

    // Se for envio QR Code, rastrear contatos para os relatórios
    if (historyData.connectionType === 'whatsapp_qr' && historyData.searchId) {
      try {
        const { trackBulkQrMessages } = await import('./qr-message-tracker');
        const { pool } = await import('../db');
        
        // Buscar telefones da pesquisa
        const phonesQuery = `SELECT phone FROM prospecting_results WHERE search_id = $1`;
        const phonesResult = await pool.query(phonesQuery, [historyData.searchId]);
        
        const phoneNumbers = phonesResult.rows.map(row => row.phone);
        const message = historyData.messageText || historyData.templateName || 'Mensagem enviada via QR Code';
        
        console.log(`📤 Rastreando ${phoneNumbers.length} mensagens QR para relatórios`);
        await trackBulkQrMessages(req.user.id, phoneNumbers, message);
        
      } catch (trackError) {
        console.error('❌ Erro ao rastrear mensagens QR:', trackError);
        // Não falhar o envio por causa do rastreamento
      }
    }
    
    return res.status(201).json(created);
  } catch (error) {
    console.error("Erro ao criar histórico de envio:", error);
    return res.status(500).json({ message: "Erro ao criar histórico de envio" });
  }
}

/**
 * Lista o histórico de envios de mensagens do usuário
 */
export async function listMessageSendingHistory(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const history = await db.select()
      .from(messageSendingHistory)
      .where(eq(messageSendingHistory.userId, req.user.id))
      .orderBy(messageSendingHistory.createdAt);
    
    return res.json(history);
  } catch (error) {
    console.error("Erro ao listar histórico de envios:", error);
    return res.status(500).json({ message: "Erro ao listar histórico de envios" });
  }
}

/**
 * Atualiza o status de um envio e registra resultados
 */
export async function updateMessageSendingHistory(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  const { id } = req.params;
  
  try {
    // Buscar o registro para verificar se pertence ao usuário
    const [existingHistory] = await db.select()
      .from(messageSendingHistory)
      .where(eq(messageSendingHistory.id, parseInt(id)))
      .limit(1);
    
    if (!existingHistory) {
      return res.status(404).json({ message: "Registro de envio não encontrado" });
    }
    
    if (existingHistory.userId !== req.user.id) {
      return res.status(403).json({ message: "Você não tem permissão para modificar este registro" });
    }
    
    // Atualizar os dados
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Se está marcando como completo, adicionar data de conclusão
    if (updateData.status === "concluido") {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db.update(messageSendingHistory)
      .set(updateData)
      .where(eq(messageSendingHistory.id, parseInt(id)))
      .returning();
    
    return res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar histórico de envio:", error);
    return res.status(500).json({ message: "Erro ao atualizar histórico de envio" });
  }
}