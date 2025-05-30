import { Pool } from 'pg';

interface MetaAnalyticsParams {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  startDate: string;
  endDate: string;
}

interface ConversationAnalytics {
  conversation_analytics: {
    data: Array<{
      data_points: Array<{
        start: string;
        end: string;
        conversation: number;
        cost: number;
        phone_number: string;
      }>;
    }>;
  };
}

interface MessageAnalytics {
  message_analytics: {
    data: Array<{
      data_points: Array<{
        start: string;
        end: string;
        sent: number;
        delivered: number;
        read: number;
        cost: number;
      }>;
    }>;
  };
}

// Função para buscar analytics de conversas baseado nos dados reais do banco
export async function fetchConversationAnalytics(params: MetaAnalyticsParams): Promise<ConversationAnalytics> {
  const { phoneNumberId, accessToken, businessAccountId, startDate, endDate } = params;
  
  console.log('📊 Gerando relatório de conversas baseado nos dados reais do banco');
  console.log('📋 Parâmetros:', {
    phoneNumberId,
    businessAccountId,
    startDate,
    endDate,
    tokenPreview: accessToken.substring(0, 20) + '...'
  });

  // Usar dados reais das mensagens armazenadas no banco de dados
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Buscar estatísticas de conversas reais do banco
    const conversationStats = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT contact_phone) as initiated_conversations,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN from_me = false THEN 1 END) as received_messages,
        COUNT(CASE WHEN from_me = true THEN 1 END) as sent_messages
      FROM meta_chat_messages 
      WHERE created_at >= $1 
        AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate, endDate]);

    console.log('✅ Dados de conversas obtidos do banco:', conversationStats.rows);

    // Simular formato de resposta da Meta API
    const analytics = {
      conversation_analytics: {
        data: conversationStats.rows.map(row => ({
          name: 'initiated_conversations',
          period: 'day',
          values: [{
            value: parseInt(row.initiated_conversations),
            end_time: row.date
          }]
        }))
      }
    };

    return analytics;
  } catch (error: any) {
    console.error('❌ Erro ao buscar dados de conversas do banco:', error);
    throw new Error('Falha ao obter dados de conversas do banco de dados');
  } finally {
    await pool.end();
  }
}

// Função para buscar analytics de mensagens baseado nos dados reais do banco
export async function fetchMessageAnalytics(params: MetaAnalyticsParams): Promise<MessageAnalytics> {
  const { phoneNumberId, accessToken, businessAccountId, startDate, endDate } = params;
  
  console.log('📧 Gerando relatório de mensagens baseado nos dados reais do banco');

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Buscar estatísticas de mensagens reais do banco
    const messageStats = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN from_me = true THEN 1 END) as sent_messages,
        COUNT(CASE WHEN from_me = false THEN 1 END) as received_messages,
        COUNT(CASE WHEN from_me = true AND status = 'sent' THEN 1 END) as delivered_messages,
        COUNT(CASE WHEN from_me = true AND status != 'sent' THEN 1 END) as failed_messages
      FROM meta_chat_messages 
      WHERE created_at >= $1 
        AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startDate, endDate]);

    console.log('✅ Dados de mensagens obtidos do banco:', messageStats.rows);

    // Formato de resposta para compatibilidade
    const analytics = {
      message_analytics: {
        data: messageStats.rows.map(row => ({
          name: 'sent_messages',
          period: 'day',
          values: [{
            value: parseInt(row.sent_messages),
            end_time: row.date
          }]
        }))
      }
    };

    return analytics;
  } catch (error: any) {
    console.error('❌ Erro ao buscar dados de mensagens do banco:', error);
    throw new Error('Falha ao obter dados de mensagens do banco de dados');
  } finally {
    await pool.end();
  }
}

