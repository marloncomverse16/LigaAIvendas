/**
 * Serviço para gerenciar a conexão com a Meta API usando SQL nativo
 * Este módulo contorna o ORM Drizzle para evitar problemas com as colunas meta_*
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Atualiza o phoneNumberId para um usuário
 * @param {number} userId - ID do usuário
 * @param {string} phoneNumberId - ID do número de telefone da Meta
 * @returns {Promise<object>} Resultado da operação
 */
export async function updateMetaPhoneNumberId(userId, phoneNumberId) {
  try {
    console.log(`Atualizando meta_phone_number_id para '${phoneNumberId}' do usuário ${userId}...`);
    
    const updateResult = await pool.query(`
      UPDATE user_servers
      SET meta_phone_number_id = $1,
          meta_connected = true,
          meta_connected_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2
      RETURNING id, user_id, meta_phone_number_id, meta_connected, meta_connected_at
    `, [phoneNumberId, userId]);
    
    if (updateResult.rows.length === 0) {
      return { 
        success: false, 
        message: `Nenhum registro user_server encontrado para o usuário ${userId}` 
      };
    }
    
    return { 
      success: true, 
      phoneNumberId: updateResult.rows[0].meta_phone_number_id,
      connected: updateResult.rows[0].meta_connected,
      connectedAt: updateResult.rows[0].meta_connected_at 
    };
  } catch (error) {
    console.error('Erro ao atualizar meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpa a conexão Meta para um usuário
 * @param {number} userId - ID do usuário
 * @returns {Promise<object>} Resultado da operação
 */
export async function resetMetaConnection(userId) {
  try {
    console.log(`Resetando conexão Meta para o usuário ${userId}...`);
    
    const updateResult = await pool.query(`
      UPDATE user_servers
      SET meta_phone_number_id = NULL,
          meta_connected = false,
          meta_connected_at = NULL,
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING id, user_id
    `, [userId]);
    
    if (updateResult.rows.length === 0) {
      return { 
        success: false, 
        message: `Nenhum registro user_server encontrado para o usuário ${userId}` 
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao resetar conexão Meta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém o phoneNumberId para um usuário
 * @param {number} userId - ID do usuário
 * @returns {Promise<object>} Resultado da operação
 */
export async function getMetaPhoneNumberId(userId) {
  try {
    console.log(`Obtendo meta_phone_number_id para o usuário ${userId}...`);
    
    const result = await pool.query(`
      SELECT meta_phone_number_id, meta_connected, meta_connected_at
      FROM user_servers
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { 
        success: false, 
        message: `Nenhum registro user_server encontrado para o usuário ${userId}` 
      };
    }
    
    return { 
      success: true, 
      phoneNumberId: result.rows[0].meta_phone_number_id,
      connected: result.rows[0].meta_connected,
      connectedAt: result.rows[0].meta_connected_at
    };
  } catch (error) {
    console.error('Erro ao obter meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém o servidor associado a um usuário
 * @param {number} userId - ID do usuário
 * @returns {Promise<object>} Resultado da operação
 */
export async function getUserServer(userId) {
  try {
    console.log(`Consultando informações do servidor para o usuário ${userId}...`);
    
    const result = await pool.query(`
      SELECT 
        us.id, us.user_id, us.server_id, us.created_at, us.is_default,
        us.meta_phone_number_id, us.meta_connected, us.meta_connected_at, 
        us.updated_at,
        s.id as server_id, s.name, s.ip_address, s.provider, s.api_url, 
        s.api_token, s.whatsapp_meta_token, s.whatsapp_meta_business_id, 
        s.whatsapp_meta_api_version, s.n8n_api_url, s.whatsapp_webhook_url
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { 
        success: false, 
        message: `Nenhuma informação de servidor encontrada para o usuário ${userId}` 
      };
    }
    
    const row = result.rows[0];
    
    // Convertendo para formato mais legível/utilizável
    const server = {
      id: row.server_id,
      name: row.name,
      ipAddress: row.ip_address,
      provider: row.provider,
      apiUrl: row.api_url,
      apiToken: row.api_token,
      whatsappMetaToken: row.whatsapp_meta_token,
      whatsappMetaBusinessId: row.whatsapp_meta_business_id,
      whatsappMetaApiVersion: row.whatsapp_meta_api_version || 'v18.0',
      n8nApiUrl: row.n8n_api_url,
      whatsappWebhookUrl: row.whatsapp_webhook_url
    };
    
    return { 
      success: true, 
      server,
      userServer: {
        id: row.id,
        userId: row.user_id,
        serverId: row.server_id,
        metaPhoneNumberId: row.meta_phone_number_id,
        metaConnected: row.meta_connected,
        metaConnectedAt: row.meta_connected_at
      }
    };
  } catch (error) {
    console.error('Erro ao obter servidor do usuário:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fecha o pool de conexões (chamar ao encerrar o app)
 */
export async function cleanupResources() {
  try {
    await pool.end();
    console.log('Pool de conexões meta-api-service fechado.');
  } catch (error) {
    console.error('Erro ao fechar pool de conexões meta-api-service:', error);
  }
}