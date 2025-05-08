/**
 * Serviço para gerenciar operações da tabela user_servers usando SQL nativo
 * Contorna os problemas com colunas meta_* no ORM
 */

import pg from 'pg';
const { Pool } = pg;

// Inicializar o pool de conexões
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Interface para dados de user_server
export interface UserServer {
  id: number;
  userId: number;
  serverId: number;
  isDefault: boolean;
  metaPhoneNumberId: string | null;
  metaConnected: boolean;
  metaConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  [key: string]: any;
}

// Interface para sucesso ou erro
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Obtém um registro user_server pelo ID do usuário
 */
export async function getUserServerByUserId(userId: number): Promise<ServiceResult<UserServer | null>> {
  try {
    console.log(`Buscando user_server para usuário ${userId}`);
    
    const result = await pool.query(`
      SELECT us.*, s.* 
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { 
        success: true, 
        data: null,
        message: `Usuário ${userId} não tem servidor associado` 
      };
    }
    
    const row = result.rows[0];
    // Primeiro, vamos extrair todos os campos do row e analisar quais pertencem ao servidor vs user_server
    const userServerId = row.id;
    const serverId = row.server_id;
    
    // Lógica para determinar quais colunas pertencem ao servidor vs. relação user_server
    // Todas as colunas com prefixo 's.' pertencem ao servidor
    const serverColumns = {};
    const userServerColumns = {};
    
    Object.keys(row).forEach(key => {
      // Se a chave tiver um prefixo como 's_*', é do servidor
      if (key.startsWith('s_')) {
        // Remover o prefixo e converter para camelCase
        const serverKey = key.substring(2); // remove 's_'
        serverColumns[serverKey] = row[key];
      } else {
        userServerColumns[key] = row[key];
      }
    });
    
    // Converter nomes de colunas do banco (snake_case) para camelCase
    const data = {
      id: userServerId,
      userId: row.user_id,
      serverId: serverId,
      isDefault: row.is_default || false,
      metaPhoneNumberId: row.meta_phone_number_id,
      metaConnected: row.meta_connected || false,
      metaConnectedAt: row.meta_connected_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Dados do servidor
      server: {
        id: serverId || userServerId, // Caso não consigamos separar
        name: row.name,
        ipAddress: row.ip_address,
        provider: row.provider,
        apiUrl: row.api_url,
        apiToken: row.api_token,
        whatsappMetaToken: row.whatsapp_meta_token,
        whatsappMetaBusinessId: row.whatsapp_meta_business_id,
        whatsappMetaApiVersion: row.whatsapp_meta_api_version || 'v18.0',
        // Outros campos importantes
        n8nApiUrl: row.n8n_api_url,
        // ...e outros campos do servidor
      }
    };
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Erro ao buscar user_server:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza os campos meta_* para um usuário
 */
export async function updateMetaConnectionFields(
  userId: number, 
  data: { 
    metaPhoneNumberId?: string | null; 
    metaConnected?: boolean;
    metaConnectedAt?: Date | null;
  }
): Promise<ServiceResult<UserServer>> {
  try {
    console.log(`Atualizando campos meta_* para usuário ${userId}:`, data);
    
    // Construir a query de atualização apenas com os campos fornecidos
    let updateFields = [];
    let queryParams = [userId]; // userId será sempre o último parâmetro
    let paramCounter = 1;
    
    if (data.metaPhoneNumberId !== undefined) {
      updateFields.push(`meta_phone_number_id = $${paramCounter++}`);
      queryParams.unshift(data.metaPhoneNumberId);
    }
    
    if (data.metaConnected !== undefined) {
      updateFields.push(`meta_connected = $${paramCounter++}`);
      queryParams.unshift(data.metaConnected);
    }
    
    if (data.metaConnectedAt !== undefined) {
      updateFields.push(`meta_connected_at = $${paramCounter++}`);
      queryParams.unshift(data.metaConnectedAt);
    }
    
    // Adicionar updated_at sempre
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 1) {
      // Se só temos updated_at, não precisamos fazer nada específico
      return { success: false, message: 'Nenhum campo meta_* fornecido para atualização' };
    }
    
    const updateQuery = `
      UPDATE user_servers
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramCounter}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, queryParams);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'Nenhum registro encontrado para o usuário' };
    }
    
    // Converter para camelCase
    const updatedData: UserServer = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      serverId: result.rows[0].server_id,
      isDefault: result.rows[0].is_default || false,
      metaPhoneNumberId: result.rows[0].meta_phone_number_id,
      metaConnected: result.rows[0].meta_connected || false,
      metaConnectedAt: result.rows[0].meta_connected_at,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    return { success: true, data: updatedData };
  } catch (error: any) {
    console.error('Erro ao atualizar campos meta_*:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpa os campos meta_* para um usuário
 */
export async function resetMetaConnection(userId: number): Promise<ServiceResult<UserServer>> {
  return updateMetaConnectionFields(userId, {
    metaPhoneNumberId: null,
    metaConnected: false,
    metaConnectedAt: null
  });
}

/**
 * Fecha o pool de conexões (chamar ao encerrar o app)
 */
export async function cleanup(): Promise<void> {
  await pool.end();
}

export default {
  getUserServerByUserId,
  updateMetaConnectionFields,
  resetMetaConnection,
  cleanup
};