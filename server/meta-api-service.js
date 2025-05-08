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
    await pool.query(`
      UPDATE user_servers 
      SET meta_phone_number_id = $1, 
          meta_connected = true, 
          meta_connected_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $2
    `, [phoneNumberId, userId]);
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar meta_phone_number_id:', error);
    return { success: false, error: error.message };
  }
}

export async function resetMetaConnection(userId) {
  try {
    await pool.query(`
      UPDATE user_servers
      SET meta_phone_number_id = NULL,
          meta_connected = false,
          meta_connected_at = NULL,
          updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao resetar conexão Meta:', error);
    return { success: false, error: error.message };
  }
}

export async function getMetaPhoneNumberId(userId) {
  try {
    const result = await pool.query(`
      SELECT meta_phone_number_id 
      FROM user_servers
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'Usuário não tem servidor associado' };
    }
    
    return { 
      success: true, 
      phoneNumberId: result.rows[0].meta_phone_number_id
    };
  } catch (error) {
    console.error('Erro ao obter meta_phone_number_id:', error);
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
  cleanupResources
};