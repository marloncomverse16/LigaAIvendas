import { Pool } from 'pg';

// Função para gerar relatórios baseados exclusivamente nos dados do banco
export async function generateMetaReportsFromDatabase(userId: number, startDate: string, endDate: string) {
  console.log('📊 Gerando relatórios Meta baseados nos dados reais do banco de dados');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Relatório de Conversas Iniciadas
    const conversationsQuery = `
      SELECT 
        contact_phone,
        DATE(created_at) as date,
        COUNT(*) as message_count
      FROM meta_chat_messages 
      WHERE user_id = $1
        AND created_at >= $2 
        AND created_at <= $3
        AND from_me = true
      GROUP BY contact_phone, DATE(created_at)
      ORDER BY date DESC, contact_phone
    `;

    const conversationsResult = await pool.query(conversationsQuery, [userId, startDate, endDate]);

    // 2. Relatório de Mensagens Entregues/Não Entregues
    const messagesQuery = `
      SELECT 
        contact_phone,
        DATE(created_at) as date,
        status as delivery_status,
        message_type,
        created_at as sent_at
      FROM meta_chat_messages 
      WHERE user_id = $1
        AND created_at >= $2 
        AND created_at <= $3
        AND from_me = true
      ORDER BY date DESC, contact_phone
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
        VALUES ($1, 'direct_db', $2, $3, 'business_initiated', $4, $5, NOW())
      `, [userId, `conv_${row.contact_phone}_${row.date.toString().replace(/-/g, '')}`, row.contact_phone, row.date, row.message_count]);
    }

    // Salvar relatórios de mensagens
    for (const row of messagesResult.rows) {
      await pool.query(`
        INSERT INTO meta_message_reports 
        (user_id, phone_number_id, message_id, contact_number, message_type, message_direction, delivery_status, sent_at, created_at)
        VALUES ($1, 'direct_db', $2, $3, $4, 'outbound', $5, $6, NOW())
      `, [userId, `msg_${row.contact_phone}_${Date.now()}`, row.contact_phone, row.message_type || 'text', row.delivery_status || 'delivered', row.sent_at]);
    }

    // Salvar relatórios de leads
    for (const row of leadsResult.rows) {
      await pool.query(`
        INSERT INTO meta_lead_response_reports 
        (user_id, phone_number_id, contact_number, first_message_at, has_response, total_messages, created_at)
        VALUES ($1, 'direct_db', $2, $3, $4, $5, NOW())
      `, [userId, row.contact_phone, row.first_contact, row.responded, row.total_messages]);
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