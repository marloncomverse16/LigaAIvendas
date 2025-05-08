/**
 * Serviço para gerenciar a conexão com a Meta API usando SQL nativo
 * Este módulo contorna o ORM Drizzle para evitar problemas com as colunas meta_*
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function updateMetaPhoneNumberId(userId, phoneNumberId) {
  try {
    console.log(`Atualizando phoneNumberId para usuário ${userId}: ${phoneNumberId}`);
    
    const result = await pool.query(`
      UPDATE user_servers 
      SET meta_phone_number_id = $1, 
          meta_connected = true, 
          meta_connected_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `, [phoneNumberId, userId]);
    
    if (result.rows.length === 0) {
      console.log(`Nenhum registro encontrado para usuário ${userId}`);
      return { success: false, message: 'Nenhum registro de servidor encontrado para o usuário' };
    }
    
    console.log(`Atualização realizada com sucesso para usuário ${userId}`);
    return { success: true, updatedServer: result.rows[0] };
  } catch (error) {
    console.error('Erro ao atualizar meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

export async function resetMetaConnection(userId) {
  try {
    console.log(`Resetando conexão Meta para usuário ${userId}`);
    
    const result = await pool.query(`
      UPDATE user_servers
      SET meta_phone_number_id = NULL,
          meta_connected = false,
          meta_connected_at = NULL,
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'Nenhum registro encontrado para o usuário' };
    }
    
    return { success: true, updatedServer: result.rows[0] };
  } catch (error) {
    console.error('Erro ao resetar conexão Meta:', error);
    return { success: false, error: error.message };
  }
}

export async function getMetaPhoneNumberId(userId) {
  try {
    console.log(`Obtendo meta_phone_number_id para usuário ${userId}`);
    
    const result = await pool.query(`
      SELECT meta_phone_number_id, meta_connected, meta_connected_at
      FROM user_servers
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'Usuário não tem servidor associado' };
    }
    
    const data = result.rows[0];
    console.log(`Dados para usuário ${userId}:`, data);
    
    return { 
      success: true, 
      phoneNumberId: data.meta_phone_number_id,
      connected: data.meta_connected,
      connectedAt: data.meta_connected_at
    };
  } catch (error) {
    console.error('Erro ao obter meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserServer(userId) {
  try {
    console.log(`Obtendo servidor para usuário ${userId}`);
    
    // Primeiro, obtemos a relação user_servers
    const userServerResult = await pool.query(`
      SELECT us.*, s.* 
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (userServerResult.rows.length === 0) {
      return { success: false, message: 'Usuário não tem servidor associado' };
    }
    
    const serverData = userServerResult.rows[0];
    return { success: true, server: serverData };
  } catch (error) {
    console.error('Erro ao obter servidor do usuário:', error);
    return { success: false, error: error.message };
  }
}

export async function cleanupResources() {
  await pool.end();
}

export default {
  updateMetaPhoneNumberId,
  resetMetaConnection,
  getMetaPhoneNumberId,
  getUserServer,
  cleanupResources
};