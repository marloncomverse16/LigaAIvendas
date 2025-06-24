import { db } from "../db";
import { messageSendingHistory, prospectingResults } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { getUserServer } from "./meta-api-service";

/**
 * Sistema de agendamento robusto que verifica periodicamente por envios pendentes
 */
export class MessageScheduler {
  private static instance: MessageScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): MessageScheduler {
    if (!MessageScheduler.instance) {
      MessageScheduler.instance = new MessageScheduler();
    }
    return MessageScheduler.instance;
  }

  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("📅 Iniciando sistema de agendamento de mensagens");
    
    // Verificar a cada 30 segundos por envios agendados que devem ser executados
    this.intervalId = setInterval(async () => {
      await this.checkPendingSchedules();
    }, 30000); // 30 segundos
    
    // Verificar imediatamente na inicialização
    this.checkPendingSchedules();
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("📅 Sistema de agendamento interrompido");
  }

  private async checkPendingSchedules() {
    try {
      const now = new Date();
      
      // Buscar envios agendados que devem ser executados agora
      const pendingSchedules = await db.select()
        .from(messageSendingHistory)
        .where(
          and(
            eq(messageSendingHistory.status, "agendado"),
            lte(messageSendingHistory.scheduledAt, now)
          )
        );

      if (pendingSchedules.length > 0) {
        console.log(`📅 Encontrados ${pendingSchedules.length} envios agendados para executar`);
      }

      for (const schedule of pendingSchedules) {
        await this.executeScheduledSend(schedule);
      }
    } catch (error) {
      console.error("📅 Erro ao verificar agendamentos:", error);
    }
  }

  private async executeScheduledSend(schedule: any) {
    try {
      console.log(`📅 Executando envio agendado ${schedule.id} para ${schedule.totalRecipients} destinatários`);
      
      // Atualizar status para "em_andamento"
      await db.update(messageSendingHistory)
        .set({ 
          status: "em_andamento",
          startedAt: new Date()
        })
        .where(eq(messageSendingHistory.id, schedule.id));

      // Buscar os resultados da pesquisa
      const results = await db.select()
        .from(prospectingResults)
        .where(eq(prospectingResults.searchId, schedule.searchId));

      if (!results.length) {
        throw new Error("Nenhum resultado encontrado para esta pesquisa");
      }

      // Verificar configuração Meta API do usuário
      const metaUserServer = await getUserServer(schedule.userId);
      
      if (!metaUserServer.success || !metaUserServer.phoneNumberId) {
        throw new Error("Configuração da Meta API não encontrada");
      }

      // Importar função de envio Meta API
      const { sendMetaApiMessage } = await import("../meta-whatsapp-api");
      
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
          // Formatar o número do telefone
          const phoneNumber = result.phone.replace(/\D/g, "");
          
          // Enviar mensagem usando o template
          const messageRequest = {
            to: phoneNumber,
            templateId: schedule.templateId,
            templateName: schedule.templateName,
            language: "pt_BR",
            components: []
          };
          
          const sendResult = await sendMetaApiMessage(
            messageRequest,
            metaUserServer.token || "",
            metaUserServer.phoneNumberId || "",
            metaUserServer.apiVersion
          );
          
          if (sendResult.success) {
            successCount++;
            console.log(`📅 ✅ Mensagem enviada para ${phoneNumber}`);
          } else {
            errorCount++;
            lastError = sendResult.error || "Erro desconhecido ao enviar mensagem";
            console.log(`📅 ❌ Erro ao enviar para ${phoneNumber}: ${lastError}`);
          }
          
          // Pequeno delay entre envios para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          console.error("📅 Erro ao enviar mensagem para", result.phone, error);
          errorCount++;
          lastError = error.message || "Erro desconhecido ao enviar mensagem";
        }
      }
      
      // Atualizar status final
      await db.update(messageSendingHistory)
        .set({ 
          status: "concluido",
          successCount,
          errorCount,
          errorMessage: lastError || null,
          completedAt: new Date()
        })
        .where(eq(messageSendingHistory.id, schedule.id));

      console.log(`📅 Envio agendado ${schedule.id} concluído: ${successCount} enviados, ${errorCount} erros`);
      
    } catch (error: any) {
      console.error(`📅 Erro no envio agendado ${schedule.id}:`, error);
      
      // Atualizar status para "erro"
      await db.update(messageSendingHistory)
        .set({ 
          status: "erro",
          errorMessage: error.message || "Erro desconhecido"
        })
        .where(eq(messageSendingHistory.id, schedule.id));
    }
  }
}

// Inicializar o scheduler automaticamente
const scheduler = MessageScheduler.getInstance();
scheduler.start();

export default scheduler;