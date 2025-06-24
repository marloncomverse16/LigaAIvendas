import { pool } from "../db";

/**
 * Sistema de limpeza automática que remove histórico de envios após 90 dias
 */
export class CleanupScheduler {
  private static instance: CleanupScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): CleanupScheduler {
    if (!CleanupScheduler.instance) {
      CleanupScheduler.instance = new CleanupScheduler();
    }
    return CleanupScheduler.instance;
  }

  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("🧹 Iniciando sistema de limpeza automática (90 dias)");
    
    // Verificar a cada 24 horas (86400000 ms)
    this.intervalId = setInterval(async () => {
      await this.cleanupOldRecords();
    }, 86400000); // 24 horas
    
    // Executar limpeza imediatamente na inicialização
    this.cleanupOldRecords();
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("🧹 Sistema de limpeza automática interrompido");
  }

  private async cleanupOldRecords() {
    try {
      console.log("🧹 Iniciando limpeza automática de registros antigos...");
      
      // Data limite: 90 dias atrás
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      console.log(`🧹 Removendo registros anteriores a ${cutoffDate.toISOString()}`);
      
      // Remover histórico de envios antigos
      const deleteQuery = `
        DELETE FROM message_sending_history 
        WHERE created_at < $1
      `;
      
      const result = await pool.query(deleteQuery, [cutoffDate.toISOString()]);
      
      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        console.log(`🧹 Limpeza concluída: ${deletedCount} registros removidos`);
      } else {
        console.log("🧹 Limpeza concluída: Nenhum registro antigo encontrado");
      }
      
    } catch (error) {
      console.error("🧹 Erro na limpeza automática:", error);
    }
  }

  // Método para executar limpeza manual (para testes)
  public async executeCleanup() {
    await this.cleanupOldRecords();
  }
}