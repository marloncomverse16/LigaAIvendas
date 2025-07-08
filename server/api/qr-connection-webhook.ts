/**
 * Sistema de webhook para notificação de conexão QR Code WhatsApp
 * Envia notificações quando um QR Code é conectado com sucesso ou gerado
 */

import axios from 'axios';
import { pool } from '../db.js';

interface QRConnectionWebhookData {
  userId: number;
  userName: string;
  agentName: string;
  serverName: string;
  connected: boolean;
  timestamp: Date;
}

/**
 * Buscar informações completas do usuário, agente e servidor para o webhook
 */
async function getUserConnectionInfo(userId: number): Promise<QRConnectionWebhookData | null> {
  try {
    // Query para buscar todas as informações necessárias
    const query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.username as user_username,
        sa.name as agent_name,
        s.name as server_name,
        s.ai_agent_webhook_url as instance_webhook_url
      FROM users u
      LEFT JOIN user_servers us ON u.id = us.user_id
      LEFT JOIN servers s ON us.server_id = s.id
      LEFT JOIN user_ai_agents ua ON u.id = ua.user_id
      LEFT JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE u.id = $1
        AND s.active = true
        AND sa.active = true
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`❌ Não foram encontradas informações completas para webhook do usuário ${userId}`);
      return null;
    }

    const row = result.rows[0];
    
    return {
      userId: row.user_id,
      userName: row.user_name || row.user_username || `Usuário ${row.user_id}`,
      agentName: row.agent_name || 'Agente não configurado',
      serverName: row.server_name || 'Servidor não identificado',
      connected: true,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('❌ Erro ao buscar informações para webhook:', error);
    return null;
  }
}

/**
 * Buscar URL do webhook de configuração de instância Evolution
 */
async function getInstanceWebhookUrl(userId: number): Promise<string | null> {
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
      console.log(`⚠️ Webhook de configuração de instância Evolution não encontrado para usuário ${userId}`);
      return null;
    }

    const webhookUrl = result.rows[0].whatsapp_webhook_url;
    console.log(`🔗 Webhook de configuração encontrado: ${webhookUrl}`);
    return webhookUrl;

  } catch (error) {
    console.error('❌ Erro ao buscar URL do webhook:', error);
    return null;
  }
}

/**
 * Buscar URL do webhook Cloud do agente IA do usuário
 */
async function getAIAgentCloudWebhookUrl(userId: number): Promise<string | null> {
  try {
    const query = `
      SELECT COALESCE(sa.cloud_webhook_url, sa.webhook_url) as webhook_url
      FROM user_ai_agents ua
      JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE ua.user_id = $1
        AND sa.active = true
        AND (sa.cloud_webhook_url IS NOT NULL OR sa.webhook_url IS NOT NULL)
        AND (sa.cloud_webhook_url != '' OR sa.webhook_url != '')
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`⚠️ URL do webhook Cloud do agente IA não encontrada para usuário ${userId}`);
      return null;
    }

    const webhookUrl = result.rows[0].webhook_url;
    console.log(`🔗 Webhook Cloud do agente IA encontrado: ${webhookUrl}`);
    return webhookUrl;

  } catch (error) {
    console.error('❌ Erro ao buscar URL do webhook Cloud do agente IA:', error);
    return null;
  }
}

/**
 * Enviar webhook de notificação de conexão QR Code
 */
export async function sendQRConnectionWebhook(userId: number): Promise<boolean> {
  try {
    console.log(`🔔 Iniciando envio de webhook de conexão QR Code para usuário ${userId}`);

    // Buscar informações do usuário, agente e servidor
    const connectionInfo = await getUserConnectionInfo(userId);
    if (!connectionInfo) {
      console.log(`❌ Não foi possível obter informações completas para o webhook`);
      return false;
    }

    // Buscar URL do webhook de configuração de instância
    const webhookUrl = await getInstanceWebhookUrl(userId);
    if (!webhookUrl) {
      console.log(`❌ URL do webhook de configuração de instância não configurada`);
      return false;
    }

    // Preparar payload do webhook
    const payload = {
      event: 'qr_code_connected',
      data: {
        userId: connectionInfo.userId,
        userName: connectionInfo.userName,
        agentName: connectionInfo.agentName,
        serverName: connectionInfo.serverName,
        connected: connectionInfo.connected,
        timestamp: connectionInfo.timestamp.toISOString()
      }
    };

    console.log(`📤 Enviando webhook para: ${webhookUrl}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));

    // Enviar webhook
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-QRConnection-Webhook/1.0'
      },
      timeout: 10000 // 10 segundos timeout
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Webhook de conexão QR Code enviado com sucesso para ${webhookUrl}`);
      console.log(`📊 Resposta do webhook: ${response.status} - ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️ Webhook retornou status não esperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook de conexão QR Code:', error);
    
    if (axios.isAxiosError(error)) {
      console.error(`   - Status: ${error.response?.status}`);
      console.error(`   - Mensagem: ${error.message}`);
      console.error(`   - URL: ${error.config?.url}`);
    }
    
    return false;
  }
}

