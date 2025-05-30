import axios from 'axios';
import { Pool } from '@neondatabase/serverless';

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

// Função para buscar analytics de conversas da Meta API
export async function fetchConversationAnalytics(params: MetaAnalyticsParams): Promise<ConversationAnalytics> {
  const { phoneNumberId, accessToken, startDate, endDate } = params;
  
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
  
  console.log('🔗 Fazendo chamada para Meta API - Conversas');
  console.log('📍 URL:', url);
  console.log('📋 Parâmetros:', {
    fields: 'conversation_analytics.start(' + startDate + ').end(' + endDate + ').granularity(DAILY)',
    phoneNumberId,
    tokenPreview: accessToken.substring(0, 20) + '...'
  });

  try {
    const response = await axios.get(url, {
      params: {
        fields: 'conversation_analytics.start(' + startDate + ').end(' + endDate + ').granularity(DAILY)',
        access_token: accessToken
      }
    });
    
    console.log('✅ Resposta da Meta API - Conversas:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Erro detalhado da Meta API - Conversas:', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message
    });
    
    if (error?.response?.data?.error) {
      throw new Error(`Meta API Error: ${error.response.data.error.message} (Code: ${error.response.data.error.code})`);
    }
    
    throw new Error('Falha ao obter dados de conversas da Meta API');
  }
}

// Função para buscar analytics de mensagens da Meta API
export async function fetchMessageAnalytics(params: MetaAnalyticsParams): Promise<MessageAnalytics> {
  const { phoneNumberId, accessToken, startDate, endDate } = params;
  
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'message_analytics.start(' + startDate + ').end(' + endDate + ').granularity(DAILY)',
        access_token: accessToken
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar analytics de mensagens:', error);
    throw new Error('Falha ao obter dados de mensagens da Meta API');
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