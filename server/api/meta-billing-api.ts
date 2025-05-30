import axios from 'axios';
import { Pool } from 'pg';

interface MetaBillingData {
  date: string;
  conversations: number;
  cost: number;
  currency: string;
}

interface MetaAnalyticsResponse {
  data: Array<{
    name: string;
    period: string;
    values: Array<{
      value: number;
      end_time: string;
    }>;
  }>;
}

// Função para buscar dados reais de faturamento da Meta API
export async function fetchMetaBillingData(
  accessToken: string,
  businessAccountId: string,
  phoneNumberId: string,
  startDate: string,
  endDate: string
): Promise<MetaBillingData[]> {
  console.log('💰 Buscando dados reais de faturamento da Meta API...');
  
  try {
    // Converter datas para formato Unix timestamp
    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
    
    // Endpoint para analytics de conversas e custos
    const analyticsUrl = `https://graph.facebook.com/v20.0/${businessAccountId}`;
    
    const response = await axios.get(analyticsUrl, {
      params: {
        fields: `conversation_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(daily)`,
        access_token: accessToken
      }
    });

    console.log('📊 Resposta da Meta API (faturamento):', JSON.stringify(response.data, null, 2));

    const billingData: MetaBillingData[] = [];
    
    if (response.data.conversation_analytics?.data) {
      const analyticsData = response.data.conversation_analytics.data;
      
      for (const metric of analyticsData) {
        if (metric.name === 'conversation' && metric.values) {
          for (const value of metric.values) {
            const date = new Date(value.end_time).toISOString().split('T')[0];
            const conversations = value.value || 0;
            
            // Calcular custo baseado no tipo de conversa
            // Conversas iniciadas pelo negócio: $0.005 - $0.009 por conversa
            // Período gratuito de 24h para respostas do cliente
            const costPerConversation = 0.007; // Custo médio em USD
            const cost = conversations * costPerConversation;
            
            billingData.push({
              date,
              conversations,
              cost,
              currency: 'USD'
            });
          }
        }
      }
    }

    console.log('💰 Dados de faturamento processados:', billingData);
    return billingData;
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar dados de faturamento da Meta API:', error.response?.data || error.message);
    
    // Se a API não retornar dados, vamos calcular baseado nas mensagens locais
    return await calculateBillingFromLocalData(phoneNumberId, startDate, endDate);
  }
}

// Função alternativa para calcular faturamento baseado nos dados locais
async function calculateBillingFromLocalData(
  phoneNumberId: string,
  startDate: string,
  endDate: string
): Promise<MetaBillingData[]> {
  console.log('📊 Calculando faturamento baseado nos dados locais...');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Buscar conversas iniciadas pelo negócio (from_me = true)
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT contact_phone) as conversations
      FROM meta_chat_messages 
      WHERE created_at >= $1 
        AND created_at <= $2
        AND from_me = true
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    
    const billingData: MetaBillingData[] = result.rows.map(row => {
      const conversations = parseInt(row.conversations) || 0;
      const costPerConversation = 0.007; // Custo médio em USD
      const cost = conversations * costPerConversation;
      
      return {
        date: row.date,
        conversations,
        cost,
        currency: 'USD'
      };
    });
    
    console.log('💰 Faturamento calculado localmente:', billingData);
    return billingData;
    
  } finally {
    await pool.end();
  }
}

// Função para salvar dados de faturamento no banco
export async function saveBillingDataToDatabase(
  userId: number,
  phoneNumberId: string,
  billingData: MetaBillingData[]
) {
  console.log('💾 Salvando dados de faturamento no banco...');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
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
    
  } finally {
    await pool.end();
  }
}