// Função para salvar dados de conversas no banco
export async function saveConversationReports(pool: Pool, userId: number, phoneNumberId: string, data: ConversationAnalytics) {
  if (!data.conversation_analytics?.data?.length) return;

  for (const analyticsData of data.conversation_analytics.data) {
    for (const dataPoint of analyticsData.data_points) {
      const query = `
        INSERT INTO meta_conversation_reports 
        (user_id, phone_number_id, conversation_id, contact_number, conversation_type, 
         started_at, message_count, total_cost, created_at)
        VALUES ($1, $2, $3, $4, 'business_initiated', $5, $6, $7, NOW())
        ON CONFLICT (phone_number_id, started_at) 
        DO UPDATE SET 
          message_count = EXCLUDED.message_count,
          total_cost = EXCLUDED.total_cost,
          updated_at = NOW()
      `;
      
      await pool.query(query, [
        userId,
        phoneNumberId,
        `conv_${dataPoint.start}_${dataPoint.phone_number}`,
        dataPoint.phone_number,
        dataPoint.start,
        dataPoint.conversation,
        dataPoint.cost.toString()
      ]);
    }
  }
}

// Função para salvar dados de mensagens no banco
export async function saveMessageReports(pool: Pool, userId: number, phoneNumberId: string, data: MessageAnalytics) {
  if (!data.message_analytics?.data?.length) return;

  for (const analyticsData of data.message_analytics.data) {
    for (const dataPoint of analyticsData.data_points) {
      const query = `
        INSERT INTO meta_message_reports 
        (user_id, phone_number_id, message_id, contact_number, message_type, 
         message_direction, delivery_status, sent_at, delivered_at, read_at, cost, created_at)
        VALUES ($1, $2, $3, 'unknown', 'text', 'outbound', 
                CASE WHEN $4 > 0 THEN 'delivered' ELSE 'sent' END,
                $5, 
                CASE WHEN $4 > 0 THEN $5 ELSE NULL END,
                CASE WHEN $6 > 0 THEN $5 ELSE NULL END,
                $7, NOW())
        ON CONFLICT (message_id) 
        DO UPDATE SET 
          delivery_status = EXCLUDED.delivery_status,
          delivered_at = EXCLUDED.delivered_at,
          read_at = EXCLUDED.read_at,
          cost = EXCLUDED.cost,
          updated_at = NOW()
      `;
      
      await pool.query(query, [
        userId,
        phoneNumberId,
        `msg_${dataPoint.start}_${Math.random()}`,
        dataPoint.delivered,
        dataPoint.start,
        dataPoint.read,
        dataPoint.cost.toString()
      ]);
    }
  }
}

// Função para gerar relatório de cobrança
export async function generateBillingReport(pool: Pool, userId: number, phoneNumberId: string, startDate: string, endDate: string) {
  const query = `
    INSERT INTO meta_billing_reports 
    (user_id, phone_number_id, report_date, conversation_count, message_count, total_cost, created_at)
    SELECT 
      $1, $2, $3,
      COALESCE(SUM(message_count), 0) as conversation_count,
      COALESCE(COUNT(*), 0) as message_count,
      COALESCE(SUM(CAST(total_cost AS DECIMAL)), 0)::TEXT as total_cost,
      NOW()
    FROM meta_conversation_reports 
    WHERE user_id = $1 AND phone_number_id = $2 
      AND started_at >= $4 AND started_at <= $5
    ON CONFLICT (user_id, phone_number_id, report_date) 
    DO UPDATE SET 
      conversation_count = EXCLUDED.conversation_count,
      message_count = EXCLUDED.message_count,
      total_cost = EXCLUDED.total_cost,
      updated_at = NOW()
  `;
  
  await pool.query(query, [userId, phoneNumberId, startDate, startDate, endDate]);
}

// Função para atualizar relatórios de leads respondidos
export async function updateLeadResponseReports(pool: Pool, userId: number, phoneNumberId: string) {
  // Buscar conversas onde houve resposta do cliente
  const query = `
    UPDATE meta_lead_response_reports 
    SET 
      has_response = true,
      first_response_at = NOW(),
      response_time = EXTRACT(EPOCH FROM (NOW() - first_message_at))/60,
      lead_status = 'responded',
      updated_at = NOW()
    WHERE user_id = $1 AND phone_number_id = $2 
      AND has_response = false
      AND contact_number IN (
        SELECT DISTINCT contact_number 
        FROM meta_conversation_reports 
        WHERE user_id = $1 AND phone_number_id = $2
          AND message_count > 1
      )
  `;
  
  await pool.query(query, [userId, phoneNumberId]);
}