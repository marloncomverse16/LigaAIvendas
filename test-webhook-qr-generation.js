/**
 * Teste para verificar o webhook de geração de QR Code
 * Simula uma geração de QR Code e verifica se o webhook é enviado
 */

import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Buscar informações completas do agente IA para o webhook
 */
async function getCompleteAgentInfo(userId) {
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
 * Buscar URL do webhook de configuração de instância Evolution do servidor do usuário
 */
async function getServerWebhookUrl(userId) {
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
    console.log(`🔗 Webhook de Configuração Instancia Evolution encontrado: ${webhookUrl}`);
    return webhookUrl;

  } catch (error) {
    console.error('❌ Erro ao buscar URL do webhook do servidor:', error);
    return null;
  }
}

/**
 * Enviar webhook quando QR Code for gerado
 */
async function sendQRCodeGeneratedWebhook(userId, qrCodeData) {
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
    
    // Buscar informações completas do agente IA (para incluir no payload)
    const agentInfo = await getCompleteAgentInfo(userId);
    if (!agentInfo) {
      console.log(`❌ Informações do agente IA não encontradas para usuário ${userId}`);
      return false;
    }

    // Buscar URL do webhook do servidor (Webhook de Configuração Instancia Evolution)
    const targetWebhookUrl = await getServerWebhookUrl(userId);
    if (!targetWebhookUrl) {
      console.log(`❌ Webhook de Configuração Instancia Evolution não configurado para o usuário ${userId}`);
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

    console.log(`📤 Enviando webhook de QR Code gerado para Webhook de Configuração Instancia Evolution: ${targetWebhookUrl}`);
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
      console.log(`✅ Webhook de QR Code gerado enviado com sucesso!`);
      console.log(`📊 Status: ${response.status} - ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️ Status inesperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook de geração de QR Code:', error.message);
    
    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  } finally {
    await pool.end();
  }
}

async function testQRWebhookGeneration() {
  console.log("🧪 Testando webhook de geração de QR Code");
  console.log("📅 Timestamp:", new Date().toISOString());
  
  try {
    const userId = 2;
    const mockQrCode = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    
    console.log(`📱 Simulando geração de QR Code para usuário ${userId}`);
    
    const webhookSent = await sendQRCodeGeneratedWebhook(userId, mockQrCode);
    
    if (webhookSent) {
      console.log("✅ Webhook de QR Code gerado enviado com sucesso!");
      return true;
    } else {
      console.log("❌ Falha ao enviar webhook de QR Code gerado");
      return false;
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    return false;
  }
}

// Executar o teste
testQRWebhookGeneration()
  .then(success => {
    console.log(`\n🎯 Resultado: ${success ? 'SUCESSO' : 'FALHA'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });