import axios from 'axios';
import { pool } from '../db';

interface MetaBillingData {
  date: string;
  conversations: number;
  cost: number;
  currency: string;
}

// Função para buscar dados reais de faturamento baseado nas mensagens do banco
export async function fetchMetaBillingData(
  accessToken: string,
  businessAccountId: string,
  phoneNumberId: string,
  startDate: string,
  endDate: string
): Promise<MetaBillingData[]> {
  console.log('💰 Calculando faturamento baseado nos dados reais de mensagens...');
  
  try {
    // A Meta API não fornece endpoints diretos para analytics de faturamento
    // Vamos calcular baseado nos dados reais de mensagens do banco de dados
    const billingData: MetaBillingData[] = [];
    
    // Buscar dados reais de conversas do banco de dados
    const conversationQuery = `
      SELECT 
        DATE(created_at) as conversation_date,
        COUNT(DISTINCT contact_phone) as total_conversations,
        COUNT(*) as total_messages
      FROM meta_chat_messages 
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY conversation_date;
    `;
    
    const { rows: conversationRows } = await pool.query(conversationQuery, [startDate, endDate]);
    
    console.log('📊 Dados reais de conversas encontrados:', conversationRows.length, 'dias');
    
    for (const row of conversationRows) {
      const date = row.conversation_date;
      const conversations = parseInt(row.total_conversations) || 0;
      const messages = parseInt(row.total_messages) || 0;
      
      // Calcular custo baseado nas tarifas reais da Meta
      // Conversas iniciadas pelo negócio: $0.007 USD
      // Mensagens de template: $0.005 USD cada
      const businessInitiatedConversations = conversations;
      const conversationCost = businessInitiatedConversations * 0.007;
      const templateCost = messages * 0.005;
      const totalCost = conversationCost + templateCost;
      
      billingData.push({
        date: date,
        conversations: conversations,
        cost: totalCost,
        currency: 'USD'
      });
    }
    
    console.log('💰 Dados de faturamento calculados:', billingData.length, 'registros');
    return billingData;
    
  } catch (error) {
    console.error('❌ Erro ao calcular faturamento:', error);
    return [];
  }
}

// Função para salvar dados de faturamento no banco
export async function saveBillingDataToDatabase(
  userId: number,
  phoneNumberId: string,
  billingData: MetaBillingData[]
) {
  console.log('💾 Salvando dados de faturamento no banco...');
  
  try {
    // Limpar dados antigos
    await pool.query('DELETE FROM meta_billing_reports WHERE user_id = $1', [userId]);
    
    // Inserir novos dados
    for (const data of billingData) {
      await pool.query(`
        INSERT INTO meta_billing_reports 
        (user_id, phone_number_id, report_date, conversations_count, total_cost, currency, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [userId, phoneNumberId, data.date, data.conversations, data.cost.toFixed(4), data.currency]);
    }
    
    console.log('💾 Dados de faturamento salvos com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao salvar dados de faturamento:', error);
  }
}