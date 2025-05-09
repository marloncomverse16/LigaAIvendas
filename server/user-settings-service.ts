/**
 * Serviço para obter configurações específicas do usuário
 * Incluindo as configurações da API da Meta para WhatsApp Cloud API
 */

import pg from 'pg';
const { Pool } = pg;

// Inicializar o pool de conexões
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Interface para dados de configurações
export interface UserSettings {
  id: number;
  userId: number;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  darkMode: boolean;
  whatsappSendingGoal: number;
  revenueGoal: string;
  leadsGoal: number;
  // WhatsApp Meta Cloud API
  whatsappMetaToken: string | null;
  whatsappMetaBusinessId: string | null;
  whatsappMetaApiVersion: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// Interface para resultado de serviço
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Obtém as configurações de um usuário
 */
export async function getUserSettings(userId: number): Promise<ServiceResult<UserSettings | null>> {
  try {
    console.log(`Buscando configurações para usuário ${userId}`);
    
    const result = await pool.query(`
      SELECT * FROM settings
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Criar configurações padrão para o usuário se não existirem
      const defaultSettings = await createDefaultSettings(userId);
      return { success: true, data: defaultSettings.data };
    }
    
    // Converter para camelCase
    const settings: UserSettings = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      logoUrl: result.rows[0].logo_url,
      primaryColor: result.rows[0].primary_color || '#047857',
      secondaryColor: result.rows[0].secondary_color || '#4f46e5',
      darkMode: result.rows[0].dark_mode || false,
      whatsappSendingGoal: result.rows[0].whatsapp_sending_goal || 0,
      revenueGoal: result.rows[0].revenue_goal || '0',
      leadsGoal: result.rows[0].leads_goal || 0,
      // WhatsApp Meta Cloud API
      whatsappMetaToken: result.rows[0].whatsapp_meta_token,
      whatsappMetaBusinessId: result.rows[0].whatsapp_meta_business_id,
      whatsappMetaApiVersion: result.rows[0].whatsapp_meta_api_version || 'v18.0',
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('Erro ao buscar configurações do usuário:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cria configurações padrão para um usuário
 */
async function createDefaultSettings(userId: number): Promise<ServiceResult<UserSettings>> {
  try {
    console.log(`Criando configurações padrão para usuário ${userId}`);
    
    const result = await pool.query(`
      INSERT INTO settings (
        user_id, primary_color, secondary_color, dark_mode,
        whatsapp_sending_goal, revenue_goal, leads_goal,
        whatsapp_meta_api_version
      )
      VALUES ($1, '#047857', '#4f46e5', false, 0, '0', 0, 'v18.0')
      RETURNING *
    `, [userId]);
    
    if (result.rows.length === 0) {
      return { 
        success: false, 
        message: 'Não foi possível criar configurações padrão' 
      };
    }
    
    // Converter para camelCase
    const settings: UserSettings = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      logoUrl: result.rows[0].logo_url,
      primaryColor: result.rows[0].primary_color,
      secondaryColor: result.rows[0].secondary_color,
      darkMode: result.rows[0].dark_mode,
      whatsappSendingGoal: result.rows[0].whatsapp_sending_goal,
      revenueGoal: result.rows[0].revenue_goal,
      leadsGoal: result.rows[0].leads_goal,
      whatsappMetaToken: result.rows[0].whatsapp_meta_token,
      whatsappMetaBusinessId: result.rows[0].whatsapp_meta_business_id,
      whatsappMetaApiVersion: result.rows[0].whatsapp_meta_api_version,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('Erro ao criar configurações padrão:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza as configurações de WhatsApp Meta API de um usuário
 */
export async function updateWhatsAppMetaSettings(
  userId: number, 
  data: {
    whatsappMetaToken?: string | null;
    whatsappMetaBusinessId?: string | null;
    whatsappMetaApiVersion?: string | null;
  }
): Promise<ServiceResult<UserSettings>> {
  try {
    console.log(`Atualizando configurações de WhatsApp Meta API para usuário ${userId}`);
    
    // Construir a query de atualização apenas com os campos fornecidos
    let updateFields = [];
    let queryParams = []; // Adicionar parâmetros na ordem correta
    let paramCounter = 1;
    
    if (data.whatsappMetaToken !== undefined) {
      updateFields.push(`whatsapp_meta_token = $${paramCounter}`);
      queryParams.push(data.whatsappMetaToken);
      paramCounter++;
    }
    
    if (data.whatsappMetaBusinessId !== undefined) {
      updateFields.push(`whatsapp_meta_business_id = $${paramCounter}`);
      queryParams.push(data.whatsappMetaBusinessId);
      paramCounter++;
    }
    
    if (data.whatsappMetaApiVersion !== undefined) {
      updateFields.push(`whatsapp_meta_api_version = $${paramCounter}`);
      queryParams.push(data.whatsappMetaApiVersion);
      paramCounter++;
    }
    
    // Adicionar updated_at sempre
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 1) {
      // Se só temos updated_at, não precisamos fazer nada específico
      return { success: false, message: 'Nenhum campo fornecido para atualização' };
    }
    
    const updateQuery = `
      UPDATE settings
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramCounter}
      RETURNING *
    `;
    
    // Adicionar userId como último parâmetro
    queryParams.push(userId);
    
    const result = await pool.query(updateQuery, queryParams);
    
    if (result.rows.length === 0) {
      // Tentar criar configurações se não existirem
      const createResult = await createDefaultSettings(userId);
      if (!createResult.success) {
        return createResult;
      }
      
      // Tentar atualizar novamente
      return updateWhatsAppMetaSettings(userId, data);
    }
    
    // Converter para camelCase
    const settings: UserSettings = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      logoUrl: result.rows[0].logo_url,
      primaryColor: result.rows[0].primary_color,
      secondaryColor: result.rows[0].secondary_color,
      darkMode: result.rows[0].dark_mode,
      whatsappSendingGoal: result.rows[0].whatsapp_sending_goal,
      revenueGoal: result.rows[0].revenue_goal,
      leadsGoal: result.rows[0].leads_goal,
      whatsappMetaToken: result.rows[0].whatsapp_meta_token,
      whatsappMetaBusinessId: result.rows[0].whatsapp_meta_business_id,
      whatsappMetaApiVersion: result.rows[0].whatsapp_meta_api_version,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
    
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('Erro ao atualizar configurações de WhatsApp Meta API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fecha o pool de conexões (chamar ao encerrar o app)
 */
export async function cleanup(): Promise<void> {
  await pool.end();
}

export default {
  getUserSettings,
  updateWhatsAppMetaSettings,
  cleanup
};