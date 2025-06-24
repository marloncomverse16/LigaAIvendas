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
      const { pool } = await import("../db");
      const result = await pool.query(`
        SELECT * FROM message_sending_history 
        WHERE status = 'agendado' 
        AND scheduled_at IS NOT NULL 
        AND scheduled_at <= $1
      `, [now]);
      
      const pendingSchedules = result.rows;

      // Debug: mostrar todos os agendamentos independente do status
      const allSchedules = await pool.query(`
        SELECT id, status, scheduled_at, total_recipients 
        FROM message_sending_history 
        WHERE scheduled_at IS NOT NULL 
        ORDER BY scheduled_at DESC 
        LIMIT 5
      `);
      
      console.log(`📅 Verificando agendamentos às ${now.toISOString()}`);
      console.log(`📅 Total de agendamentos com data: ${allSchedules.rows.length}`);
      for (const schedule of allSchedules.rows) {
        console.log(`📅 - ID: ${schedule.id}, Status: ${schedule.status}, Agendado para: ${schedule.scheduled_at}`);
      }
      console.log(`📅 Pendentes para executar agora: ${pendingSchedules.length}`);
      
      if (pendingSchedules.length > 0) {
        console.log(`📅 Encontrados ${pendingSchedules.length} envios agendados para executar`);
        for (const schedule of pendingSchedules) {
          console.log(`📅 - EXECUTANDO ID: ${schedule.id}, Agendado para: ${schedule.scheduled_at}`);
        }
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
      
      // Atualizar status para "em_andamento" usando SQL direto
      const { pool } = await import("../db");
      await pool.query(`
        UPDATE message_sending_history 
        SET status = 'em_andamento', started_at = $1 
        WHERE id = $2
      `, [new Date(), schedule.id]);

      // Buscar os resultados da pesquisa
      const results = await db.select()
        .from(prospectingResults)
        .where(eq(prospectingResults.searchId, schedule.searchId));

      if (!results.length) {
        throw new Error("Nenhum resultado encontrado para esta pesquisa");
      }

      // Verificar configuração Meta API do usuário
      const metaUserServer = await getUserServer(schedule.user_id);
      
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
      
      // Atualizar status final usando SQL direto
      await pool.query(`
        UPDATE message_sending_history 
        SET status = 'concluido', success_count = $1, error_count = $2, 
            error_message = $3, completed_at = $4 
        WHERE id = $5
      `, [successCount, errorCount, lastError || null, new Date(), schedule.id]);

      console.log(`📅 Envio agendado ${schedule.id} concluído: ${successCount} enviados, ${errorCount} erros`);
      
    } catch (error: any) {
      console.error(`📅 Erro no envio agendado ${schedule.id}:`, error);
      
      // Atualizar status para "erro" usando SQL direto
      const { pool } = await import("../db");
      await pool.query(`
        UPDATE message_sending_history 
        SET status = 'erro', error_message = $1 
        WHERE id = $2
      `, [error.message || "Erro desconhecido", schedule.id]);
    }
  }
}

// Inicializar o scheduler automaticamente
const scheduler = MessageScheduler.getInstance();
scheduler.start();

export default scheduler;