/**
 * Enviar webhook de desconexão QR Code
 */
export async function sendQRDisconnectionWebhook(userId: number): Promise<boolean> {
  try {
    console.log(`🔔 Iniciando envio de webhook de desconexão QR Code para usuário ${userId}`);

    const connectionInfo = await getUserConnectionInfo(userId);
    if (!connectionInfo) {
      console.log(`❌ Não foi possível obter informações completas para o webhook`);
      return false;
    }

    const webhookUrl = await getInstanceWebhookUrl(userId);
    if (!webhookUrl) {
      console.log(`❌ URL do webhook de configuração de instância não configurada`);
      return false;
    }

    const payload = {
      event: 'qr_code_disconnected',
      data: {
        userId: connectionInfo.userId,
        userName: connectionInfo.userName,
        agentName: connectionInfo.agentName,
        serverName: connectionInfo.serverName,
        connected: false,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📤 Enviando webhook de desconexão para: ${webhookUrl}`);

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-QRConnection-Webhook/1.0'
      },
      timeout: 10000
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Webhook de desconexão QR Code enviado com sucesso`);
      return true;
    } else {
      console.log(`⚠️ Webhook de desconexão retornou status não esperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook de desconexão QR Code:', error);
    return false;
  }
}

/**
 * Buscar informações completas do agente IA para o webhook
 */
async function getCompleteAgentInfo(userId: number): Promise<{
  webhookUrl: string | null;
  cloudWebhookUrl: string | null;
  agentName: string;
} | null> {
  try {
    const query = `
      SELECT 
        sa.webhook_url,
        sa.cloud_webhook_url,
        sa.name as agent_name
      FROM user_ai_agents ua
      JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE ua.user_id = $1
        AND sa.active = true
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`⚠️ Agente IA não encontrado para usuário ${userId}`);
      return null;
    }

    const row = result.rows[0];
    
    return {
      webhookUrl: row.webhook_url,
      cloudWebhookUrl: row.cloud_webhook_url,
      agentName: row.agent_name || 'Agente não identificado'
    };

  } catch (error) {
    console.error('❌ Erro ao buscar informações do agente IA:', error);
    return null;
  }
}

/**
 * Enviar webhook quando QR Code for gerado
 */
export async function sendQRCodeGeneratedWebhook(userId: number, qrCodeData?: string): Promise<boolean> {
  try {
    console.log(`📱 Iniciando envio de webhook de QR Code gerado para usuário ${userId}`);

    // Buscar informações do usuário
    const userQuery = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.username as user_username
      FROM users u
      WHERE u.id = $1
    `;

    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      console.log(`❌ Usuário ${userId} não encontrado`);
      return false;
    }

    const user = userResult.rows[0];
    
    // Buscar informações completas do agente IA
    const agentInfo = await getCompleteAgentInfo(userId);
    if (!agentInfo) {
      console.log(`❌ Informações do agente IA não encontradas para usuário ${userId}`);
      return false;
    }

    // Definir URL de destino (prioriza Cloud webhook)
    const targetWebhookUrl = agentInfo.cloudWebhookUrl || agentInfo.webhookUrl;
    if (!targetWebhookUrl) {
      console.log(`❌ Nenhuma URL de webhook configurada para o agente IA do usuário ${userId}`);
      return false;
    }

    // Preparar payload completo com TODAS as informações solicitadas
    const payload = {
      event: 'qr_code_generated',
      data: {
        // Nome do Usuario
        user_name: user.user_name || user.user_username || `Usuário ${userId}`,
        // ID do Usuario
        user_id: userId,
        // URL do Webhook (agente)
        webhook_url: agentInfo.webhookUrl,
        // URL do Webhook Cloud (Agente)
        cloud_webhook_url: agentInfo.cloudWebhookUrl,
        // Informações adicionais
        agent_name: agentInfo.agentName,
        qr_code_data: qrCodeData || null,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📤 Enviando webhook de QR Code gerado para: ${targetWebhookUrl}`);
    console.log(`📋 Payload completo:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(targetWebhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-QRGenerated-Webhook/1.0',
        'X-User-ID': userId.toString(),
        'X-User-Name': user.user_name || user.user_username || `Usuário ${userId}`
      },
      timeout: 10000
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Webhook de QR Code gerado enviado com sucesso para ${targetWebhookUrl}`);
      console.log(`📊 Resposta do webhook: ${response.status} - ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️ Webhook retornou status não esperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook de QR Code gerado:', error);
    
    if (axios.isAxiosError(error)) {
      console.error(`   - Status: ${error.response?.status}`);
      console.error(`   - Mensagem: ${error.message}`);
      console.error(`   - URL: ${error.config?.url}`);
    }
    
    return false;
  }
}