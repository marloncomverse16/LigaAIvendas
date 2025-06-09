import { Request, Response } from "express";
import { db } from "../db";
import { prospectingResults, prospectingSearches, messageSendingHistory } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getUserServer, UserServerMetaData } from "../api/meta-api-service";
import { getMetaApiTemplates, sendMetaApiMessage, MetaMessageRequest } from "../meta-whatsapp-api";

/**
 * Envia mensagens diretamente pela API da Meta
 * Usado quando o tipo de conexão selecionado é "whatsapp_meta_api"
 */
export async function sendMetaMessageDirectly(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const { 
      searchId, 
      templateId, 
      templateName, 
      quantity,
      // Informações adicionais do usuário
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
    
    // Registrar as informações do usuário para depuração
    console.log("Informações do usuário recebidas:", {
      userId,
      userName,
      userEmail,
      userCompany
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
    
    // Buscar os resultados da pesquisa
    const results = await db.select()
      .from(prospectingResults)
      .where(eq(prospectingResults.searchId, searchId))
      .limit(quantity || 1000);
    
    if (!results.length) {
      return res.status(404).json({ message: "Nenhum resultado encontrado para esta pesquisa" });
    }
    
    console.log(`Iniciando envio via Meta API para ${results.length} destinatários`);
    
    // Verificar se o usuário tem configuração para Meta API
    const metaUserServer = await getUserServer(req.user.id);
    
    if (!metaUserServer.success || !metaUserServer.phoneNumberId) {
      return res.status(400).json({ 
        message: "Configuração da Meta API não encontrada. Configure nas Configurações > WhatsApp Cloud API (Meta)" 
      });
    }
    
    // Criar registro de histórico para este envio
    const [historyRecord] = await db.insert(messageSendingHistory)
      .values({
        userId: req.user.id,
        searchId: searchId,
        templateId: templateId,
        templateName: templateName,
        connectionType: "whatsapp_meta_api",
        totalRecipients: results.length,
        status: "em_andamento",
        startedAt: new Date(),
        createdAt: new Date()
      })
      .returning();

    console.log("Registro de histórico criado:", historyRecord.id);
    
    // Iniciar o envio em segundo plano
    // Retornar resposta imediatamente e continuar processamento
    res.status(200).json({ 
      message: "Envio iniciado", 
      totalRecipients: results.length,
      templateId,
      templateName,
      // Incluir informações do usuário na resposta
      user: {
        id: userId || req.user.id,
        name: userName || req.user.name,
        email: userEmail || req.user.email,
        company: userCompany || req.user.company
      }
    });
    
    // Continuar o processamento em segundo plano
    (async () => {
      let successCount = 0;
      let errorCount = 0;
      let lastError = "";
      
      // Processar cada contato
      for (const result of results) {
        if (!result.phone) {
          errorCount++;
          continue;
        }
        
        try {
          // Formatar o número do telefone (remover caracteres não-numéricos)
          const phoneNumber = result.phone.replace(/\D/g, "");
          
          // Enviar mensagem usando o template
          const messageRequest: MetaMessageRequest = {
            to: phoneNumber,
            templateId: templateId,
            templateName: templateName,
            language: "pt_BR",
            components: [] // Templates da Meta não usam componentes dinâmicos nesta implementação
          };
          
          const sendResult = await sendMetaApiMessage(
            messageRequest,
            metaUserServer.token || "",
            metaUserServer.phoneNumberId || "",
            metaUserServer.apiVersion
          );
          
          if (sendResult.success) {
            successCount++;
          } else {
            errorCount++;
            lastError = sendResult.error || "Erro desconhecido ao enviar mensagem";
          }
        } catch (error: any) {
          console.error("Erro ao enviar mensagem para", result.phone, error);
          errorCount++;
          lastError = error.message || "Erro desconhecido ao enviar mensagem";
        }
      }
      
      // Atualizar o registro de histórico com o resultado final
      if (historyRecord) {
        await db.update(messageSendingHistory)
          .set({
            status: "concluido",
            successCount,
            errorCount,
            errorMessage: lastError || null,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(messageSendingHistory.id, historyRecord.id));
      }
      
      console.log(`Envio concluído: ${successCount} enviados, ${errorCount} erros`);
    })().catch((error: any) => {
      console.error("Erro no processamento em segundo plano:", error);
      // Atualizar o registro de histórico com o erro
      if (historyRecord) {
        db.update(messageSendingHistory)
          .set({
            status: "erro",
            errorMessage: error.message || "Erro desconhecido no processamento",
            updatedAt: new Date()
          })
          .where(eq(messageSendingHistory.id, historyRecord.id))
          .then(() => console.log("Registro de histórico atualizado com erro"))
          .catch(err => console.error("Erro ao atualizar registro de histórico:", err));
      }
    });
    
  } catch (error: any) {
    console.error("Erro ao enviar mensagens via Meta API:", error);
    return res.status(500).json({ message: "Erro ao enviar mensagens: " + (error.message || "Erro desconhecido") });
  }
}