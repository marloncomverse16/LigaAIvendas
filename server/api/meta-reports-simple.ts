import { Pool } from 'pg';

// Função para gerar relatórios baseados exclusivamente nos dados do banco
export async function generateMetaReportsFromDatabase(userId: number, startDate: string, endDate: string) {
  console.log('📊 Gerando relatórios Meta baseados nos dados reais do banco de dados');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Relatório de Conversas Iniciadas
    const conversationsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT contact_phone) as conversations_initiated,
        COUNT(CASE WHEN from_me = false THEN 1 END) as messages_received,
        COUNT(CASE WHEN from_me = true THEN 1 END) as messages_sent
      FROM meta_chat_messages 
      WHERE user_id = $1
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const conversationsResult = await pool.query(conversationsQuery, [userId, startDate, endDate]);

    // 2. Relatório de Mensagens Entregues/Não Entregues
    const messagesQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN from_me = true AND status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN from_me = true AND status != 'delivered' THEN 1 END) as failed,
        COUNT(CASE WHEN from_me = true THEN 1 END) as total_sent
      FROM meta_chat_messages 
      WHERE user_id = $1
        AND created_at >= $2 
        AND created_at <= $3
        AND from_me = true
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const messagesResult = await pool.query(messagesQuery, [userId, startDate, endDate]);

    // 3. Relatório de Leads que Responderam
    const leadsQuery = `
      SELECT 
        contact_phone,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN from_me = false THEN 1 END) as responses_received,
        MIN(created_at) as first_contact,
        MAX(created_at) as last_activity,
        CASE WHEN COUNT(CASE WHEN from_me = false THEN 1 END) > 0 THEN true ELSE false END as responded
      FROM meta_chat_messages 
      WHERE user_id = $1
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY contact_phone
      ORDER BY last_activity DESC
    `;

    const leadsResult = await pool.query(leadsQuery, [userId, startDate, endDate]);

    // 4. Salvar relatórios nas tabelas apropriadas
    
    // Limpar dados antigos primeiro
    await pool.query('DELETE FROM meta_conversation_reports WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM meta_message_reports WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM meta_lead_response_reports WHERE user_id = $1', [userId]);

    // Salvar relatórios de conversas
    for (const row of conversationsResult.rows) {
      await pool.query(`
        INSERT INTO meta_conversation_reports 
        (user_id, phone_number_id, conversation_id, contact_number, conversation_type, started_at, message_count, created_at)
        VALUES ($1, 'direct_db', $2, 'aggregate_report', 'business_initiated', $3, $4, NOW())
      `, [userId, `conv_${row.date.replace(/-/g, '')}`, row.date, row.conversations_initiated]);
    }

    // Salvar relatórios de mensagens
    for (const row of messagesResult.rows) {
      await pool.query(`
        INSERT INTO meta_message_reports 
        (user_id, phone_number_id, report_date, sent_count, delivered_count, failed_count, created_at)
        VALUES ($1, 'direct_db', $2, $3, $4, $5, NOW())
      `, [userId, row.date, row.total_sent, row.delivered, row.failed]);
    }

    // Salvar relatórios de leads
    for (const row of leadsResult.rows) {
      await pool.query(`
        INSERT INTO meta_lead_response_reports 
        (user_id, phone_number_id, contact_phone, total_messages, response_count, responded, first_contact_at, last_activity_at, created_at)
        VALUES ($1, 'direct_db', $2, $3, $4, $5, $6, $7, NOW())
      `, [userId, row.contact_phone, row.total_messages, row.responses_received, row.responded, row.first_contact, row.last_activity]);
    }

    console.log('✅ Relatórios Meta gerados com sucesso baseados nos dados reais');

    return {
      success: true,
      conversations: conversationsResult.rows,
      messages: messagesResult.rows,
      leads: leadsResult.rows,
      summary: {
        totalConversations: conversationsResult.rows.reduce((sum, row) => sum + parseInt(row.conversations_initiated), 0),
        totalMessages: messagesResult.rows.reduce((sum, row) => sum + parseInt(row.total_sent), 0),
        totalLeads: leadsResult.rows.length,
        respondingLeads: leadsResult.rows.filter(row => row.responded).length
      }
    };

  } catch (error: any) {
    console.error('❌ Erro ao gerar relatórios Meta:', error);
    throw new Error('Falha ao gerar relatórios Meta baseados no banco de dados');
  } finally {
    await pool.end();
  }
}