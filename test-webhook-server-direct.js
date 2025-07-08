/**
 * Teste direto do webhook para Webhook de Configuração Instancia Evolution
 */

import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

async function testServerWebhook() {
  console.log("🧪 Testando webhook de Configuração Instancia Evolution");
  console.log("📅 Timestamp:", new Date().toISOString());
  
  try {
    const userId = 2;
    
    // Buscar URL do webhook do servidor
    const webhookUrl = await getServerWebhookUrl(userId);
    if (!webhookUrl) {
      console.log("❌ Webhook não configurado");
      return false;
    }
    
    // Preparar payload de teste
    const payload = {
      event: 'qr_code_generated',
      data: {
        user_name: 'Administrador',
        user_id: userId,
        webhook_url: 'https://webhook.primerastreadores.com/webhook/9e1825cc-bfe5-43f0-a818-412c72f1f081',
        cloud_webhook_url: null,
        agent_name: 'Agente 02',
        qr_code_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📤 Enviando webhook de teste para: ${webhookUrl}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-QRGenerated-Webhook-Test/1.0',
        'X-User-ID': userId.toString(),
        'X-User-Name': 'Administrador'
      },
      timeout: 10000
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Webhook enviado com sucesso!`);
      console.log(`📊 Status: ${response.status} - ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️ Status inesperado: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar webhook:', error.message);
    
    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  } finally {
    await pool.end();
  }
}

// Executar o teste
testServerWebhook()
  .then(success => {
    console.log(`\n🎯 Resultado: ${success ? 'SUCESSO' : 'FALHA'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });