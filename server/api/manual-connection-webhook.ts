/**
 * Sistema de webhook manual para notificação quando WhatsApp QR Code é conectado
 * Dispara webhook apenas quando solicitado pelo frontend na tela "WhatsApp Conectado"
 */

import axios from 'axios';
import { pool } from '../db.js';

interface ManualConnectionWebhookData {
  userId: number;
  userName: string;
  serverName: string;
  connected: boolean;
  timestamp: Date;
}

/**
 * Buscar informações do usuário e servidor para o webhook
 */
async function getUserServerInfo(userId: number): Promise<ManualConnectionWebhookData | null> {
  try {
    const query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.username as user_username,
        s.name as server_name
      FROM users u
      LEFT JOIN user_servers us ON u.id = us.user_id
      LEFT JOIN servers s ON us.server_id = s.id
      WHERE u.id = $1
        AND s.active = true
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`❌ Não foram encontradas informações do usuário/servidor para usuário ${userId}`);
      return null;
    }

    const row = result.rows[0];
    
    return {
      userId: row.user_id,
      userName: row.user_name || row.user_username || `Usuário ${row.user_id}`,
      serverName: row.server_name || 'Servidor não identificado',
      connected: true,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('❌ Erro ao buscar informações para webhook manual:', error);
    return null;
  }
}

/**
 * Buscar URL do webhook de configuração de instância Evolution
 */
async function getWebhookConfigurationUrl(userId: number): Promise<string | null> {
  try {
    const query = `
      SELECT s.whatsapp_webhook_url
      FROM user_servers us
      JOIN servers s ON us.server_id = s.id
      WHERE us.user_id = $1
        AND s.active = true
        AND s.whatsapp_webhook_url IS NOT NULL
        AND s.whatsapp_webhook_url != ''
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`⚠️ Webhook de Configuração Instancia Evolution não encontrado para usuário ${userId}`);
      return null;
    }

    const webhookUrl = result.rows[0].whatsapp_webhook_url;
    console.log(`🔗 Webhook de Configuração encontrado: ${webhookUrl}`);
    return webhookUrl;

  } catch (error) {
    console.error('❌ Erro ao buscar URL do webhook de configuração:', error);
    return null;
  }
}

/**
 * Enviar webhook manual de notificação de conexão WhatsApp
 */
export async function sendManualConnectionWebhook(userId: number): Promise<boolean> {
  try {
    console.log(`🔔 Enviando webhook manual de conexão WhatsApp para usuário ${userId}`);

    // Buscar informações do usuário e servidor
    const connectionInfo = await getUserServerInfo(userId);
    if (!connectionInfo) {
      console.log(`❌ Não foi possível obter informações do usuário/servidor`);
      return false;
    }

    // Buscar URL do webhook de configuração
    const webhookUrl = await getWebhookConfigurationUrl(userId);
    if (!webhookUrl) {
      console.log(`❌ URL do Webhook de Configuração Instancia Evolution não configurada`);
      return false;
    }

    // Preparar payload do webhook
    const payload = {
      event: 'whatsapp_qr_connected',
      data: {
        userId: connectionInfo.userId,
        userName: connectionInfo.userName,
        serverName: connectionInfo.serverName,
        connected: connectionInfo.connected,
        timestamp: connectionInfo.timestamp.toISOString(),
        source: 'manual_trigger' // Indica que foi disparado manualmente
      }
    };

    console.log(`📤 Enviando webhook manual para: ${webhookUrl}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));

    // Enviar webhook
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-Manual-WhatsApp-Webhook/1.0'
      },
      timeout: 10000 // 10 segundos timeout
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Webhook manual de conexão WhatsApp enviado com sucesso para ${webhookUrl}`);
      console.log(`📊 Resposta do webhook: ${response.status} - ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️ Webhook retornou status não esperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook manual de conexão WhatsApp:', error);
    
    if (axios.isAxiosError(error)) {
      console.error(`   - Status: ${error.response?.status}`);
      console.error(`   - Mensagem: ${error.message}`);
      console.error(`   - URL: ${error.config?.url}`);
    }
    
    return false;
  }
}