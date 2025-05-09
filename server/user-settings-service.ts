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
    console.log('Dados recebidos:', JSON.stringify({
      hasToken: !!data.whatsappMetaToken,
      hasBusinessId: !!data.whatsappMetaBusinessId,
      apiVersion: data.whatsappMetaApiVersion
    }));
    
    // Verificar primeiro se as configurações existem, se não, criar
    const settingsResult = await getUserSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      console.log('Configurações não encontradas, criando novas');
      await createDefaultSettings(userId);
    }
    
    // Agora podemos atualizar com um UPDATE direto
    const settings = await pool.query(`
      UPDATE settings 
      SET 
        whatsapp_meta_token = COALESCE($1, whatsapp_meta_token), 
        whatsapp_meta_business_id = COALESCE($2, whatsapp_meta_business_id),
        whatsapp_meta_api_version = COALESCE($3, whatsapp_meta_api_version),
        updated_at = NOW()
      WHERE user_id = $4
      RETURNING *
    `, [
      data.whatsappMetaToken,
      data.whatsappMetaBusinessId,
      data.whatsappMetaApiVersion,
      userId
    ]);
    
    if (settings.rows.length === 0) {
      console.error('Não foi possível atualizar as configurações');
      return { 
        success: false, 
        message: 'Não foi possível atualizar as configurações' 
      };
    }
    
    // Converter para camelCase
    const updatedSettings: UserSettings = {
      id: settings.rows[0].id,
      userId: settings.rows[0].user_id,
      logoUrl: settings.rows[0].logo_url,
      primaryColor: settings.rows[0].primary_color,
      secondaryColor: settings.rows[0].secondary_color,
      darkMode: settings.rows[0].dark_mode,
      whatsappSendingGoal: settings.rows[0].whatsapp_sending_goal,
      revenueGoal: settings.rows[0].revenue_goal,
      leadsGoal: settings.rows[0].leads_goal,
      whatsappMetaToken: settings.rows[0].whatsapp_meta_token,
      whatsappMetaBusinessId: settings.rows[0].whatsapp_meta_business_id,
      whatsappMetaApiVersion: settings.rows[0].whatsapp_meta_api_version,
      createdAt: settings.rows[0].created_at,
      updatedAt: settings.rows[0].updated_at
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