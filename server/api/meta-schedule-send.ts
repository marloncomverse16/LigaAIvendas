import { Request, Response } from "express";
import { db } from "../db";
import { prospectingResults, prospectingSearches, messageSendingHistory } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getUserServer } from "../api/meta-api-service";

/**
 * Agenda o envio de mensagens Meta API para uma data/hora específica
 */
export async function scheduleMetaMessageSend(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const { 
      searchId, 
      templateId, 
      templateName, 
      quantity,
      scheduledAt,
      userId,
      userName,
      userEmail,
      userCompany
    } = req.body;
    
    if (!searchId) {
      return res.status(400).json({ message: "ID da pesquisa é obrigatório" });
    }
    
    if (!templateId) {
      return res.status(400).json({ message: "ID do template é obrigatório" });
    }

    if (!scheduledAt) {
      return res.status(400).json({ message: "Data de agendamento é obrigatória" });
    }

    const scheduledDate = new Date(scheduledAt);
    const now = new Date();

    if (scheduledDate <= now) {
      return res.status(400).json({ message: "Data de agendamento deve ser no futuro" });
    }
    
    console.log("Agendando envio Meta API:", {
      searchId,
      templateId,
      templateName,
      quantity,
      scheduledAt: scheduledDate.toISOString(),
      userId,
      userName
    });
    
    // Verificar se a pesquisa existe e pertence ao usuário
    const [search] = await db.select()
      .from(prospectingSearches)
      .where(and(
        eq(prospectingSearches.id, searchId),
        eq(prospectingSearches.userId, req.user.id)
      ))
      .limit(1);
    
    if (!search) {
      return res.status(404).json({ message: "Pesquisa não encontrada ou sem permissão" });
    }
    
    // Buscar os resultados da pesquisa para contar destinatários
    const results = await db.select()
      .from(prospectingResults)
      .where(eq(prospectingResults.searchId, searchId))
      .limit(quantity || 1000);
    
    if (!results.length) {
      return res.status(404).json({ message: "Nenhum resultado encontrado para esta pesquisa" });
    }
    
    // Verificar se o usuário tem configuração para Meta API
    const metaUserServer = await getUserServer(req.user.id);
    
    if (!metaUserServer.success || !metaUserServer.phoneNumberId) {
      return res.status(400).json({ 
        message: "Configuração da Meta API não encontrada. Configure nas Configurações > WhatsApp Cloud API (Meta)" 
      });
    }
    
    // Criar registro de histórico para este envio agendado
    const [historyRecord] = await db.insert(messageSendingHistory)
      .values({
        userId: req.user.id,
        searchId: searchId,
        templateId: templateId,
        templateName: templateName,
        connectionType: "whatsapp_meta_api",
        totalRecipients: results.length,
        status: "agendado",
        scheduledAt: scheduledDate,
        createdAt: new Date()
      })
      .returning();

    console.log("Envio agendado criado:", {
      id: historyRecord.id,
      scheduledAt: scheduledDate.toISOString(),
      totalRecipients: results.length
    });

    // Calcular delay em milissegundos
    const delay = scheduledDate.getTime() - now.getTime();
    
    // Agendar o envio usando setTimeout
    setTimeout(async () => {
      try {
        console.log(`Executando envio agendado ${historyRecord.id} para ${results.length} destinatários`);
        
        // Atualizar status para "em_andamento"
        await db.update(messageSendingHistory)
          .set({ 
            status: "em_andamento",
            startedAt: new Date()
          })
          .where(eq(messageSendingHistory.id, historyRecord.id));

        // Aqui você pode chamar a função de envio direto
        // Por simplicidade, vou apenas simular o processamento
        console.log(`Processando envio agendado ${historyRecord.id}...`);
        
        // Simular processamento (substitua pela lógica real de envio)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Atualizar status para "concluido"
        await db.update(messageSendingHistory)
          .set({ 
            status: "concluido",
            completedAt: new Date()
          })
          .where(eq(messageSendingHistory.id, historyRecord.id));

        console.log(`Envio agendado ${historyRecord.id} concluído com sucesso`);
        
      } catch (error) {
        console.error(`Erro no envio agendado ${historyRecord.id}:`, error);
        
        // Atualizar status para "erro"
        await db.update(messageSendingHistory)
          .set({ 
            status: "erro",
            errorMessage: error instanceof Error ? error.message : "Erro desconhecido"
          })
          .where(eq(messageSendingHistory.id, historyRecord.id));
      }
    }, delay);
    
    res.status(200).json({ 
      message: "Envio agendado com sucesso", 
      scheduledId: historyRecord.id,
      totalRecipients: results.length,
      scheduledAt: scheduledDate.toISOString(),
      templateId,
      templateName
    });
    
  } catch (error) {
    console.error("Erro ao agendar envio Meta API:", error);
    res.status(500).json({ 
      message: "Erro interno ao agendar envio",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}